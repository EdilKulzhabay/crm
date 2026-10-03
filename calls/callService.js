import {
    CALL_STATUSES,
    END_REASONS,
    PARTICIPANT_TYPES,
    RECONNECT_GRACE_MS,
    RING_TIMEOUT_MS,
    SOCKET_EVENTS,
} from "./callConstants.js";
import { CALL_ERROR_CODES, CallError } from "./callErrors.js";
import { getCounterpart, isOrderCallable, participantKey } from "./callPolicy.js";
import { noopCallPushNotifier } from "./push/callPushNotifier.js";

/** @typedef {import("./callPolicy.js").Participant} Participant */

/**
 * @typedef {{
 *   id: string,
 *   orderId: string,
 *   caller: Participant,
 *   callee: Participant,
 *   status: string,
 *   acceptedAt: Date | null,
 *   ringTimer: unknown,
 *   graceTimers: Map<string, unknown>,
 * }} ActiveCall
 */

/**
 * Жизненный цикл звонка: ringing → accepted → ended (или rejected / missed / cancelled / failed).
 *
 * Живое состояние держится в памяти процесса. Это корректно, пока CRM работает одним
 * процессом (Socket.io без adapter). При переходе на кластер состояние нужно вынести
 * в Redis вместе с @socket.io/redis-adapter.
 *
 * Проверка «занят» и резервирование участников выполняются синхронно, без await между ними,
 * поэтому два одновременных invite не могут занять одного и того же участника.
 *
 * @param {{
 *   repository: typeof import("./callRepository.js").mongoCallRepository,
 *   emit: (participant: Participant, event: string, payload: object) => void,
 *   pushNotifier?: typeof noopCallPushNotifier,
 *   logger?: Pick<Console, "error" | "info">,
 *   now?: () => Date,
 *   setTimer?: typeof setTimeout,
 *   clearTimer?: typeof clearTimeout,
 *   ringTimeoutMs?: number,
 *   reconnectGraceMs?: number,
 * }} deps
 */
