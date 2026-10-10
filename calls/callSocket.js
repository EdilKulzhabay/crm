import {
    MAX_SIGNAL_PAYLOAD_BYTES,
    RATE_LIMITS,
    SIGNAL_KINDS,
    SOCKET_EVENTS,
} from "./callConstants.js";
import { CALL_ERROR_CODES, CallError, toPublicError } from "./callErrors.js";
import { parseDeviceId, participantKey, participantRoom } from "./callPolicy.js";
import { isValidObjectId } from "./callRepository.js";
import { createKeyedRateLimiter, createRateLimiter } from "./rateLimiter.js";

/** @typedef {import("./callPolicy.js").Participant} Participant */

const validationError = (message) => new CallError(CALL_ERROR_CODES.VALIDATION, message);

const requireObjectId = (value, field) => {
    if (!isValidObjectId(value)) throw validationError(`Некорректный ${field}`);
    return value;
};

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

export const parseSignal = (data) => {
    const callId = requireObjectId(data?.callId, "callId");
    if (!SIGNAL_KINDS.includes(data?.kind)) throw validationError("Некорректный тип сигнала");
    if (!isPlainObject(data?.payload)) throw validationError("Некорректные данные сигнала");
    if (Buffer.byteLength(JSON.stringify(data.payload)) > MAX_SIGNAL_PAYLOAD_BYTES) {
        throw validationError("Слишком большой сигнал");
    }
    return { callId, kind: data.kind, payload: data.payload };
};

/**
 * Оборачивает обработчик события: rate limit, ack в едином формате, логирование неожиданных ошибок.
 * Ответ: `{ ok: true, data }` или `{ ok: false, error: { code, message } }`.
 */
const handle = (socket, isAllowed, handler) => async (data, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    try {
        if (!isAllowed()) {
            throw new CallError(CALL_ERROR_CODES.RATE_LIMITED, "Слишком много запросов, попробуйте позже");
        }
        const result = await handler(data ?? {});
        reply({ ok: true, data: result ?? null });
    } catch (error) {
        if (!(error instanceof CallError)) {
            console.error(`[calls] ошибка обработки события от ${participantKey(socket.data.participant)}:`, error);
        }
        reply({ ok: false, error: toPublicError(error) });
    }
};

/**
 * Доставка событий стороне звонка и проверка, на связи ли она. Сокет состоит в комнате аккаунта
 * и, если приложение передало deviceId, в комнате устройства (participantRoom).
 * @param {import("socket.io").Namespace} nsp
 */
export const createParticipantChannel = (nsp) => ({
    /** @type {(participant: Participant, event: string, payload: object) => void} */
    emit: (participant, event, payload) => nsp.to(participantRoom(participant)).emit(event, payload),
    /** @type {(participant: Participant) => boolean} */
    isConnected: (participant) => (nsp.adapter.rooms.get(participantRoom(participant))?.size ?? 0) > 0,
});

/**
 * @param {import("socket.io").Namespace} nsp
 * @param {ReturnType<typeof import("./callService.js").createCallService>} service
 * @param {(token: unknown) => Promise<Participant | null>} authenticate
 */
export const registerCallSocket = (nsp, service, authenticate) => {
    // Invite считается по участнику, а не по сокету: защита от спама входящими через reconnect
    const inviteLimiter = createKeyedRateLimiter(RATE_LIMITS.INVITE);

    nsp.use(async (socket, next) => {
        try {
            const participant = await authenticate(socket.handshake.auth?.token);
            if (!participant) return next(new Error("UNAUTHORIZED"));
            // Устройство приложения: звонок по заказу идёт только на устройство, где заказ создан
            socket.data.participant = { ...participant, deviceId: parseDeviceId(socket.handshake.auth?.deviceId) };
            next();
        } catch (error) {
            console.error("[calls] ошибка авторизации сокета:", error);
            next(new Error("INTERNAL"));
        }
    });

    nsp.on("connection", (socket) => {
        /** @type {Participant} */
        const user = socket.data.participant;
        const room = participantKey(user);
        socket.join(room);
        if (user.deviceId) socket.join(participantRoom(user));

        const activeCall = service.onParticipantOnline(user);
        if (activeCall) socket.emit(SOCKET_EVENTS.RESUME, activeCall);

        const inviteAllowed = () => inviteLimiter(room);
        const signalAllowed = createRateLimiter(RATE_LIMITS.SIGNAL);
        const otherAllowed = createRateLimiter(RATE_LIMITS.OTHER);

        socket.on(
            SOCKET_EVENTS.INVITE,
            handle(socket, inviteAllowed, (data) => service.invite(user, requireObjectId(data.orderId, "orderId")))
        );
        socket.on(
            SOCKET_EVENTS.ACCEPT,
            handle(socket, otherAllowed, (data) => service.accept(user, requireObjectId(data.callId, "callId")))
        );
        socket.on(
            SOCKET_EVENTS.REJECT,
            handle(socket, otherAllowed, (data) => service.reject(user, requireObjectId(data.callId, "callId")))
        );
        socket.on(
            SOCKET_EVENTS.END,
            handle(socket, otherAllowed, (data) => service.end(user, requireObjectId(data.callId, "callId")))
        );
        socket.on(
            SOCKET_EVENTS.SIGNAL,
            handle(socket, signalAllowed, (data) => {
                const { callId, kind, payload } = parseSignal(data);
                service.relaySignal(user, callId, kind, payload);
            })
        );

        // Остались ли у стороны звонка другие сокеты, проверяет сервис (isConnected): только он знает,
        // привязана сторона к устройству или ко всему аккаунту. Отключившийся сокет уже вне комнат.
        socket.on("disconnect", () => service.onParticipantOffline(user));
    });
};
