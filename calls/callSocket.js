import {
    MAX_SIGNAL_PAYLOAD_BYTES,
    RATE_LIMITS,
    SIGNAL_KINDS,
    SOCKET_EVENTS,
} from "./callConstants.js";
import { CALL_ERROR_CODES, CallError, toPublicError } from "./callErrors.js";
import { participantKey } from "./callPolicy.js";
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
            socket.data.participant = participant;
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

        socket.on("disconnect", () => {
            // У участника может быть несколько сокетов (новый подключился раньше, чем закрылся старый).
            // На момент события отключившийся сокет уже вышел из комнаты.
            const remaining = nsp.adapter.rooms.get(room)?.size ?? 0;
            if (remaining === 0) service.onParticipantOffline(user);
        });
    });
};
