import {
    CALL_WINDOW_AFTER_DELIVERY_MS,
    DELIVERED_ORDER_STATUS,
    ORDER_STATUSES_WITHOUT_CALLS,
    PARTICIPANT_TYPES,
} from "./callConstants.js";

/**
 * Участник звонка. deviceId — конкретное устройство аккаунта: когда задан, звонок и все его
 * события идут только на это устройство (несколько человек под одним аккаунтом клиента).
 * @typedef {{ type: "client" | "courier", id: string, deviceId?: string | null }} Participant
 * @typedef {{
 *   id: string,
 *   status: string,
 *   clientId: string | null,
 *   clientDeviceId?: string | null,
 *   courierId: string | null,
 *   deliveredTime: Date | null,
 *   clientName: string,
 *   courierName: string,
 * }} CallOrder
 */

/**
 * Возвращает вторую сторону звонка по заказу или null, если participant не участник заказа.
 * @param {CallOrder} order
 * @param {Participant} participant
 * @returns {Participant | null}
 */
export const getCounterpart = (order, participant) => {
    if (!order.clientId || !order.courierId) return null;

    if (participant.type === PARTICIPANT_TYPES.CLIENT && participant.id === order.clientId) {
        return { type: PARTICIPANT_TYPES.COURIER, id: order.courierId };
    }
    if (participant.type === PARTICIPANT_TYPES.COURIER && participant.id === order.courierId) {
        // Звонок курьера — на устройство, с которого клиент оформил заказ
        return { type: PARTICIPANT_TYPES.CLIENT, id: order.clientId, deviceId: order.clientDeviceId ?? null };
    }
    return null;
};

/**
 * Звонить можно с момента назначения курьера и до CALL_WINDOW_AFTER_DELIVERY_MS после доставки.
 * @param {CallOrder} order
 * @param {Date} now
 * @returns {boolean}
 */
export const isOrderCallable = (order, now) => {
    if (!order.courierId) return false;
    if (ORDER_STATUSES_WITHOUT_CALLS.includes(order.status)) return false;

    if (order.status === DELIVERED_ORDER_STATUS) {
        if (!order.deliveredTime) return false;
        return now.getTime() - order.deliveredTime.getTime() <= CALL_WINDOW_AFTER_DELIVERY_MS;
    }
    return true;
};

/**
 * @param {Participant} participant
 * @returns {string}
 */
export const participantKey = (participant) => `${participant.type}:${participant.id}`;

/** Идентификатор установки приложения: UUID или похожая строка, без спецсимволов */
const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Неверный deviceId не ломает звонки: участник просто считается «без устройства».
 * @param {unknown} value
 * @returns {string | null}
 */
export const parseDeviceId = (value) => (typeof value === "string" && DEVICE_ID_PATTERN.test(value) ? value : null);

/**
 * Комната Socket.io стороны звонка: устройство, если оно известно, иначе весь аккаунт.
 * @param {Participant} participant
 * @returns {string}
 */
export const participantRoom = (participant) =>
    participant.deviceId ? `${participantKey(participant)}:device:${participant.deviceId}` : participantKey(participant);

/**
 * Может ли user действовать за сторону звонка side: тот же аккаунт и, если сторона
 * привязана к устройству, то же устройство.
 * @param {Participant} side
 * @param {Participant} user
 * @returns {boolean}
 */
export const isActingAs = (side, user) =>
    participantKey(side) === participantKey(user) && (!side.deviceId || side.deviceId === user.deviceId);
