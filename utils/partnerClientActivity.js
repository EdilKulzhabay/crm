import Order from "../Models/Order.js";

/** Ритм заказов считается по последним RHYTHM_ORDERS доставленным заказам (два интервала) */
export const RHYTHM_ORDERS = 3;
/** Сколько последних дней доставки берём из БД: с запасом на несколько заказов в один день */
const RECENT_DELIVERY_DAYS = 10;
const ACTIVE_ORDER_STATUSES = ["awaitingOrder", "onTheWay"];
const MS_PER_DAY = 86400000;
/** «Ушедший» клиент: без заказа дольше, чем CHURN_INTERVAL_MULTIPLIER обычных интервалов */
export const CHURN_INTERVAL_MULTIPLIER = 3;

const dayOrdinal = (day) => Math.floor(Date.parse(`${day}T12:00:00Z`) / MS_PER_DAY);

export function shiftDay(day, days) {
    return new Date((dayOrdinal(day) + days) * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Ритм заказов клиента.
 * @param {string[]} deliveredDays дни доставленных заказов YYYY-MM-DD (в любом порядке, с повторами)
 * @param {string} today сегодняшний день по Алматы YYYY-MM-DD
 * @param {boolean} hasActiveOrder у клиента есть заказ в работе — значит, он не «пропал»
 * Пример: заказы 1, 4, 7 числа → интервал 3 дня; 11-го прошло 4 дня > 3 → isLapsed;
 * 17-го прошло 10 дней > 3 × 3 → isChurned («ушедший», партнёр может убрать его из списка).
 */
export function clientRhythm(deliveredDays, today, hasActiveOrder = false) {
    const days = [...new Set(deliveredDays.filter(Boolean))].sort().reverse().slice(0, RHYTHM_ORDERS);
    const lastOrderDay = days[0] ?? null;
    const daysSinceLast = lastOrderDay ? dayOrdinal(today) - dayOrdinal(lastOrderDay) : null;

    if (days.length < RHYTHM_ORDERS) {
        return {
            lastOrderDay,
            daysSinceLast,
            intervalDays: null,
            isLapsed: false,
            isChurned: false,
            hasActiveOrder,
            rhythmDays: days,
        };
    }
    const intervals = days.slice(1).map((day, i) => dayOrdinal(days[i]) - dayOrdinal(day));
    // Среднее с округлением вверх: при интервалах 3 и 4 дня ждём 4, а не 3
    const intervalDays = Math.ceil(intervals.reduce((sum, value) => sum + value, 0) / intervals.length);
    const isLapsed = !hasActiveOrder && intervalDays > 0 && daysSinceLast > intervalDays;
    const isChurned = isLapsed && daysSinceLast > intervalDays * CHURN_INTERVAL_MULTIPLIER;
    // rhythmDays — по каким дням доставки посчитан ритм (видно в CRM для проверки)
    return { lastOrderDay, daysSinceLast, intervalDays, isLapsed, isChurned, hasActiveOrder, rhythmDays: days };
}

/**
 * Партнёр убрал «ушедшего» клиента из своего списка (Client.partnerHiddenOrderDay — день последнего
 * заказа на момент удаления). Привязка к партнёру и начисления сохраняются (оферта, п. 4.8):
 * как только клиент оформляет новый заказ, он снова появляется в списке.
 */
export function isHiddenFromPartner(client, rhythm) {
    const hiddenOrderDay = client?.partnerHiddenOrderDay;
    if (!hiddenOrderDay) return false;
    return !rhythm?.hasActiveOrder && (rhythm?.lastOrderDay ?? null) === hiddenOrderDay;
}

/**
 * Ритм для набора клиентов одним агрегирующим запросом (без N+1).
 * Берутся последние доставленные заказы клиента без ограничения давности — ритм всегда строится
 * по RHYTHM_ORDERS последним доставкам. Клиент есть в результате, если у него есть хотя бы
 * один неотменённый заказ — в том числе ещё не доставленный: партнёр видит заказ сразу после оформления.
 * Сортировка идёт по индексу Order { client: 1, "date.d": -1 }.
 * @returns {Promise<Map<string, ReturnType<typeof clientRhythm>>>}
 */
export async function loadClientsRhythm(clientIds, today) {
    if (clientIds.length === 0) return new Map();
    const rows = await Order.aggregate([
        { $match: { client: { $in: clientIds }, status: { $in: ["delivered", ...ACTIVE_ORDER_STATUSES] } } },
        // $push в $group сохраняет порядок после $sort: дни доставки — от новых к старым
        { $sort: { client: 1, "date.d": -1 } },
        {
            $group: {
                _id: "$client",
                delivered: { $push: { $cond: [{ $eq: ["$status", "delivered"] }, "$date.d", null] } },
                activeCount: { $sum: { $cond: [{ $in: ["$status", ACTIVE_ORDER_STATUSES] }, 1, 0] } },
            },
        },
        // null — недоставленные заказы; убираем явно, до среза
        {
            $project: {
                activeCount: 1,
                delivered: {
                    $slice: [{ $filter: { input: "$delivered", cond: { $ne: ["$$this", null] } } }, RECENT_DELIVERY_DAYS],
                },
            },
        },
    ]).allowDiskUse(true);
    const result = new Map();
    for (const row of rows) {
        result.set(String(row._id), clientRhythm(row.delivered, today, row.activeCount > 0));
    }
    return result;
}
