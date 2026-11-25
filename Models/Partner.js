import mongoose from "mongoose";

/**
 * deleted — партнёр удалил аккаунт в приложении. Данные не стираются (расчёты по оферте, п. 7.6–7.7),
 * но все сессии недействительны, вход и повторная регистрация с этим номером запрещены.
 * Восстановить может суперадмин в CRM (статус active).
 */
export const PARTNER_STATUSES = Object.freeze(["active", "blocked", "deleted"]);
/** Суперадмин блокирует и восстанавливает; удалить аккаунт может только сам партнёр */
export const ADMIN_SETTABLE_PARTNER_STATUSES = Object.freeze(["active", "blocked"]);
/** Проверка партнёра суперадмином в CRM; до verified приложение показывает только экран ожидания */
export const PARTNER_VERIFICATION_STATUSES = Object.freeze(["waiting", "verified", "denied"]);

/**
 * Индивидуальные ставки партнёра, целые тенге; задаются суперадмином в CRM (страница партнёра):
 * registrationBonus — за клиента, зарегистрированного по коду; bottleBonus19 / bottleBonus12 — за каждую бутыль
 * 18,9 л / 12,5 л доставленного заказа его клиента; clientSignupBonus — не партнёру, а клиенту: зачисляется
 * на Client.balance при регистрации по коду этого партнёра (или привязке в CRM).
 */
export const PARTNER_RATE_FIELDS = Object.freeze(["registrationBonus", "bottleBonus19", "bottleBonus12", "clientSignupBonus"]);
export const DEFAULT_PARTNER_RATES = Object.freeze({
    registrationBonus: 200,
    bottleBonus19: 200,
    bottleBonus12: 100,
    clientSignupBonus: 200,
});
export const MAX_PARTNER_RATE = 100000;
/** У партнёров, созданных до введения ставок, полей нет — действуют ставки по умолчанию */
export const partnerRates = (partner) =>
    Object.fromEntries(
        PARTNER_RATE_FIELDS.map((field) => [
            field,
            Number.isSafeInteger(partner?.[field]) ? partner[field] : DEFAULT_PARTNER_RATES[field],
        ])
    );

const rateField = (field) => ({
    type: Number,
    default: DEFAULT_PARTNER_RATES[field],
    min: 0,
    max: MAX_PARTNER_RATE,
    validate: { validator: Number.isInteger, message: "Ставка — целое число тенге" },
});

/** Статус проверки; у партнёров, созданных до введения проверки, поля нет — они тоже на проверке */
export const partnerVerificationStatus = (partner) => partner?.verification?.status ?? "waiting";

/**
 * Партнёр «Тибетской» (приложение tibetskaya_partner).
 *
 * Отдельная коллекция, а не роль в Client: у партнёра своя авторизация и права.
 * Программа: клиент регистрируется в клиентском приложении с кодом партнёра (referralCode) —
 * клиенту — clientSignupBonus, партнёру — registrationBonus, затем bottleBonus19/12 за бутыли его заказов (см. partnerRates). balance — текущий остаток; каждое изменение
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
        /**
         * Код приглашения вида XXXX-XXXX-XXXX, уникален и среди партнёров, и среди клиентов.
         * Суперадмин может сменить его в CRM — старый код сразу перестаёт работать, привязанные клиенты остаются.
         */
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
        /** Ставки партнёра; читать через partnerRates (у старых партнёров полей нет) */
        registrationBonus: rateField("registrationBonus"),
        bottleBonus19: rateField("bottleBonus19"),
        bottleBonus12: rateField("bottleBonus12"),
        clientSignupBonus: rateField("clientSignupBonus"),
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
        deletedAt: {
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