export const createCallService = ({
    repository,
    emit,
    pushNotifier = noopCallPushNotifier,
    logger = console,
    now = () => new Date(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    ringTimeoutMs = RING_TIMEOUT_MS,
    reconnectGraceMs = RECONNECT_GRACE_MS,
}) => {
    /** @type {Map<string, ActiveCall>} */
    const calls = new Map();
    /** participantKey → callId */
    const busy = new Map();

    const isSame = (a, b) => participantKey(a) === participantKey(b);
    const isParticipant = (call, user) => isSame(call.caller, user) || isSame(call.callee, user);
    const otherSide = (call, user) => (isSame(call.caller, user) ? call.callee : call.caller);

    /** Ошибка записи истории не должна обрывать живой звонок — логируем и продолжаем. */
    const persist = async (callId, fields) => {
        try {
            await repository.updateCall(callId, fields);
        } catch (error) {
            logger.error(`[calls] не удалось сохранить звонок ${callId}:`, error);
        }
    };

    /** Чужой callId неотличим от несуществующего, чтобы не раскрывать чужие звонки. */
    const getCallFor = (user, callId) => {
        const call = calls.get(callId);
        if (!call || !isParticipant(call, user)) {
            throw new CallError(CALL_ERROR_CODES.CALL_NOT_FOUND, "Звонок не найден или уже завершён");
        }
        return call;
    };

    const assertStatus = (call, status) => {
        if (call.status !== status) {
            throw new CallError(CALL_ERROR_CODES.INVALID_STATE, "Недопустимое действие для текущего состояния звонка");
        }
    };

    const assertCallee = (call, user) => {
        if (!isSame(call.callee, user)) {
            throw new CallError(CALL_ERROR_CODES.FORBIDDEN, "Действие доступно только вызываемому абоненту");
        }
    };

    const release = (call) => {
        clearTimer(call.ringTimer);
        call.graceTimers.forEach((timer) => clearTimer(timer));
        calls.delete(call.id);
        busy.delete(participantKey(call.caller));
        busy.delete(participantKey(call.callee));
    };

    /**
     * @param {ActiveCall} call
     * @param {{ status: string, reason: string, endedBy: string | null }} outcome
     */
    /** Пуши не должны задерживать сигналинг: отправляем в фоне, ошибки только логируем */
    const pushInBackground = (description, send) => {
        send().catch((error) => logger.error(`[calls] ${description}:`, error));
    };

    const finish = async (call, { status, reason, endedBy }) => {
        const wasRinging = call.status === CALL_STATUSES.RINGING;
        release(call);
        if (wasRinging) {
            // Вызываемый не ответил: убрать уведомление о входящем на Android
            pushInBackground(`пуш отмены звонка ${call.id} не отправлен`, () =>
                pushNotifier.notifyCallEnded(call.callee, { callId: call.id, ttlMs: ringTimeoutMs })
            );
        }

        const endedAt = now();
        const durationSec = call.acceptedAt
            ? Math.max(0, Math.round((endedAt.getTime() - call.acceptedAt.getTime()) / 1000))
            : 0;

        const payload = { callId: call.id, orderId: call.orderId, status, reason, endedBy, durationSec };
        emit(call.caller, SOCKET_EVENTS.ENDED, payload);
        emit(call.callee, SOCKET_EVENTS.ENDED, payload);

        await persist(call.id, { status, endReason: reason, endedBy, endedAt, durationSec });
    };

    /** Завершение из таймера: исключение некому поймать, поэтому логируем здесь. */
    const finishFromTimer = (call, outcome) => {
        finish(call, outcome).catch((error) => logger.error(`[calls] ошибка завершения звонка ${call.id}:`, error));
    };

    const onRingTimeout = (callId) => {
        const call = calls.get(callId);
        if (!call || call.status !== CALL_STATUSES.RINGING) return;
        finishFromTimer(call, { status: CALL_STATUSES.MISSED, reason: END_REASONS.MISSED, endedBy: null });
    };

    /**
     * Синхронно проверяет и занимает обоих участников.
     * @returns {() => void} освобождение резерва при ошибке создания звонка
     */
    const reserve = (callId, caller, callee) => {
        const keys = [participantKey(caller), participantKey(callee)];
        if (keys.some((key) => busy.has(key))) {
            throw new CallError(CALL_ERROR_CODES.BUSY, "Абонент занят");
        }
        keys.forEach((key) => busy.set(key, callId));
        return () => keys.forEach((key) => busy.delete(key));
    };

    const loadCallableOrder = async (caller, orderId) => {
        const order = await repository.findOrderForCall(orderId);
        if (!order) {
            throw new CallError(CALL_ERROR_CODES.ORDER_NOT_FOUND, "Заказ не найден");
        }
        const callee = getCounterpart(order, caller);
        if (!callee) {
            throw new CallError(CALL_ERROR_CODES.FORBIDDEN, "Вы не участник этого заказа");
        }
        if (!isOrderCallable(order, now())) {
            throw new CallError(CALL_ERROR_CODES.CALL_NOT_ALLOWED, "Звонок по этому заказу сейчас недоступен");
        }
        return { order, callee };
    };

    /**
     * @param {Participant} caller
     * @param {string} orderId
     */
    const invite = async (caller, orderId) => {
        const { order, callee } = await loadCallableOrder(caller, orderId);

        const callId = repository.newCallId();
        const releaseReservation = reserve(callId, caller, callee);
        try {
            await repository.createCall({ id: callId, orderId: order.id, caller, callee });
        } catch (error) {
            releaseReservation();
            throw error;
        }

        calls.set(callId, {
            id: callId,
            orderId: order.id,
            caller,
            callee,
            status: CALL_STATUSES.RINGING,
            acceptedAt: null,
            ringTimer: setTimer(() => onRingTimeout(callId), ringTimeoutMs),
            graceTimers: new Map(),
        });

        const nameOf = (participant) =>
            participant.type === PARTICIPANT_TYPES.CLIENT ? order.clientName : order.courierName;

        const callerInfo = { type: caller.type, name: nameOf(caller) };
        emit(callee, SOCKET_EVENTS.INCOMING, { callId, orderId: order.id, caller: callerInfo });
        // Пуш уходит всегда: сокет в фоне может казаться живым, а приложение уже заморожено.
        // Дубли (сокет + пуш) устройство отсекает по callId.
        pushInBackground(`пуш о входящем ${callId} не отправлен`, () =>
            pushNotifier.notifyIncomingCall(callee, { callId, orderId: order.id, caller: callerInfo, ringTimeoutMs })
        );

        return { callId, orderId: order.id, callee: { type: callee.type, name: nameOf(callee) } };
    };

    const accept = async (user, callId) => {
        const call = getCallFor(user, callId);
        assertCallee(call, user);
        assertStatus(call, CALL_STATUSES.RINGING);

        // Статус меняется до первого await, чтобы повторный accept получил INVALID_STATE
        call.status = CALL_STATUSES.ACCEPTED;
        call.acceptedAt = now();
        clearTimer(call.ringTimer);

        emit(call.caller, SOCKET_EVENTS.ACCEPTED, { callId });
        await persist(callId, { status: CALL_STATUSES.ACCEPTED, acceptedAt: call.acceptedAt });
        return { callId };
    };

    const reject = async (user, callId) => {
        const call = getCallFor(user, callId);
        assertCallee(call, user);
        assertStatus(call, CALL_STATUSES.RINGING);

        await finish(call, { status: CALL_STATUSES.REJECTED, reason: END_REASONS.REJECTED, endedBy: user.type });
        return { callId };
    };

    /** Положить трубку: отмена до ответа, отклонение входящего или завершение разговора. */
    const end = async (user, callId) => {
        const call = getCallFor(user, callId);

        let outcome = { status: CALL_STATUSES.ENDED, reason: END_REASONS.HANGUP };
        if (call.status === CALL_STATUSES.RINGING) {
            outcome = isSame(call.caller, user)
                ? { status: CALL_STATUSES.CANCELLED, reason: END_REASONS.CANCELLED }
                : { status: CALL_STATUSES.REJECTED, reason: END_REASONS.REJECTED };
        }

        await finish(call, { ...outcome, endedBy: user.type });
        return { callId };
    };

    /** Пересылка SDP/ICE второй стороне. Разрешена только в принятом звонке. */
    const relaySignal = (user, callId, kind, payload) => {
        const call = getCallFor(user, callId);
        assertStatus(call, CALL_STATUSES.ACCEPTED);
        emit(otherSide(call, user), SOCKET_EVENTS.SIGNAL, { callId, kind, payload });
    };

    /** Последний сокет участника отключился: даём время переподключиться (смена Wi-Fi ↔ LTE). */
    const onParticipantOffline = (user) => {
        const key = participantKey(user);
        const call = calls.get(busy.get(key));
        if (!call || call.graceTimers.has(key)) return;

        const timer = setTimer(() => {
            if (!calls.has(call.id)) return;
            finishFromTimer(call, {
                status: CALL_STATUSES.FAILED,
                reason: END_REASONS.CONNECTION_LOST,
                endedBy: user.type,
            });
        }, reconnectGraceMs);
        call.graceTimers.set(key, timer);
    };

    /**
     * Участник снова на связи. Возвращает текущий звонок, чтобы приложение восстановило экран звонка.
     * @returns {{ callId: string, orderId: string, status: string, role: "caller" | "callee" } | null}
     */
    const onParticipantOnline = (user) => {
        const key = participantKey(user);
        const call = calls.get(busy.get(key));
        if (!call) return null;

        const timer = call.graceTimers.get(key);
        if (timer) {
            clearTimer(timer);
            call.graceTimers.delete(key);
        }
        const role = isSame(call.caller, user) ? "caller" : "callee";
        return { callId: call.id, orderId: call.orderId, status: call.status, role };
    };

    const recoverAfterRestart = async () => {
        const count = await repository.failStaleActiveCalls(now());
        if (count > 0) {
            logger.info(`[calls] помечено оборванными после рестарта: ${count}`);
        }
    };

    return Object.freeze({
        invite,
        accept,
        reject,
        end,
        relaySignal,
        onParticipantOffline,
        onParticipantOnline,
        recoverAfterRestart,
    });
};
