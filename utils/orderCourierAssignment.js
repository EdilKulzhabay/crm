/**
 * Назначен ли заказ курьеру: старый курьер (`Order.courier`) или курьер-агрегатор (`Order.courierAggregator`).
 * Такой заказ нельзя удалить из CRM — сначала его нужно снять с курьера.
 * @param {{ courier?: unknown, courierAggregator?: unknown } | null | undefined} order
 * @returns {boolean}
 */
export function isOrderAssignedToCourier(order) {
    return Boolean(order?.courier || order?.courierAggregator);
}

/** Фильтр Mongo «заказ не назначен курьеру» — для атомарного удаления */
export const UNASSIGNED_ORDER_FILTER = Object.freeze({
    $and: [
        { $or: [{ courier: null }, { courier: { $exists: false } }] },
        { $or: [{ courierAggregator: null }, { courierAggregator: { $exists: false } }] },
    ],
});
