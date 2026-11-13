import bcrypt from "bcrypt";
import mongoose from "mongoose";
import CourierAggregator from "../Models/CourierAggregator.js";
import DeliveryPartner, { DELIVERY_PARTNER_STATUSES } from "../Models/DeliveryPartner.js";
import { normalizePhoneForWhatsApp } from "../whatsApp/normalizePhone.js";

/**
 * CRM, суперадмин: партнёры по доставке и привязка к ним курьеров-агрегаторов.
 * Партнёры не удаляются, а блокируются. У курьера не больше одного партнёра.
 */

const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 72; // bcrypt учитывает только первые 72 байта
const TEXT_MAX_LENGTH = { name: 100, phone: 30, query: 50 };
const PARTNERS_LIMIT = 500;
const SEARCH_LIMIT = 20;
const SEARCH_MIN_LENGTH = 2;
const PHONE_PATTERN = /^7\d{10}$/;
const MONGO_DUPLICATE_KEY = 11000;
const COURIER_FIELDS = "fullName phone carNumber status deliveryPartner deliveryPartnerLinkedAt";

const isId = (value) => typeof value === "string" && mongoose.isValidObjectId(value);
/** Обрезанная строка; null — длиннее maxLength */
const readText = (value, maxLength) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length <= maxLength ? text : null;
};
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toAdminCourier = (courier, partnerNames = new Map()) => {
    const partnerId = courier.deliveryPartner ? String(courier.deliveryPartner) : null;
    return {
        id: String(courier._id),
        fullName: courier.fullName,
        phone: courier.phone,
        carNumber: courier.carNumber,
        status: courier.status,
        deliveryPartnerId: partnerId,
        deliveryPartnerName: (partnerId && partnerNames.get(partnerId)) || null,
        linkedAt: courier.deliveryPartnerLinkedAt ?? null,
    };
};

const toAdminPartner = (partner, couriers = []) => ({
    id: String(partner._id),
    name: partner.name,
    phone: partner.phone,
    status: partner.status,
    lastLoginAt: partner.lastLoginAt ?? null,
    couriers,
});

const groupByPartner = (couriers) =>
    couriers.reduce((groups, courier) => {
        const key = String(courier.deliveryPartner);
        return groups.set(key, [...(groups.get(key) ?? []), courier]);
    }, new Map());

const defaultRepo = {
    listPartners: () => DeliveryPartner.find().sort({ status: 1, name: 1 }).limit(PARTNERS_LIMIT).lean(),
    /** Индекс CourierAggregator { deliveryPartner: 1 } */
    listLinkedCouriers: (partnerIds) =>
        CourierAggregator.find({ deliveryPartner: { $in: partnerIds } }).select(COURIER_FIELDS).sort({ fullName: 1 }).lean(),
    findPartnerNames: (ids) => DeliveryPartner.find({ _id: { $in: ids } }).select("name").lean(),
    createPartner: async (data) => (await DeliveryPartner.create(data)).toObject(),
    updatePartner: (id, update) =>
        DeliveryPartner.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean(),
    partnerExists: async (id) => Boolean(await DeliveryPartner.exists({ _id: id })),
    searchCouriers: (pattern) =>
        CourierAggregator.find({ status: { $ne: "deleted" }, $or: [{ fullName: pattern }, { phone: pattern }] })
            .select(COURIER_FIELDS)
            .sort({ fullName: 1 })
            .limit(SEARCH_LIMIT)
            .lean(),
    findCourier: (id) => CourierAggregator.findById(id).select(COURIER_FIELDS).lean(),
    updateCourier: (id, update) =>
        CourierAggregator.findByIdAndUpdate(id, { $set: update }, { new: true }).select(COURIER_FIELDS).lean(),
};

