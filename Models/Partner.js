import mongoose from "mongoose";

export const PARTNER_STATUSES = Object.freeze(["active", "blocked"]);
/** Проверка партнёра суперадмином в CRM; до verified приложение показывает только экран ожидания */
export const PARTNER_VERIFICATION_STATUSES = Object.freeze(["waiting", "verified", "denied"]);

/** Статус проверки; у партнёров, созданных до введения проверки, поля нет — они тоже на проверке */
export const partnerVerificationStatus = (partner) => partner?.verification?.status ?? "waiting";

/**
 * Партнёр «Тибетской» (приложение tibetskaya_partner).
 *
 * Отдельная коллекция, а не роль в Client: у партнёра своя авторизация и права.
 * Программа: клиент регистрируется в клиентском приложении с кодом партнёра (referralCode) —
 * клиенту и партнёру начисляется по 200 ₸. balance — текущий остаток; каждое изменение
 * записывается в PartnerTransaction (журнал), см. utils/partnerLedger.js.
 */
const PartnerSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        /** Номер в том виде, в каком его ввёл партнёр (для отображения) */
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        /**
         * Нормализованный номер 7XXXXXXXXXX. По нему ищем и проверяем уникальность —
         * в отличие от Client, где номера хранятся в разном форматировании и ищутся regex-ом.
         */
        phoneNormalized: {
            type: String,
            required: true,
            unique: true,
            match: /^7\d{10}$/,
        },
        /** Код приглашения вида XXXX-XXXX-XXXX, уникален и среди партнёров, и среди клиентов */
        referralCode: {
            type: String,
            required: true,
            unique: true,
        },
        status: {
            type: String,
            enum: PARTNER_STATUSES,
            default: "active",
        },
        /** Доступно к выводу, целые тенге. Меняется только через utils/partnerLedger.js */
        balance: {
            type: Number,
            default: 0,
            min: 0,
        },
        /** Реквизиты для вывода — те же поля, что у курьеров (CourierAggregator.cardData) */
        cardData: {
            accountNumber: { type: String, default: "" },
            IIN: { type: String, default: "" },
            fullName: { type: String, default: "" },
        },
        /** Expo push-токены устройств партнёра (приложение tibetskaya_partner), не больше MAX_PUSH_TOKENS */
        expoPushTokens: {
            type: [String],
            default: [],
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },
        verification: {
            status: { type: String, enum: PARTNER_VERIFICATION_STATUSES, default: "waiting" },
            /** Причина отказа — показывается партнёру */
            message: { type: String, default: "", maxlength: 500 },
            resolvedAt: { type: Date, default: null },
            resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Partner", PartnerSchema);
