import Order from "../Models/Order.js";

/** Ритм заказов считается по последним RHYTHM_ORDERS доставленным заказам (два интервала) */
export const RHYTHM_ORDERS = 3;
/** Насколько далеко в прошлое смотреть: старше — ритм уже не актуален */
export const ACTIVITY_WINDOW_DAYS = 180;
const ACTIVE_ORDER_STATUSES = ["awaitingOrder", "onTheWay"];
const MS_PER_DAY = 86400000;

const dayOrdinal = (day) => Math.floor(Date.parse(`${day}T12:00:00Z`) / MS_PER_DAY);

export function shiftDay(day, days) {
    return new Date((dayOrdinal(day) + days) * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Ритм заказов клиента.
 * @param {string[]} deliveredDays дни доставленных заказов YYYY-MM-DD (в любом порядке, с повторами)
 * @param {string} today сегодняшний день по Алматы YYYY-MM-DD
 * @param {boolean} hasActiveOrder у клиента есть заказ в работе — значит, он не «пропал»
 * Пример: заказы 1, 4, 7 числа → интервал 3 дня; 11-го прошло 4 дня > 3 → isLapsed.
 */
export function clientRhythm(deliveredDays, today, hasActiveOrder = false) {
    const days = [...new Set(deliveredDays.filter(Boolean))].sort().reverse().slice(0, RHYTHM_ORDERS);
    const lastOrderDay = days[0] ?? null;
    const daysSinceLast = lastOrderDay ? dayOrdinal(today) - dayOrdinal(lastOrderDay) : null;

    if (days.length < RHYTHM_ORDERS) {
        return { lastOrderDay, daysSinceLast, intervalDays: null, isLapsed: false, hasActiveOrder };
    }
    const intervals = days.slice(1).map((day, i) => dayOrdinal(days[i]) - dayOrdinal(day));
    // Среднее с округлением вверх: при интервалах 3 и 4 дня ждём 4, а не 3
    const intervalDays = Math.ceil(intervals.reduce((sum, value) => sum + value, 0) / intervals.length);
    const isLapsed = !hasActiveOrder && intervalDays > 0 && daysSinceLast > intervalDays;
    return { lastOrderDay, daysSinceLast, intervalDays, isLapsed, hasActiveOrder };
}

/**
 * Ритм для набора клиентов одним агрегирующим запросом (без N+1).
 * Клиент есть в результате, если у него есть хотя бы один неотменённый заказ за окно — в том числе
 * ещё не доставленный: партнёр видит заказ сразу после оформления, а не только после доставки.
 * Использует индекс Order { client: 1, "date.d": -1 }.
 * @returns {Promise<Map<string, ReturnType<typeof clientRhythm>>>}
 */
export async function loadClientsRhythm(clientIds, today) {
    if (clientIds.length === 0) return new Map();
    const since = shiftDay(today, -ACTIVITY_WINDOW_DAYS);
    const rows = await Order.aggregate([
        {
            $match: {
                client: { $in: clientIds },
                status: { $in: ["delivered", ...ACTIVE_ORDER_STATUSES] },
                "date.d": { $gte: since },
            },
        },
        {
            $group: {
                _id: "$client",
                delivered: { $push: { $cond: [{ $eq: ["$status", "delivered"] }, "$date.d", null] } },
                activeCount: { $sum: { $cond: [{ $in: ["$status", ACTIVE_ORDER_STATUSES] }, 1, 0] } },
            },
        },
    ]);
    const result = new Map();
    for (const row of rows) {
        result.set(String(row._id), clientRhythm(row.delivered, today, row.activeCount > 0));
    }
    return result;
}
