import bcrypt from "bcrypt";
import mongoose from "mongoose";
import CarWash, { CAR_WASH_STATUSES } from "../Models/CarWash.js";
import CarWashCoupon from "../Models/CarWashCoupon.js";
import CarWashCouponEngagement from "../Models/CarWashCouponEngagement.js";
import CarWashUser, { CAR_WASH_USER_STATUSES } from "../Models/CarWashUser.js";
import { parsePeriod } from "../utils/partnerAnalytics.js";
import { normalizeTwoGisUrl } from "../utils/twoGisUrl.js";
import { normalizePhoneForWhatsApp } from "../whatsApp/normalizePhone.js";
import { toCarWash } from "./CarWashController.js";

/**
 * CRM, суперадмин: автомойки, их сотрудники и история купонов.
 * Мойки и сотрудники не удаляются, а блокируются — история погашений ссылается на них.
 */

const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 72; // bcrypt учитывает только первые 72 байта
const TEXT_MAX_LENGTH = { name: 100, address: 300, city: 100, phone: 30, fullName: 100 };
const DEFAULT_CITY = "Алматы";
const CAR_WASHES_LIMIT = 500;
const HISTORY_PAGE_SIZE = 100;
const PHONE_PATTERN = /^7\d{10}$/;
const MONGO_DUPLICATE_KEY = 11000;

const isId = (value) => typeof value === "string" && mongoose.isValidObjectId(value);
/** Обрезанная строка; null — длиннее maxLength */
const readText = (value, maxLength) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length <= maxLength ? text : null;
};

/** Условие по полю даты за период parsePeriod (дни по Алматы, как фильтр «Партнёры») */
const dateMatch = (field, { from, to }) =>
    !from && !to ? {} : { [field]: { ...(from && { $gte: from }), ...(to && { $lt: to }) } };

const groupByCarWash = (users) =>
    users.reduce((groups, user) => {
        const key = String(user.carWash);
        return groups.set(key, [...(groups.get(key) ?? []), user]);
    }, new Map());

const toAdminUser = (user) => ({
    id: String(user._id),
    fullName: user.fullName,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
});

const toAdminCarWash = (carWash, users = []) => ({ ...toCarWash(carWash), status: carWash.status, users });

const defaultRepo = {
    listCarWashes: () => CarWash.find().sort({ status: 1, name: 1 }).limit(CAR_WASHES_LIMIT).lean(),
    /** Индекс CarWashUser { carWash: 1, status: 1 } */
    listUsers: (carWashIds) => CarWashUser.find({ carWash: { $in: carWashIds } }).sort({ fullName: 1 }).lean(),
    createCarWash: async (data) => (await CarWash.create(data)).toObject(),
    updateCarWash: (id, update) => CarWash.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean(),
    carWashExists: async (id) => Boolean(await CarWash.exists({ _id: id })),
    createUser: async (data) => (await CarWashUser.create(data)).toObject(),
    updateUser: (id, update) => CarWashUser.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean(),
    listRedemptions: (filter, page) =>
        CarWashCoupon.find(filter)
            .select("code discountPercent usedAt carWashName usedByName client")
            .populate("client", "userName phone")
            .sort({ usedAt: -1 })
            .skip(page * HISTORY_PAGE_SIZE)
            .limit(HISTORY_PAGE_SIZE)
            .lean(),
    countCoupons: (filter) => CarWashCoupon.countDocuments(filter),
    /** Один проход по коллекции (запись на клиента): сколько клиентов нажимали кнопку и всего просмотров экрана */
    engagementTotals: async () => {
        const [totals] = await CarWashCouponEngagement.aggregate([
            {
                $group: {
                    _id: null,
                    clickedClients: { $sum: { $cond: [{ $gt: ["$buttonClicks", 0] }, 1, 0] } },
                    screenViews: { $sum: "$screenViews" },
                },
            },
        ]);
        return { clickedClients: totals?.clickedClients ?? 0, screenViews: totals?.screenViews ?? 0 };
    },
};

