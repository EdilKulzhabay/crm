import mongoose from "mongoose";

/**
 * Один глобальный счётчик: поле value — следующий номер счёта для PDF.
 * При успешной генерации счёта value атомарно заменяется на следующий (см. utils/invoiceCounter.js).
 */
const InvoiceGlobalCounterSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            default: "global",
        },
        value: {
            type: String,
            default: "1",
        },
    },
    { timestamps: true }
);

export default mongoose.model("InvoiceGlobalCounter", InvoiceGlobalCounterSchema);
