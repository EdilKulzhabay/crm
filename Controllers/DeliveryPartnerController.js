import bcrypt from "bcrypt";
import CourierAggregator from "../Models/CourierAggregator.js";
import DeliveryPartner from "../Models/DeliveryPartner.js";
import Order from "../Models/Order.js";
import { createAttemptLimiter } from "../utils/attemptLimiter.js";
import {
    buildPartnerOrdersFilter,
    EMPTY_SUMMARY,
    PARTNER_ORDER_FIELDS,
    PARTNER_SUMMARY_GROUP,
    parsePartnerOrdersQuery,
    toPartnerOrder,
} from "../utils/deliveryPartnerOrders.js";
import { signDeliveryPartnerToken } from "../utils/deliveryPartnerToken.js";
import { normalizePhoneForWhatsApp } from "../whatsApp/normalizePhone.js";

/**
 * Кабинет партнёра по доставке в CRM: вход и заказы его курьеров (в работе, история, выгрузка).
 * Партнёр — только из токена (checkAuthDeliveryPartner). Управление партнёрами и привязка
 * курьеров — DeliveryPartnerAdminController (только суперадмин).
 */

const LOGIN_MAX_FAILURES = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const PAGE_SIZE = 100;
/** Выгрузка в Excel: все заказы периода, но не больше этого числа строк */
const EXPORT_LIMIT = 5000;
const COURIERS_LIMIT = 500;
const PHONE_PATTERN = /^7\d{10}$/;
const INVALID_LOGIN_MESSAGE = "Неверный телефон или пароль";
const ACCESS_CLOSED_MESSAGE = "Доступ к кабинету закрыт. Обратитесь к администратору.";
const COURIER_FIELDS = "fullName phone carNumber onTheLine deliveryPartnerLinkedAt";

const toPartnerProfile = (partner) => ({ id: String(partner._id), name: partner.name, phone: partner.phone });

const toPartnerCourier = (courier) => ({
    id: String(courier._id),
    fullName: courier.fullName,
    phone: courier.phone,
    carNumber: courier.carNumber,
    onTheLine: Boolean(courier.onTheLine),
    linkedAt: courier.deliveryPartnerLinkedAt ?? null,
});

const defaultRepo = {
    findPartnerForLogin: (phoneNormalized) => DeliveryPartner.findOne({ phoneNormalized }).select("+password").lean(),
    touchLogin: (partnerId, at) => DeliveryPartner.updateOne({ _id: partnerId }, { $set: { lastLoginAt: at } }),
    /** Индекс CourierAggregator { deliveryPartner: 1 } */
    listCouriers: (partnerId) =>
        CourierAggregator.find({ deliveryPartner: partnerId })
            .select(COURIER_FIELDS)
            .sort({ fullName: 1 })
            .limit(COURIERS_LIMIT)
            .lean(),
    listOrders: (filter, { skip, limit, sort }) =>
        Order.find(filter).select(PARTNER_ORDER_FIELDS).sort(sort).skip(skip).limit(limit).lean(),
    summarize: async (filter) => {
        const [totals] = await Order.aggregate([{ $match: filter }, { $group: PARTNER_SUMMARY_GROUP }]);
        return totals ? { orders: totals.orders, delivered: totals.delivered, b19: totals.b19, b12: totals.b12, sum: totals.sum } : EMPTY_SUMMARY;
    },
};

