import mongoose from "mongoose";

/**
 * Счёт на оплату для юрлица (PDF из клиентского приложения, generateInvoicePdfMobile).
 * Хранит снимок количества и цен на момент выставления — по нему и зачисляется оплата.
 * Оплату подтверждает менеджер в CRM или сверка с выпиской ForteBusiness (utils/bankStatementSync.js).
 */
const InvoiceSchema = new mongoose.Schema(
    {
        /** Номер из InvoiceGlobalCounter, как напечатан в PDF */
        number: { type: String, required: true, unique: true },
        /** Номер без ведущих нулей — по нему ищем счёт из назначения платежа */
        numberKey: { type: String, required: true, index: true },
        client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
        /** Франчайзи клиента на момент выставления — для доступа в CRM */
        franchisee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
        /** Реквизиты покупателя, напечатанные в счёте */
        buyerLegalData: { type: String, default: "" },
        /** БИН/ИИН покупателя: сверяется с БИН плательщика из выписки */
        buyerBin: { type: String, default: null },
        qty19: { type: Number, default: 0 },
        qty12: { type: Number, default: 0 },
        price19: { type: Number, default: 0 },
        price12: { type: Number, default: 0 },
        /** Аренда возвратной тары: количество и цена на момент выставления (utils/invoiceRental.js) */
        rent19: { type: Number, default: 0 },
        rent12: { type: Number, default: 0 },
        rentPrice19: { type: Number, default: 0 },
        rentPrice12: { type: Number, default: 0 },
        /** Вода + аренда */
        total: { type: Number, required: true },
        status: { type: String, enum: ["issued", "paid", "cancelled"], default: "issued" },

        paidAt: { type: Date, default: null },
        paidAmount: { type: Number, default: null },
        paymentSource: { type: String, enum: ["manual", "bank_statement", null], default: null },
        /** Банковская операция, закрывшая счёт (`forte:<id>`): одна операция — максимум один счёт */
        paymentRef: { type: String, default: undefined },
        confirmedBy: { type: String, default: null },
        confirmReason: { type: String, default: null },
        /** Что зачислено: бутыли (coupon), тенге (balance) или ничего (fakt, только отметка) */
        creditKind: { type: String, enum: ["bottles", "balance", "none", null], default: null },
        credited: {
            b19: { type: Number, default: 0 },
            b12: { type: Number, default: 0 },
            balance: { type: Number, default: 0 },
        },
        /**
         * false у оплаченного счёта — статус уже paid, а $inc клиенту ещё не прошёл (сбой между шагами).
         * Такие счета видно в CRM, доначисление вручную по полю credited.
         */
        creditApplied: { type: Boolean, default: false },

        cancelledAt: { type: Date, default: null },
        cancelledBy: { type: String, default: null },
        cancelReason: { type: String, default: null },
    },
    { timestamps: true }
);

InvoiceSchema.index({ client: 1, createdAt: -1 });
InvoiceSchema.index({ status: 1, createdAt: -1 });
InvoiceSchema.index({ buyerBin: 1, status: 1 });
InvoiceSchema.index(
    { paymentRef: 1 },
    { unique: true, partialFilterExpression: { paymentRef: { $type: "string" } } }
);

export default mongoose.model("Invoice", InvoiceSchema);
