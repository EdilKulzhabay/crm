/**
 * Удаление заказа из CRM, пока он у курьера, запрещено — сначала его нужно снять с курьера.
 * Завершённые и отменённые заказы курьер уже не везёт — их удалять можно, даже если курьер в них записан.
 */

/** Статусы, в которых заказ больше не в работе у курьера */
export const FINISHED_ORDER_STATUSES = Object.freeze(["delivered", "cancelled"]);

/**
 * Назначен ли заказ курьеру: старый курьер (`Order.courier`) или курьер-агрегатор (`Order.courierAggregator`).
 * @param {{ courier?: unknown, courierAggregator?: unknown } | null | undefined} order
 * @returns {boolean}
 */
export function isOrderAssignedToCourier(order) {
    return Boolean(order?.courier || order?.courierAggregator);
}

/**
 * Запрещено ли удаление: заказ назначен курьеру и ещё не доставлен и не отменён.
 * @param {{ status?: string, courier?: unknown, courierAggregator?: unknown } | null | undefined} order
 * @returns {boolean}
 */
export function isOrderDeletionBlocked(order) {
    return isOrderAssignedToCourier(order) && !FINISHED_ORDER_STATUSES.includes(order?.status);
}

/** Фильтр Mongo «заказ не назначен курьеру» */
export const UNASSIGNED_ORDER_FILTER = Object.freeze({
    $and: [
        { $or: [{ courier: null }, { courier: { $exists: false } }] },
        { $or: [{ courierAggregator: null }, { courierAggregator: { $exists: false } }] },
    ],
});

/** Фильтр Mongo «заказ можно удалить» — для атомарного удаления (условие то же, что isOrderDeletionBlocked) */
export const DELETABLE_ORDER_FILTER = Object.freeze({
    $or: [{ status: { $in: FINISHED_ORDER_STATUSES } }, UNASSIGNED_ORDER_FILTER],
});
