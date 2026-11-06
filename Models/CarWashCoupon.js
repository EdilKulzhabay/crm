import mongoose from "mongoose";

/**
 * active — можно погасить до expiresAt; used — погашен на мойке.
 * «Истёк» не хранится отдельным статусом: это active с expiresAt в прошлом,
 * поэтому не нужен cron, который переводит купоны в expired.
 */
export const CAR_WASH_COUPON_STATUSES = Object.freeze(["active", "used"]);

/**
 * Купон на скидку на мойку. Выдаётся клиенту за каждый доставленный заказ (один на заказ)
 * и действует 72 часа. У клиента может быть несколько купонов, но одна мойка = один купон:
 * скидки не складываются. Сотрудник мойки вводит код и купон сразу гасится (utils/carWashCoupon.js).
 */
const CarWashCouponSchema = new mongoose.Schema(
    {
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            required: true,
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },
        /** 12 латинских букв в формате XXXX-XXXX-XXXX — как реферальный код */
        code: {
            type: String,
            required: true,
            unique: true,
            match: /^[A-Z]{4}-[A-Z]{4}-[A-Z]{4}$/,
        },
        discountPercent: {
            type: Number,
            required: true,
            min: 1,
            max: 100,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: CAR_WASH_COUPON_STATUSES,
            default: "active",
        },
        usedAt: { type: Date, default: null },
        usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "CarWashUser", default: null },
        carWash: { type: mongoose.Schema.Types.ObjectId, ref: "CarWash", default: null },
        /** Снимки на момент погашения — история читается без populate и не меняется при переименовании */
        carWashName: { type: String, default: null },
        usedByName: { type: String, default: null },
    },
    {
        timestamps: true,
    }
);

// Один купон на заказ, даже если статус «доставлен» выставят повторно
CarWashCouponSchema.index({ order: 1 }, { unique: true });
// Купоны клиента в приложении
CarWashCouponSchema.index({ client: 1, status: 1, expiresAt: -1 });
// История погашений в CRM и в кабинете мойки
CarWashCouponSchema.index({ status: 1, usedAt: -1 });
CarWashCouponSchema.index({ carWash: 1, usedAt: -1 });

export default mongoose.model("CarWashCoupon", CarWashCouponSchema);
