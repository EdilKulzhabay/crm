/**
 * Сопоставление сохранённого адреса клиента с заказами и расчёт:
 * lastOrderDate, orderPeriodicityDays (по до 5 последним доставленным), shouldOrderBySchedule.
 */
import { getDateAlmaty } from "./dateUtils.js";

const MAX_ORDERS_FOR_PERIOD = 5;
const POINT_MATCH_MAX_M = 120;

function normalizeStr(s) {
    return String(s || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function normalizeActualLoose(s) {
    return normalizeStr(s)
        .replace(/кв\.?\s*/g, "кв ")
        .replace(/квартира\s*/g, "кв ")
        .replace(/офис\s*/g, "кв ")
        .replace(/,\s*этаж\s*/g, " этаж ");
}

/** Как в мобильном приложении (AddOrderScreen) */
export function buildActualMobileStyle(addr) {
    if (!addr) return "";
    let s = addr.street || "";
    if (addr.floor) s += `, этаж ${addr.floor}`;
    if (addr.apartment) s += `, квартира ${addr.apartment}`;
    return s;
}

/** Как в CRM AddOrder.js (clientType — с документа Client: false → «офис») */
export function buildActualCrmStyle(addr, clientType = true) {
    if (!addr) return "";
    const house = addr.house ? String(addr.house) : "";
    const apt = addr.apartment
        ? (clientType === false ? "офис " : "кв. ") + String(addr.apartment)
        : "";
    return [addr.street || "", house, apt].filter(Boolean).join(" ").trim();
}

function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function pointMatch(order, saved) {
    const olat = order?.address?.point?.lat;
    const olon = order?.address?.point?.lon;
    const slat = saved?.point?.lat;
    const slon = saved?.point?.lon;
    if (
        typeof olat !== "number" ||
        typeof olon !== "number" ||
        typeof slat !== "number" ||
        typeof slon !== "number"
    ) {
        return false;
    }
    return haversineM(olat, olon, slat, slon) <= POINT_MATCH_MAX_M;
}

/**
 * Заказ относится к сохранённому адресу клиента (доставленные заказы уже отфильтрованы снаружи).
 * @param {boolean} [clientType] — client.clientType с документа Client (для строки actual как в CRM)
 */
export function orderMatchesSavedAddress(order, saved, clientType = true) {
    const ol = (order?.address?.link || "").trim();
    const sl = (saved?.link || "").trim();
    if (ol && sl && normalizeStr(ol) === normalizeStr(sl)) {
        return true;
    }

    const oa = normalizeActualLoose(order?.address?.actual || "");
    if (oa) {
        const mobile = normalizeActualLoose(buildActualMobileStyle(saved));
        const crm = normalizeActualLoose(buildActualCrmStyle(saved, clientType));
        const candidates = [mobile, crm].filter(Boolean);
        for (const c of candidates) {
            if (!c) continue;
            if (c === oa || oa.includes(c) || c.includes(oa)) {
                return true;
            }
        }
    }

    return pointMatch(order, saved);
}

function addCalendarDaysFromYmd(ymd, n) {
    const parts = ymd.split("-").map(Number);
    if (parts.length !== 3 || parts.some((x) => Number.isNaN(x))) {
        return ymd;
    }
    const [y, mo, d] = parts;
    const t = Date.UTC(y, mo - 1, d) + Number(n) * 86400000;
    return getDateAlmaty(new Date(t));
}

/**
 * @param {Array<{ createdAt: Date|string }>} ordersNewestFirst — до 5 заказов, от нового к старому
 */
export function computeAddressStatsFromOrders(ordersNewestFirst) {
    const list = Array.isArray(ordersNewestFirst) ? ordersNewestFirst : [];
    if (list.length === 0) {
        return {
            lastOrderDate: null,
            orderPeriodicityDays: null,
            shouldOrderBySchedule: false,
        };
    }

    const lastOrderDate = list[0].createdAt
        ? new Date(list[0].createdAt)
        : null;

    if (list.length < 2 || !lastOrderDate) {
        return {
            lastOrderDate,
            orderPeriodicityDays: null,
            shouldOrderBySchedule: false,
        };
    }

    const gaps = [];
    for (let i = 0; i < list.length - 1; i++) {
        const newer = new Date(list[i].createdAt).getTime();
        const older = new Date(list[i + 1].createdAt).getTime();
        const days = (newer - older) / 86400000;
        if (Number.isFinite(days) && days >= 0) {
            gaps.push(days);
        }
    }

    if (gaps.length === 0) {
        return {
            lastOrderDate,
            orderPeriodicityDays: null,
            shouldOrderBySchedule: false,
        };
    }

    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const orderPeriodicityDays = Math.max(1, Math.round(avg));

    const todayYmd = getDateAlmaty();
    const lastYmd = getDateAlmaty(lastOrderDate);
    const dueYmd = addCalendarDaysFromYmd(lastYmd, orderPeriodicityDays);
    const shouldOrderBySchedule = todayYmd >= dueYmd;

    return {
        lastOrderDate,
        orderPeriodicityDays,
        shouldOrderBySchedule,
    };
}

/**
 * Обновляет поля lastOrderDate / orderPeriodicityDays / shouldOrderBySchedule у всех адресов клиента.
 * @param {import('mongoose').Document} client — документ Client с populated или lean addresses
 * @param {Array} deliveredOrders — все доставленные заказы клиента, лучше отсортировать createdAt desc
 */
export function buildUpdatedAddressesWithStats(client, deliveredOrders) {
    const addresses = client.addresses || [];
    const clientType = client.clientType;
    const sorted = [...deliveredOrders].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return addresses.map((addr) => {
        const plain =
            typeof addr.toObject === "function" ? addr.toObject() : { ...addr };
        const forAddr = sorted
            .filter((o) => orderMatchesSavedAddress(o, plain, clientType))
            .slice(0, MAX_ORDERS_FOR_PERIOD);
        const stats = computeAddressStatsFromOrders(forAddr);
        return {
            ...plain,
            lastOrderDate: stats.lastOrderDate,
            orderPeriodicityDays: stats.orderPeriodicityDays,
            shouldOrderBySchedule: stats.shouldOrderBySchedule,
        };
    });
}
