import mongoose from "mongoose";

/**
 * Локальное хранение QR-счетов ApiPay.kz (Kaspi Pay).
 * Источник истины — ApiPay, но мы дублируем поля для быстрых отчётов,
 * связки с заказами/клиентами и идемпотентной обработки webhook-ов.
 */
const ApiPayInvoiceSchema = new mongoose.Schema(
    {
        /** ID счёта на стороне ApiPay (поле `id` из ответа /invoices/qr) */
        apipayInvoiceId: {
            type: Number,
            required: true,
            unique: true,
            index: true,
        },
        /** Внешний номер заказа (наш orderId/external_order_id) */
        externalOrderId: {
            type: String,
            default: null,
            index: true,
        },
        /** Связанный клиент CRM (опционально) */
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            default: null,
        },
        /** Связанный заказ CRM (опционально) */
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null,
        },
        amount: {
            type: Number,
            required: true,
        },
        description: {
            type: String,
            default: "",
        },
        /** Статус ApiPay: pending | processing | paid | cancelled | expired | partially_refunded | refunded | error */
        status: {
            type: String,
            default: "pending",
            index: true,
        },
        kaspiInvoiceId: {
            type: String,
            default: null,
        },
        /** URL картинки QR (PNG 600x600) — выдаёт ApiPay */
        qrImageUrl: {
            type: String,
            default: null,
        },
        /** Kaspi token URL — можно использовать для собственного рендеринга QR */
        qrTokenUrl: {
            type: String,
            default: null,
        },
        qrExpiresAt: {
            type: Date,
            default: null,
        },
        paidAt: {
            type: Date,
            default: null,
        },
        /** Идемпотентность: true, если на этот счёт уже был зачислен баланс клиента */
        paymentApplied: {
            type: Boolean,
            default: false,
            index: true,
        },
        /**
         * Черновик заказа мобильного приложения, который нужно создать сразу после
         * зачисления баланса по этому счёту (даже если клиент не вернулся в приложение).
         * Формат — тело запроса addOrderClientMobile: { mail, address, products, clientNotes, date, opForm, needCall, comment, notificationToken }.
         */
        pendingOrderDraft: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        /** Идемпотентность: true, если по pendingOrderDraft уже была предпринята попытка создать заказ */
        pendingOrderApplied: {
            type: Boolean,
            default: false,
        },
        totalRefunded: {
            type: Number,
            default: 0,
        },
        isFullyRefunded: {
            type: Boolean,
            default: false,
        },
        errorMessage: {
            type: String,
            default: null,
        },
        isSandbox: {
            type: Boolean,
            default: false,
        },
        /** Сырой последний ответ ApiPay (на случай отладки) */
        lastResponse: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        /** История полученных webhook-событий по этому счёту */
        webhookEvents: [
            {
                event: { type: String },
                receivedAt: { type: Date, default: Date.now },
                payload: { type: mongoose.Schema.Types.Mixed },
            },
        ],
    },
    { timestamps: true }
);

export default mongoose.model("ApiPayInvoice", ApiPayInvoiceSchema);