export function createDeliveryPartnerController({
    repo = defaultRepo,
    comparePassword = bcrypt.compare,
    signToken = signDeliveryPartnerToken,
    loginLimiter = createAttemptLimiter({ maxFailures: LOGIN_MAX_FAILURES, windowMs: ATTEMPT_WINDOW_MS }),
    now = () => new Date(),
    logger = console,
} = {}) {
    const fail = (res, status, message) => res.status(status).json({ success: false, message });
    const serverError = (res, handler, error) => {
        logger.error(`[DeliveryPartner] ${handler}:`, error?.message || error);
        return fail(res, 500, "Внутренняя ошибка сервера");
    };

    async function deliveryPartnerLogin(req, res) {
        const { phone, password } = req.body ?? {};
        const phoneNormalized = normalizePhoneForWhatsApp(phone);
        if (!phoneNormalized || !PHONE_PATTERN.test(phoneNormalized) || typeof password !== "string" || !password) {
            return fail(res, 400, "Введите телефон и пароль");
        }
        const blockedFor = loginLimiter.retryAfterSeconds(phoneNormalized);
        if (blockedFor > 0) {
            return fail(res, 429, `Слишком много неверных попыток. Повторите через ${Math.ceil(blockedFor / 60)} мин.`);
        }

        try {
            const partner = await repo.findPartnerForLogin(phoneNormalized);
            const isValid = Boolean(partner) && (await comparePassword(password, partner.password));
            if (!isValid) {
                loginLimiter.registerFailure(phoneNormalized);
                return fail(res, 401, INVALID_LOGIN_MESSAGE);
            }
            if (partner.status !== "active") return fail(res, 403, ACCESS_CLOSED_MESSAGE);
            loginLimiter.reset(phoneNormalized);
            await repo.touchLogin(partner._id, now());
            return res.json({ success: true, token: signToken(partner._id), partner: toPartnerProfile(partner) });
        } catch (error) {
            return serverError(res, "deliveryPartnerLogin", error);
        }
    }

    /** Профиль и курьеры партнёра: проверка сессии при открытии кабинета и список для фильтра */
    async function getDeliveryPartnerMe(req, res) {
        try {
            const couriers = await repo.listCouriers(req.deliveryPartner._id);
            return res.json({
                success: true,
                partner: toPartnerProfile(req.deliveryPartner),
                couriers: couriers.map(toPartnerCourier),
            });
        } catch (error) {
            return serverError(res, "getDeliveryPartnerMe", error);
        }
    }

    /**
     * { scope: "active" | "history", startDate, endDate (YYYY-MM-DD, для history), courierId?, page?, export? }
     * history — заказы за период + итоги; active — назначенные курьерам и ещё не доставленные.
     * export: true — все заказы без страниц (до EXPORT_LIMIT), для Excel.
     */
    async function getDeliveryPartnerOrders(req, res) {
        const body = req.body ?? {};
        const page = Number.isInteger(body.page) && body.page >= 0 ? body.page : 0;
        const isExport = body.export === true;

        try {
            const couriers = await repo.listCouriers(req.deliveryPartner._id);
            const query = parsePartnerOrdersQuery(body, couriers);
            if (query.error) return fail(res, 400, query.error);

            const filter = buildPartnerOrdersFilter(query);
            const isHistory = query.scope === "history";
            const empty = { success: true, orders: [], page, pageSize: PAGE_SIZE, hasMore: false, truncated: false };
            if (!filter) return res.json(isHistory ? { ...empty, summary: EMPTY_SUMMARY } : empty);

            const limit = isExport ? EXPORT_LIMIT : PAGE_SIZE;
            const [orders, summary] = await Promise.all([
                // Лишняя строка показывает, есть ли следующая страница, без отдельного countDocuments
                repo.listOrders(filter, {
                    skip: isExport ? 0 : page * PAGE_SIZE,
                    limit: limit + 1,
                    sort: isHistory ? { "date.d": -1, createdAt: -1 } : { "date.d": 1, createdAt: 1 },
                }),
                isHistory ? repo.summarize(filter) : null,
            ]);
            const courierNames = new Map(couriers.map((courier) => [String(courier._id), courier.fullName]));
            const hasMore = orders.length > limit;
            return res.json({
                success: true,
                orders: orders.slice(0, limit).map((order) => toPartnerOrder(order, courierNames)),
                page,
                pageSize: PAGE_SIZE,
                hasMore: !isExport && hasMore,
                truncated: isExport && hasMore,
                ...(summary && { summary }),
            });
        } catch (error) {
            return serverError(res, "getDeliveryPartnerOrders", error);
        }
    }

    return { deliveryPartnerLogin, getDeliveryPartnerMe, getDeliveryPartnerOrders };
}

export const { deliveryPartnerLogin, getDeliveryPartnerMe, getDeliveryPartnerOrders } = createDeliveryPartnerController();
