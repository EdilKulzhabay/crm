import mongoose from "mongoose";

/**
 * История оплат клиентов (пополнение баланса через Pay Plus и т.п.).
 */
const ClientPaymentSchema = new mongoose.Schema(
    {
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            required: true,
            index: true,
        },
        /** Дата/время фиксации платежа (как правило — момент callback от провайдера) */
        paidAt: {
            type: Date,
            required: true,
            default: Date.now,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: "KZT",
        },
        /** Итог: успех или неуспех */
        status: {
            type: String,
            required: true,
            enum: ["success", "fail"],
            index: true,
        },
        /** Последние 4 цифры карты, если провайдер передал в callback */
        cardLast4: {
            type: String,
            default: null,
            maxlength: 4,
        },
        /** Внутренний номер заказа сессии (orderId в PaymentSession) */
        sessionOrderId: {
            type: String,
            index: true,
        },
        /** Идентификатор инвойса у провайдера (co_inv_id) */
        providerInvoiceId: {
            type: String,
            default: null,
        },
        /** Как пришло co_inv_st от провайдера */
        rawProviderStatus: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("ClientPayment", ClientPaymentSchema);
