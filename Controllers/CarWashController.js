import bcrypt from "bcrypt";
import CarWash from "../Models/CarWash.js";
import Client from "../Models/Client.js";
import CarWashCoupon from "../Models/CarWashCoupon.js";
import CarWashCouponEngagement from "../Models/CarWashCouponEngagement.js";
import CarWashUser from "../Models/CarWashUser.js";
import { sendCarWashRedemptionTelegram } from "../telegram/sendCarWashRedemption.js";
import { createAttemptLimiter } from "../utils/attemptLimiter.js";
import { CarWashCouponError, redeemCarWashCoupon as redeemCoupon } from "../utils/carWashCoupon.js";
import { signCarWashToken } from "../utils/carWashToken.js";
import { normalizePhoneForWhatsApp } from "../whatsApp/normalizePhone.js";

/**
 * Купоны на мойку: кабинет сотрудника мойки в CRM (вход, погашение, история точки)
 * и список купонов клиента для мобильного приложения.
 * Управление мойками и сотрудниками — CarWashAdminController (только суперадмин).
 */

const LOGIN_MAX_FAILURES = 5;
const REDEEM_MAX_FAILURES = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const REDEMPTIONS_LIMIT = 50;
const CLIENT_COUPONS_LIMIT = 20;
const CAR_WASHES_LIMIT = 100;
const PHONE_PATTERN = /^7\d{10}$/;
const INVALID_LOGIN_MESSAGE = "Неверный телефон или пароль";
const ACCESS_CLOSED_MESSAGE = "Доступ к кабинету закрыт. Обратитесь к администратору.";
const CAR_WASH_PUBLIC_FIELDS = "name address city phone mapUrl";

/** Событие статистики из приложения → поля счётчика и даты в CarWashCouponEngagement */
const ENGAGEMENT_EVENTS = Object.freeze({
    buttonClick: { counter: "buttonClicks", lastAt: "lastButtonClickAt" },
    screenView: { counter: "screenViews", lastAt: "lastScreenViewAt" },
});

/** HTTP-статус по причине отказа погашения */
const REDEEM_ERROR_STATUS = Object.freeze({ INVALID_CODE: 400, NOT_FOUND: 404, USED: 409, EXPIRED: 410 });
/** Ошибки, похожие на подбор кода, — их считаем; «использован» и «истёк» — настоящие коды */
const GUESSING_ERRORS = new Set(["INVALID_CODE", "NOT_FOUND"]);

const toRedemption = (coupon) => ({
    id: String(coupon._id),
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    usedAt: coupon.usedAt,
    carWashName: coupon.carWashName,
    usedByName: coupon.usedByName,
});

export const toCarWash = (carWash) => ({
    id: String(carWash._id),
    name: carWash.name,
    address: carWash.address,
    city: carWash.city,
    phone: carWash.phone,
    mapUrl: carWash.mapUrl || "",
});

const toCarWashUser = (user) => ({ id: String(user._id), fullName: user.fullName, phone: user.phone });

const defaultRepo = {
    findUserForLogin: (phoneNormalized) => CarWashUser.findOne({ phoneNormalized }).select("+password").lean(),
    findCarWash: (id) => CarWash.findById(id).lean(),
    touchLogin: (userId, now) => CarWashUser.updateOne({ _id: userId }, { $set: { lastLoginAt: now } }),
    /** Индекс CarWashCoupon { carWash: 1, usedAt: -1 } */
    listRedemptions: (carWashId) =>
        CarWashCoupon.find({ carWash: carWashId, status: "used" }).sort({ usedAt: -1 }).limit(REDEMPTIONS_LIMIT).lean(),
    /** Индекс CarWashCoupon { client: 1, status: 1, expiresAt: -1 } */
    listClientCoupons: (clientId, now) =>
        CarWashCoupon.find({ client: clientId, status: "active", expiresAt: { $gt: now } })
            .select("code discountPercent expiresAt order")
            .sort({ expiresAt: 1 })
            .limit(CLIENT_COUPONS_LIMIT)
            .lean(),
    listActiveCarWashes: () =>
        CarWash.find({ status: "active" }).select(CAR_WASH_PUBLIC_FIELDS).sort({ name: 1 }).limit(CAR_WASHES_LIMIT).lean(),
    findClient: (clientId) => Client.findById(clientId).select("fullName userName phone mail").lean(),
    /** Одна запись на клиента (уникальный client): upsert + $inc атомарны */
    trackEngagement: (clientId, { counter, lastAt }, at) =>
        CarWashCouponEngagement.updateOne(
            { client: clientId },
            { $inc: { [counter]: 1 }, $set: { [lastAt]: at } },
            { upsert: true }
        ),
};

