import mongoose from "mongoose";

/**
 * Входящая операция по расчётному счёту из выписки ForteBusiness.
 * Сохраняем каждую, даже несопоставленную: уникальный bankRef не даёт обработать операцию дважды.
 */
const BankTransactionSchema = new mongoose.Schema(
    {
        /** id операции в ForteBusiness (account-history.id) */
        bankRef: { type: String, required: true, unique: true },
        documentNumber: { type: String, default: "" },
        date: { type: Date, required: true },
        amount: { type: Number, required: true },
        currency: { type: String, default: "KZT" },
        payerName: { type: String, default: "" },
        payerBin: { type: String, default: "" },
        payerAccount: { type: String, default: "" },
        payerBank: { type: String, default: "" },
        purpose: { type: String, default: "" },
        purposeCode: { type: String, default: "" },
        /**
         * new — ещё не разобрана; matched — закрыла счёт; needs_review — похожа на оплату счёта,
         * но автоматически зачислять нельзя; ignored — не оплата счёта (или менеджер так решил).
         */
        status: {
            type: String,
            enum: ["new", "matched", "needs_review", "ignored"],
            default: "new",
        },
        reviewReason: { type: String, default: "" },
        invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
        resolvedBy: { type: String, default: null },
        resolvedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

BankTransactionSchema.index({ status: 1, date: -1 });
/** Последняя загруженная операция — начало окна следующей сверки */
BankTransactionSchema.index({ date: -1 });

export default mongoose.model("BankTransaction", BankTransactionSchema);