export function createDeliveryPartnerAdminController({
    repo = defaultRepo,
    hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS),
    now = () => new Date(),
    logger = console,
} = {}) {
    const fail = (res, status, message) => res.status(status).json({ success: false, message });
    const serverError = (res, handler, error) => {
        logger.error(`[DeliveryPartner admin] ${handler}:`, error?.message || error);
        return fail(res, 500, "Внутренняя ошибка сервера");
    };

    /** @returns {{ data: object, password: string } | { error: string }} */
    function readPartnerInput(body, isNew) {
        const name = readText(body.name, TEXT_MAX_LENGTH.name);
        const phone = readText(body.phone, TEXT_MAX_LENGTH.phone);
        const phoneNormalized = phone ? normalizePhoneForWhatsApp(phone) : null;
        const password = typeof body.password === "string" ? body.password : "";
        if (!name) return { error: "Укажите название партнёра" };
        if (!phoneNormalized || !PHONE_PATTERN.test(phoneNormalized)) return { error: "Некорректный номер телефона" };
        if ((isNew || password) && (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)) {
            return { error: `Пароль — от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов` };
        }
        return { data: { name, phone, phoneNormalized }, password };
    }

    async function getDeliveryPartnersAdmin(_req, res) {
        try {
            const partners = await repo.listPartners();
            const couriers = partners.length ? await repo.listLinkedCouriers(partners.map((partner) => partner._id)) : [];
            const couriersByPartner = groupByPartner(couriers);
            return res.json({
                success: true,
                deliveryPartners: partners.map((partner) =>
                    toAdminPartner(partner, (couriersByPartner.get(String(partner._id)) ?? []).map((courier) => toAdminCourier(courier)))
                ),
            });
        } catch (error) {
            return serverError(res, "getDeliveryPartnersAdmin", error);
        }
    }

    /** Без deliveryPartnerId — создать (пароль обязателен), с ним — изменить; пустой пароль = оставить прежний */
    async function saveDeliveryPartnerAdmin(req, res) {
        const body = req.body ?? {};
        const isNew = body.deliveryPartnerId === undefined;
        if (!isNew && !isId(body.deliveryPartnerId)) return fail(res, 400, "Некорректный партнёр");
        const input = readPartnerInput(body, isNew);
        if (input.error) return fail(res, 400, input.error);

        try {
            const data = { ...input.data, ...(input.password && { password: await hashPassword(input.password) }) };
            const partner = isNew
                ? await repo.createPartner({ ...data, createdBy: req.userId })
                : await repo.updatePartner(body.deliveryPartnerId, data);
            if (!partner) return fail(res, 404, "Партнёр не найден");
            return res.json({ success: true, deliveryPartner: toAdminPartner(partner) });
        } catch (error) {
            if (error?.code === MONGO_DUPLICATE_KEY) return fail(res, 409, "Партнёр с таким номером уже есть");
            return serverError(res, "saveDeliveryPartnerAdmin", error);
        }
    }

    async function setDeliveryPartnerStatusAdmin(req, res) {
        const { deliveryPartnerId, status } = req.body ?? {};
        if (!isId(deliveryPartnerId) || !DELIVERY_PARTNER_STATUSES.includes(status)) return fail(res, 400, "Некорректные данные");
        try {
            const partner = await repo.updatePartner(deliveryPartnerId, { status });
            if (!partner) return fail(res, 404, "Партнёр не найден");
            return res.json({ success: true, status: partner.status });
        } catch (error) {
            return serverError(res, "setDeliveryPartnerStatusAdmin", error);
        }
    }

    /** Поиск курьера по ФИО или телефону — для привязки; показывает, к кому он уже привязан */
    async function searchCouriersForDeliveryPartnerAdmin(req, res) {
        const query = readText(req.body?.query, TEXT_MAX_LENGTH.query);
        if (query === null || query.length < SEARCH_MIN_LENGTH) return fail(res, 400, `Введите не меньше ${SEARCH_MIN_LENGTH} символов`);
        try {
            const couriers = await repo.searchCouriers(new RegExp(escapeRegExp(query), "i"));
            const partnerIds = [...new Set(couriers.filter((c) => c.deliveryPartner).map((c) => String(c.deliveryPartner)))];
            const partners = partnerIds.length ? await repo.findPartnerNames(partnerIds) : [];
            const partnerNames = new Map(partners.map((partner) => [String(partner._id), partner.name]));
            return res.json({ success: true, couriers: couriers.map((courier) => toAdminCourier(courier, partnerNames)) });
        } catch (error) {
            return serverError(res, "searchCouriersForDeliveryPartnerAdmin", error);
        }
    }

    /**
     * { courierId, deliveryPartnerId | null } — привязать курьера к партнёру (перепривязать от другого) или отвязать.
     * Дата привязки (показывается в CRM) ставится заново только при смене партнёра.
     */
    async function setCourierDeliveryPartnerAdmin(req, res) {
        const { courierId, deliveryPartnerId } = req.body ?? {};
        if (!isId(courierId)) return fail(res, 400, "Некорректный курьер");
        if (deliveryPartnerId !== null && !isId(deliveryPartnerId)) return fail(res, 400, "Некорректный партнёр");

        try {
            const courier = await repo.findCourier(courierId);
            if (!courier) return fail(res, 404, "Курьер не найден");
            if (deliveryPartnerId && !(await repo.partnerExists(deliveryPartnerId))) return fail(res, 404, "Партнёр не найден");
            if (String(courier.deliveryPartner ?? "") === String(deliveryPartnerId ?? "")) {
                return res.json({ success: true, courier: toAdminCourier(courier) });
            }
            const updated = await repo.updateCourier(courierId, {
                deliveryPartner: deliveryPartnerId,
                deliveryPartnerLinkedAt: deliveryPartnerId ? now() : null,
            });
            logger.log?.(
                `[DeliveryPartner admin] курьер ${courierId}: партнёр ${courier.deliveryPartner ?? "—"} → ${deliveryPartnerId ?? "—"}, ${req.userId}`
            );
            return res.json({ success: true, courier: toAdminCourier(updated) });
        } catch (error) {
            return serverError(res, "setCourierDeliveryPartnerAdmin", error);
        }
    }

    return {
        getDeliveryPartnersAdmin,
        saveDeliveryPartnerAdmin,
        setDeliveryPartnerStatusAdmin,
        searchCouriersForDeliveryPartnerAdmin,
        setCourierDeliveryPartnerAdmin,
    };
}

export const {
    getDeliveryPartnersAdmin,
    saveDeliveryPartnerAdmin,
    setDeliveryPartnerStatusAdmin,
    searchCouriersForDeliveryPartnerAdmin,
    setCourierDeliveryPartnerAdmin,
} = createDeliveryPartnerAdminController();