export function createCarWashController({
    repo = defaultRepo,
    comparePassword = bcrypt.compare,
    signToken = signCarWashToken,
    redeem = redeemCoupon,
    loginLimiter = createAttemptLimiter({ maxFailures: LOGIN_MAX_FAILURES, windowMs: ATTEMPT_WINDOW_MS }),
    redeemLimiter = createAttemptLimiter({ maxFailures: REDEEM_MAX_FAILURES, windowMs: ATTEMPT_WINDOW_MS }),
    notifyRedemption = sendCarWashRedemptionTelegram,
    now = () => new Date(),
    logger = console,
} = {}) {
    const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });
    const tooManyAttempts = (res, seconds) =>
        fail(res, 429, `Слишком много неверных попыток. Повторите через ${Math.ceil(seconds / 60)} мин.`);

    async function carWashLogin(req, res) {
        const { phone, password } = req.body ?? {};
        const phoneNormalized = normalizePhoneForWhatsApp(phone);
        if (!phoneNormalized || !PHONE_PATTERN.test(phoneNormalized) || typeof password !== "string" || !password) {
            return fail(res, 400, "Введите телефон и пароль");
        }
        const blockedFor = loginLimiter.retryAfterSeconds(phoneNormalized);
        if (blockedFor > 0) return tooManyAttempts(res, blockedFor);

        try {
            const user = await repo.findUserForLogin(phoneNormalized);
            const isValid = Boolean(user) && (await comparePassword(password, user.password));
            if (!isValid) {
                loginLimiter.registerFailure(phoneNormalized);
                return fail(res, 401, INVALID_LOGIN_MESSAGE);
            }
            const carWash = await repo.findCarWash(user.carWash);
            if (user.status !== "active" || carWash?.status !== "active") return fail(res, 403, ACCESS_CLOSED_MESSAGE);

            loginLimiter.reset(phoneNormalized);
            await repo.touchLogin(user._id, now());
            return res.json({
                success: true,
                token: signToken(user._id),
                user: toCarWashUser(user),
                carWash: toCarWash(carWash),
            });
        } catch (error) {
            logger.error("[CarWash] carWashLogin:", error?.message || error);
            return fail(res, 500, "Внутренняя ошибка сервера");
        }
    }

    /** Профиль для кабинета: проверка сессии при открытии страницы */
    async function getCarWashMe(req, res) {
        return res.json({ success: true, user: toCarWashUser(req.carWashUser), carWash: toCarWash(req.carWash) });
    }

    /** Telegram-уведомление о погашении: не задерживает ответ сотруднику, ошибки только в лог */
    function announceRedemption(coupon, carWashUser, carWash) {
        Promise.resolve()
            .then(() => repo.findClient(coupon.client))
            .then((client) => notifyRedemption({ coupon, client, carWash, carWashUser }))
            .then((result) => {
                if (!result?.ok) logger.error("[CarWash] Telegram о погашении не отправлен:", result?.error);
            })
            .catch((error) => logger.error("[CarWash] Telegram о погашении:", error?.message || error));
    }

    async function redeemCarWashCoupon(req, res) {
        const limiterKey = String(req.carWashUser._id);
        const blockedFor = redeemLimiter.retryAfterSeconds(limiterKey);
        if (blockedFor > 0) return tooManyAttempts(res, blockedFor);

        try {
            const coupon = await redeem({ rawCode: req.body?.code, user: req.carWashUser, carWash: req.carWash });
            logger.log?.(`[CarWash] купон ${coupon.code} погашен: мойка ${req.carWash._id}, сотрудник ${limiterKey}`);
            announceRedemption(coupon, req.carWashUser, req.carWash);
            return res.json({ success: true, coupon: toRedemption(coupon) });
        } catch (error) {
            if (error instanceof CarWashCouponError) {
                if (GUESSING_ERRORS.has(error.code)) redeemLimiter.registerFailure(limiterKey);
                return fail(res, REDEEM_ERROR_STATUS[error.code] ?? 400, error.message, { code: error.code });
            }
            logger.error("[CarWash] redeemCarWashCoupon:", error?.message || error);
            return fail(res, 500, "Внутренняя ошибка сервера");
        }
    }

    async function getCarWashRedemptions(req, res) {
        try {
            const coupons = await repo.listRedemptions(req.carWash._id);
            return res.json({ success: true, redemptions: coupons.map(toRedemption) });
        } catch (error) {
            logger.error("[CarWash] getCarWashRedemptions:", error?.message || error);
            return fail(res, 500, "Внутренняя ошибка сервера");
        }
    }

    /** Клиентское приложение: действующие купоны и где их использовать. Клиент — только из токена */
    async function getCarWashCouponsMobile(req, res) {
        try {
            const coupons = await repo.listClientCoupons(req.userId, now());
            const carWashes = coupons.length > 0 ? await repo.listActiveCarWashes() : [];
            return res.json({
                success: true,
                coupons: coupons.map((coupon) => ({
                    id: String(coupon._id),
                    code: coupon.code,
                    discountPercent: coupon.discountPercent,
                    expiresAt: coupon.expiresAt,
                    // Заказ, за который выдан купон: приложение показывает купон в его деталях
                    orderId: coupon.order ? String(coupon.order) : null,
                })),
                carWashes: carWashes.map(toCarWash),
            });
        } catch (error) {
            logger.error("[CarWash] getCarWashCouponsMobile:", error?.message || error);
            return fail(res, 500, "Внутренняя ошибка сервера");
        }
    }

    /** Приложение: нажатие кнопки купона на главной / открытие экрана с кодом. Клиент — только из токена */
    async function trackCarWashCouponEvent(req, res) {
        const fields = Object.hasOwn(ENGAGEMENT_EVENTS, req.body?.event) ? ENGAGEMENT_EVENTS[req.body.event] : null;
        if (!fields) return fail(res, 400, "Неизвестное событие");
        try {
            await repo.trackEngagement(req.userId, fields, now());
            return res.json({ success: true });
        } catch (error) {
            logger.error("[CarWash] trackCarWashCouponEvent:", error?.message || error);
            return fail(res, 500, "Внутренняя ошибка сервера");
        }
    }

    return {
        carWashLogin,
        getCarWashMe,
        redeemCarWashCoupon,
        getCarWashRedemptions,
        getCarWashCouponsMobile,
        trackCarWashCouponEvent,
    };
}

export const {
    carWashLogin,
    getCarWashMe,
    redeemCarWashCoupon,
    getCarWashRedemptions,
    getCarWashCouponsMobile,
    trackCarWashCouponEvent,
} = createCarWashController();
