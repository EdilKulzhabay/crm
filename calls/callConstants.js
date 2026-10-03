export const PARTICIPANT_TYPES = Object.freeze({
    CLIENT: "client",
    COURIER: "courier",
});

export const CALL_STATUSES = Object.freeze({
    RINGING: "ringing",
    ACCEPTED: "accepted",
    ENDED: "ended",
    REJECTED: "rejected",
    MISSED: "missed",
    CANCELLED: "cancelled",
    FAILED: "failed",
});

export const ACTIVE_CALL_STATUSES = Object.freeze([CALL_STATUSES.RINGING, CALL_STATUSES.ACCEPTED]);

export const END_REASONS = Object.freeze({
    HANGUP: "hangup",
    CANCELLED: "cancelled",
    REJECTED: "rejected",
    MISSED: "missed",
    CONNECTION_LOST: "connection_lost",
    SERVER_RESTART: "server_restart",
});

/** Сколько звонок может висеть в статусе ringing, прежде чем станет missed */
export const RING_TIMEOUT_MS = 40 * 1000;

/** Сколько ждём переподключения сокета участника (смена сети), прежде чем завершить звонок */
export const RECONNECT_GRACE_MS = 15 * 1000;

/** После доставки заказа звонить ещё можно столько времени */
export const CALL_WINDOW_AFTER_DELIVERY_MS = 30 * 60 * 1000;

export const ORDER_STATUSES_WITHOUT_CALLS = Object.freeze(["cancelled"]);

export const DELIVERED_ORDER_STATUS = "delivered";

export const SIGNAL_KINDS = Object.freeze(["offer", "answer", "ice"]);

/** SDP для аудио обычно 2–6 КБ; лимит отсекает мусор, не мешая нормальным офферам */
export const MAX_SIGNAL_PAYLOAD_BYTES = 20 * 1024;

export const CALLS_NAMESPACE = "/calls";

export const SOCKET_EVENTS = Object.freeze({
    // клиент → сервер
    INVITE: "call:invite",
    ACCEPT: "call:accept",
    REJECT: "call:reject",
    END: "call:end",
    SIGNAL: "call:signal",
    // сервер → клиент (call:signal пересылается второй стороне под тем же именем)
    INCOMING: "call:incoming",
    ACCEPTED: "call:accepted",
    ENDED: "call:ended",
    /** После переподключения: у участника есть незавершённый звонок */
    RESUME: "call:resume",
});

export const RATE_LIMITS = Object.freeze({
    INVITE: { limit: 5, windowMs: 60 * 1000 },
    SIGNAL: { limit: 300, windowMs: 10 * 1000 },
    OTHER: { limit: 30, windowMs: 10 * 1000 },
});
