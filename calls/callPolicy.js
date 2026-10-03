import {
    CALL_WINDOW_AFTER_DELIVERY_MS,
    DELIVERED_ORDER_STATUS,
    ORDER_STATUSES_WITHOUT_CALLS,
    PARTICIPANT_TYPES,
} from "./callConstants.js";

/**
 * @typedef {{ type: "client" | "courier", id: string }} Participant
 * @typedef {{
 *   id: string,
 *   status: string,
 *   clientId: string | null,
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
        return { type: PARTICIPANT_TYPES.CLIENT, id: order.clientId };
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
