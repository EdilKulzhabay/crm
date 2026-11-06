import crypto from "crypto";
import CarWash from "../Models/CarWash.js";
import CarWashCoupon from "../Models/CarWashCoupon.js";
import Order from "../Models/Order.js";
import { normalizeReferralCodeInput } from "./referralCode.js";

export const CAR_WASH_COUPON_DISCOUNT_PERCENT = 20;
export const CAR_WASH_COUPON_TTL_MS = 72 * 60 * 60 * 1000;

const CODE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_GROUP_LENGTH = 4;
const CODE_GROUPS = 3;
const CODE_GENERATION_ATTEMPTS = 10;
const MONGO_DUPLICATE_KEY = 11000;

/** Ошибки погашения; code уходит в ответ кабинету мойки, чтобы показать понятную причину */
export class CarWashCouponError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "CarWashCouponError";
        this.code = code;
    }
}

const isDuplicateKey = (error, field) =>
    error?.code === MONGO_DUPLICATE_KEY && (!field || Object.hasOwn(error.keyPattern ?? {}, field));

/**
 * XXXX-XXXX-XXXX из crypto.randomInt: код вводят вручную, и его не должно быть
 * возможно предсказать (Math.random в referralCode.js для купона не подходит).
 */
export function generateCarWashCouponCode(randomInt = crypto.randomInt) {
    const group = () =>
        Array.from({ length: CODE_GROUP_LENGTH }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join("");
    return Array.from({ length: CODE_GROUPS }, group).join("-");
}

/** Тот же формат, что у реферального кода: регистр, пробелы и дефисы при вводе не важны */
export const normalizeCarWashCouponCode = normalizeReferralCodeInput;

export const defaultCouponRepository = {
    findDeliveredOrder: (orderId) => Order.findById(orderId).select("client status").lean(),
    hasActiveCarWash: async () => Boolean(await CarWash.exists({ status: "active" })),
    createCoupon: async (data) => (await CarWashCoupon.create(data)).toObject(),
    /** Атомарно: из двух одновременных погашений одного кода пройдёт только одно */
    markUsed: (code, now, update) =>
        CarWashCoupon.findOneAndUpdate(
            { code, status: "active", expiresAt: { $gt: now } },
            { $set: { status: "used", usedAt: now, ...update } },
            { new: true }
        ).lean(),
    findByCode: (code) => CarWashCoupon.findOne({ code }).lean(),
};

/**
 * Купон за доставленный заказ. Вызывается рядом с applyPartnerOrderBonus во всех местах доставки.
 * Не выдаётся, пока в CRM нет ни одной активной мойки — иначе клиенту негде его использовать.
 * Идемпотентно (уникальный индекс по order). Никогда не бросает: сбой купона не должен ломать доставку.
 * @returns {Promise<object|null>} созданный купон или null
 */
export async function issueCarWashCoupon(
    orderId,
    { repo = defaultCouponRepository, now = () => new Date(), generateCode = generateCarWashCouponCode, logger = console } = {}
) {
    try {
        const order = await repo.findDeliveredOrder(orderId);
        if (!order || order.status !== "delivered" || !order.client) return null;
        if (!(await repo.hasActiveCarWash())) return null;

        const issuedAt = now();
        for (let attempt = 0; attempt < CODE_GENERATION_ATTEMPTS; attempt++) {
            try {
                return await repo.createCoupon({
                    client: order.client,
                    order: order._id,
                    code: generateCode(),
                    discountPercent: CAR_WASH_COUPON_DISCOUNT_PERCENT,
                    expiresAt: new Date(issuedAt.getTime() + CAR_WASH_COUPON_TTL_MS),
                });
            } catch (error) {
                if (isDuplicateKey(error, "order")) return null;
                if (!isDuplicateKey(error, "code")) throw error;
            }
        }
        throw new Error("не удалось сгенерировать уникальный код");
    } catch (error) {
        logger.error(`[CarWash coupon] заказ ${orderId}: купон не выдан:`, error?.message || error);
        return null;
    }
}

/**
 * Погашение кода сотрудником мойки — сразу, без подтверждения клиентом.
 * @param {{ rawCode: unknown, user: { _id: unknown, fullName: string }, carWash: { _id: unknown, name: string } }} input
 * @returns {Promise<object>} погашенный купон
 * @throws {CarWashCouponError} INVALID_CODE | NOT_FOUND | USED | EXPIRED
 */
export async function redeemCarWashCoupon(
    { rawCode, user, carWash },
    { repo = defaultCouponRepository, now = () => new Date() } = {}
) {
    const code = normalizeCarWashCouponCode(rawCode);
    if (!code) throw new CarWashCouponError("INVALID_CODE", "Код должен состоять из 12 латинских букв");

    const redeemedAt = now();
    const coupon = await repo.markUsed(code, redeemedAt, {
        usedBy: user._id,
        usedByName: user.fullName,
        carWash: carWash._id,
        carWashName: carWash.name,
    });
    if (coupon) return coupon;

    // Не погасился — выясняем почему, чтобы сотрудник мог объяснить клиенту
    const existing = await repo.findByCode(code);
    if (!existing) throw new CarWashCouponError("NOT_FOUND", "Купон с таким кодом не найден");
    if (existing.status === "used") {
        throw new CarWashCouponError("USED", "Купон уже использован");
    }
    throw new CarWashCouponError("EXPIRED", "Срок действия купона истёк");
}
