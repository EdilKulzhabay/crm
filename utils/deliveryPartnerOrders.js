import mongoose from "mongoose";

/**
 * Заказы курьеров партнёра по доставке: разбор запроса кабинета, фильтр и вид заказа для партнёра.
 *
 * Партнёр видит все заказы своих курьеров за всё время; период — необязательный фильтр.
 * Данные клиента (имя, телефоны, комментарий) партнёру не отдаются — только адрес доставки.
 */

export const ORDER_SCOPES = Object.freeze(["active", "history"]);
/** Заказы «в работе»: назначены курьеру и ещё не доставлены */
export const ACTIVE_ORDER_STATUSES = Object.freeze(["awaitingOrder", "onTheWay"]);

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isDay = (value) => typeof value === "string" && DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
/** Пустое значение — граница не задана; иначе YYYY-MM-DD; null — некорректная дата */
const readDay = (value) => (value === undefined || value === null || value === "" ? "" : isDay(value) ? value : null);

/**
 * @param {object} body — { scope, startDate?, endDate?, courierId? }
 * @param {Array<{ _id: unknown }>} couriers — курьеры партнёра
 * @returns {{ error: string } | { scope: string, startDate: string, endDate: string, couriers: object[] }}
 */
export function parsePartnerOrdersQuery(body, couriers) {
    const { scope = "history", courierId } = body ?? {};
    if (!ORDER_SCOPES.includes(scope)) return { error: "Некорректный раздел" };

    const selected = courierId ? couriers.filter((courier) => String(courier._id) === courierId) : couriers;
    if (courierId && selected.length === 0) return { error: "Курьер не найден" };
    if (scope === "active") return { scope, startDate: "", endDate: "", couriers: selected };

    const startDate = readDay(body.startDate);
    const endDate = readDay(body.endDate);
    if (startDate === null || endDate === null) return { error: "Некорректная дата" };
    if (startDate && endDate && startDate > endDate) return { error: "Начало периода позже конца" };
    return { scope, startDate, endDate, couriers: selected };
}

/**
 * Фильтр Order по разобранному запросу; null — у партнёра нет курьеров (заказов быть не может).
 * Идёт по индексу { courierAggregator: 1, "date.d": -1 }.
 */
export function buildPartnerOrdersFilter({ scope, startDate, endDate, couriers }) {
    if (couriers.length === 0) return null;
    const dayRange = {
        ...(startDate && { $gte: startDate }),
        ...(endDate && { $lte: endDate }),
    };
    return {
        courierAggregator: { $in: couriers.map((courier) => new mongoose.Types.ObjectId(String(courier._id))) },
        ...(Object.keys(dayRange).length > 0 && { "date.d": dayRange }),
        ...(scope === "active" && { status: { $in: ACTIVE_ORDER_STATUSES } }),
    };
}

/** Поля заказа, которые нужны кабинету (projection) — без клиента, телефонов и комментариев */
export const PARTNER_ORDER_FIELDS = "date status courierAggregator address.actual products sum deliveredTime createdAt";

/** Заказ в кабинете партнёра. courierNames: Map<id, ФИО> */
export const toPartnerOrder = (order, courierNames) => {
    const courierId = order.courierAggregator ? String(order.courierAggregator) : null;
    return {
        id: String(order._id),
        date: order.date?.d ?? "",
        time: order.date?.time ?? "",
        status: order.status,
        courierId,
        courierName: (courierId && courierNames.get(courierId)) || "",
        address: order.address?.actual ?? "",
        b19: order.products?.b19 ?? 0,
        b12: order.products?.b12 ?? 0,
        sum: order.sum ?? 0,
        deliveredTime: order.deliveredTime ?? null,
    };
};

/** $group для итогов периода: все заказы и доставленные (бутыли и сумма — только доставленных) */
export const PARTNER_SUMMARY_GROUP = Object.freeze({
    _id: null,
    orders: { $sum: 1 },
    delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
    b19: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, { $ifNull: ["$products.b19", 0] }, 0] } },
    b12: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, { $ifNull: ["$products.b12", 0] }, 0] } },
    sum: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, { $ifNull: ["$sum", 0] }, 0] } },
});

export const EMPTY_SUMMARY = Object.freeze({ orders: 0, delivered: 0, b19: 0, b12: 0, sum: 0 });