export function createCarWashAdminController({
    repo = defaultRepo,
    hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS),
    logger = console,
} = {}) {
    const fail = (res, status, message) => res.status(status).json({ success: false, message });
    const serverError = (res, handler, error) => {
        logger.error(`[CarWash admin] ${handler}:`, error?.message || error);
        return fail(res, 500, "Внутренняя ошибка сервера");
    };

    /** @returns {{ data: object } | { error: string }} */
    function readCarWashInput(body) {
        const name = readText(body.name, TEXT_MAX_LENGTH.name);
        const address = readText(body.address, TEXT_MAX_LENGTH.address);
        const city = readText(body.city, TEXT_MAX_LENGTH.city);
        const phone = readText(body.phone, TEXT_MAX_LENGTH.phone);
        if (name === null || address === null || city === null || phone === null) return { error: "Слишком длинное значение" };
        if (!name || !address) return { error: "Укажите название и адрес мойки" };
        const mapUrl = normalizeTwoGisUrl(body.mapUrl);
        if (mapUrl === null) return { error: "Ссылка должна вести на 2ГИС, например https://2gis.kz/almaty/firm/…" };
        return { data: { name, address, city: city || DEFAULT_CITY, phone, mapUrl } };
    }

    /** @returns {{ data: object } | { error: string }} */
    function readUserInput(body, isNew) {
        const fullName = readText(body.fullName, TEXT_MAX_LENGTH.fullName);
        const phone = readText(body.phone, TEXT_MAX_LENGTH.phone);
        const phoneNormalized = phone ? normalizePhoneForWhatsApp(phone) : null;
        const password = typeof body.password === "string" ? body.password : "";
        if (!fullName) return { error: "Укажите имя сотрудника" };
        if (!phoneNormalized || !PHONE_PATTERN.test(phoneNormalized)) return { error: "Некорректный номер телефона" };
        if ((isNew || password) && (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)) {
            return { error: `Пароль — от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов` };
        }
        return { data: { carWash: body.carWashId, fullName, phone, phoneNormalized }, password };
    }

    async function getCarWashesAdmin(_req, res) {
        try {
            const carWashes = await repo.listCarWashes();
            const users = carWashes.length ? await repo.listUsers(carWashes.map((carWash) => carWash._id)) : [];
            const usersByCarWash = groupByCarWash(users);
            return res.json({
                success: true,
                carWashes: carWashes.map((carWash) =>
                    toAdminCarWash(carWash, (usersByCarWash.get(String(carWash._id)) ?? []).map(toAdminUser))
                ),
            });
        } catch (error) {
            return serverError(res, "getCarWashesAdmin", error);
        }
    }

    /** Без carWashId — создать, с ним — изменить данные точки */
    async function saveCarWashAdmin(req, res) {
        const body = req.body ?? {};
        if (body.carWashId !== undefined && !isId(body.carWashId)) return fail(res, 400, "Некорректная мойка");
        const input = readCarWashInput(body);
        if (input.error) return fail(res, 400, input.error);

        try {
            const carWash = body.carWashId
                ? await repo.updateCarWash(body.carWashId, input.data)
                : await repo.createCarWash({ ...input.data, createdBy: req.userId });
            if (!carWash) return fail(res, 404, "Мойка не найдена");
            return res.json({ success: true, carWash: toAdminCarWash(carWash) });
        } catch (error) {
            return serverError(res, "saveCarWashAdmin", error);
        }
    }

    async function setCarWashStatusAdmin(req, res) {
        const { carWashId, status } = req.body ?? {};
        if (!isId(carWashId) || !CAR_WASH_STATUSES.includes(status)) return fail(res, 400, "Некорректные данные");
        try {
            const carWash = await repo.updateCarWash(carWashId, { status });
            if (!carWash) return fail(res, 404, "Мойка не найдена");
            return res.json({ success: true, status: carWash.status });
        } catch (error) {
            return serverError(res, "setCarWashStatusAdmin", error);
        }
    }

    /**
     * Без userId — создать сотрудника (пароль обязателен), с ним — изменить.
     * При изменении пустой пароль = оставить прежний.
     */
    async function saveCarWashUserAdmin(req, res) {
        const body = req.body ?? {};
        const isNew = body.userId === undefined;
        if (!isNew && !isId(body.userId)) return fail(res, 400, "Некорректный сотрудник");
        if (!isId(body.carWashId)) return fail(res, 400, "Выберите мойку");
        const input = readUserInput(body, isNew);
        if (input.error) return fail(res, 400, input.error);

        try {
            if (!(await repo.carWashExists(body.carWashId))) return fail(res, 404, "Мойка не найдена");
            const data = { ...input.data, ...(input.password && { password: await hashPassword(input.password) }) };
            const user = isNew
                ? await repo.createUser({ ...data, createdBy: req.userId })
                : await repo.updateUser(body.userId, data);
            if (!user) return fail(res, 404, "Сотрудник не найден");
            return res.json({ success: true, user: toAdminUser(user) });
        } catch (error) {
            if (error?.code === MONGO_DUPLICATE_KEY) return fail(res, 409, "Сотрудник с таким номером уже есть");
            return serverError(res, "saveCarWashUserAdmin", error);
        }
    }

    async function setCarWashUserStatusAdmin(req, res) {
        const { userId, status } = req.body ?? {};
        if (!isId(userId) || !CAR_WASH_USER_STATUSES.includes(status)) return fail(res, 400, "Некорректные данные");
        try {
            const user = await repo.updateUser(userId, { status });
            if (!user) return fail(res, 404, "Сотрудник не найден");
            return res.json({ success: true, status: user.status });
        } catch (error) {
            return serverError(res, "setCarWashUserStatusAdmin", error);
        }
    }

    /** История погашений за период + сколько выдано и погашено. Индексы { status, usedAt } и { carWash, usedAt } */
    async function getCarWashCouponsAdmin(req, res) {
        const { carWashId, startDate, endDate, page: rawPage } = req.body ?? {};
        const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
        if (carWashId && !isId(carWashId)) return fail(res, 400, "Некорректная мойка");
        const period = parsePeriod({ startDate, endDate });
        if (!period) return fail(res, 400, "Некорректный период");

        const usedFilter = {
            status: "used",
            ...(carWashId && { carWash: new mongoose.Types.ObjectId(carWashId) }),
            ...dateMatch("usedAt", period),
        };
        try {
            const [redemptions, usedCount, issuedCount] = await Promise.all([
                repo.listRedemptions(usedFilter, page),
                repo.countCoupons(usedFilter),
                // Выдача не привязана к мойке — считаем по всем, только за период
                repo.countCoupons(dateMatch("createdAt", period)),
            ]);
            return res.json({
                success: true,
                summary: { issued: issuedCount, used: usedCount },
                page,
                pageSize: HISTORY_PAGE_SIZE,
                redemptions: redemptions.map((coupon) => ({
                    id: String(coupon._id),
                    code: coupon.code,
                    discountPercent: coupon.discountPercent,
                    usedAt: coupon.usedAt,
                    carWashName: coupon.carWashName,
                    usedByName: coupon.usedByName,
                    clientId: coupon.client?._id ? String(coupon.client._id) : null,
                    clientName: coupon.client?.userName ?? null,
                    clientPhone: coupon.client?.phone ?? null,
                })),
            });
        } catch (error) {
            return serverError(res, "getCarWashCouponsAdmin", error);
        }
    }

    /** Главная суперадмина и страница моек: переходы по кнопке и просмотры экрана купона за всё время */
    async function getCarWashCouponStatsAdmin(req, res) {
        try {
            return res.json({ success: true, stats: await repo.engagementTotals() });
        } catch (error) {
            return serverError(res, "getCarWashCouponStatsAdmin", error);
        }
    }

    return {
        getCarWashCouponStatsAdmin,
        getCarWashesAdmin,
        saveCarWashAdmin,
        setCarWashStatusAdmin,
        saveCarWashUserAdmin,
        setCarWashUserStatusAdmin,
        getCarWashCouponsAdmin,
    };
}

export const {
    getCarWashCouponStatsAdmin,
    getCarWashesAdmin,
    saveCarWashAdmin,
    setCarWashStatusAdmin,
    saveCarWashUserAdmin,
    setCarWashUserStatusAdmin,
    getCarWashCouponsAdmin,
} = createCarWashAdminController();
