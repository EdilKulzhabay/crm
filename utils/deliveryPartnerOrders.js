import mongoose from "mongoose";
import { getDateAlmaty } from "./dateUtils.js";

/**
 * Заказы курьеров партнёра по доставке: разбор запроса кабинета, фильтр и вид заказа для партнёра.
 *
 * Партнёр видит заказ курьера только с дня привязки курьера к нему (deliveryPartnerLinkedAt):
 * курьер мог раньше работать на другого партнёра, и чужая история не должна открываться.
 * Данные клиента (имя, телефоны, комментарий) партнёру не отдаются — только адрес доставки.
 */

export const ORDER_SCOPES = Object.freeze(["active", "history"]);
/** Заказы «в работе»: назначены курьеру и ещё не доставлены */
export const ACTIVE_ORDER_STATUSES = Object.freeze(["awaitingOrder", "onTheWay"]);
/** Самый длинный период истории/выгрузки — фильтр по индексу { courierAggregator, date.d } остаётся узким */
export const MAX_PERIOD_DAYS = 93;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const isDay = (value) => typeof value === "string" && DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
const laterDay = (a, b) => (a > b ? a : b);

/** День привязки курьера по Алматы (как Order.date.d); без даты — с начала истории */
const linkedDay = (courier) => (courier.deliveryPartnerLinkedAt ? getDateAlmaty(courier.deliveryPartnerLinkedAt) : "");

/**
 * @param {object} body — { scope, startDate, endDate, courierId }
 * @param {Array<{ _id: unknown }>} couriers — курьеры партнёра
 * @returns {{ error: string } | { scope: string, startDate?: string, endDate?: string, couriers: object[] }}
 */
export function parsePartnerOrdersQuery(body, couriers) {
    const { scope = "history", startDate, endDate, courierId } = body ?? {};
    if (!ORDER_SCOPES.includes(scope)) return { error: "Некорректный раздел" };

    const selected = courierId ? couriers.filter((courier) => String(courier._id) === courierId) : couriers;
    if (courierId && selected.length === 0) return { error: "Курьер не найден" };
    if (scope === "active") return { scope, couriers: selected };

    if (!isDay(startDate) || !isDay(endDate)) return { error: "Укажите период" };
    if (startDate > endDate) return { error: "Начало периода позже конца" };
    if (daysBetween(startDate, endDate) >= MAX_PERIOD_DAYS) {
        return { error: `Период — не больше ${MAX_PERIOD_DAYS} дней` };
    }
    return { scope, startDate, endDate, couriers: selected };
}

/**
 * Фильтр Order по разобранному запросу; null — у партнёра нет курьеров (заказов быть не может).
 * Одно условие на курьера — каждое идёт по индексу { courierAggregator: 1, "date.d": -1 }.
 */
export function buildPartnerOrdersFilter({ scope, startDate, endDate, couriers }) {
    if (couriers.length === 0) return null;
    const conditions = couriers.map((courier) => {
        const fromDay = laterDay(startDate ?? "", linkedDay(courier));
        const dayRange = {
            ...(fromDay && { $gte: fromDay }),
            ...(endDate && { $lte: endDate }),
        };
        return {
            courierAggregator: new mongoose.Types.ObjectId(String(courier._id)),
            ...(Object.keys(dayRange).length > 0 && { "date.d": dayRange }),
            ...(scope === "active" && { status: { $in: ACTIVE_ORDER_STATUSES } }),
        };
    });
    return conditions.length === 1 ? conditions[0] : { $or: conditions };
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
