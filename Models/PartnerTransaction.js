import mongoose from "mongoose";

export const PARTNER_TRANSACTION_TYPES = Object.freeze(["referral_bonus", "order_bonus", "withdrawal"]);
/** completed — бонус начислен; pending/paid/rejected — статусы запроса на вывод */
export const PARTNER_TRANSACTION_STATUSES = Object.freeze(["completed", "pending", "paid", "rejected"]);

/**
 * Журнал изменений баланса партнёра. amount со знаком: +200 за регистрацию клиента,
 * +200 за каждую бутыль доставленного заказа клиента, −сумма при запросе на вывод (списывается сразу, чтобы один остаток нельзя было вывести дважды).
 */
const PartnerTransactionSchema = new mongoose.Schema(
    {
        partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true },
        type: { type: String, enum: PARTNER_TRANSACTION_TYPES, required: true },
        amount: { type: Number, required: true },
        status: { type: String, enum: PARTNER_TRANSACTION_STATUSES, required: true },
        /** Для бонуса: зарегистрированный клиент и его имя на момент начисления (без populate в списках) */
        client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null },
        clientName: { type: String, default: null },
        /** Для бонуса за заказ: доставленный заказ и число бутылей в нём */
        order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
        bottles: { type: Number, default: null },
        /** Для вывода: ключ запроса из приложения — повтор того же запроса не спишет деньги второй раз */
        requestId: { type: String, default: null },
        cardData: {
            accountNumber: String,
            IIN: String,
            fullName: String,
        },
        balanceAfter: { type: Number, default: null },
    },
    { timestamps: true }
);

PartnerTransactionSchema.index({ partner: 1, createdAt: -1 });
// Бонус за одного клиента начисляется не более одного раза
PartnerTransactionSchema.index(
    { client: 1, type: 1 },
    { unique: true, partialFilterExpression: { type: "referral_bonus" } }
);
// Бонус за один заказ — не более одного раза, даже если статус «доставлен» выставят повторно
PartnerTransactionSchema.index(
    { order: 1, type: 1 },
    { unique: true, partialFilterExpression: { type: "order_bonus" } }
);
PartnerTransactionSchema.index(
    { partner: 1, requestId: 1 },
    { unique: true, partialFilterExpression: { type: "withdrawal" } }
);

export default mongoose.model("PartnerTransaction", PartnerTransactionSchema);
