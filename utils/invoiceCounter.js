import InvoiceGlobalCounter from "../Models/InvoiceGlobalCounter.js";
import { nextInvoiceSequentialNumber } from "./invoicePdf.js";

const KEY = "global";

/**
 * Атомарно резервирует текущий номер для PDF и записывает в БД следующий.
 * @returns {Promise<string>}
 */
export async function takeNextInvoiceNumberForPdf() {
    for (let attempt = 0; attempt < 25; attempt++) {
        let doc = await InvoiceGlobalCounter.findOne({ key: KEY });
        if (!doc) {
            try {
                doc = await InvoiceGlobalCounter.create({ key: KEY, value: "1" });
            } catch (e) {
                if (e.code === 11000) {
                    continue;
                }
                throw e;
            }
        }
        const current = String(doc.value ?? "1").trim() || "1";
        const next = nextInvoiceSequentialNumber(current);
        const updated = await InvoiceGlobalCounter.findOneAndUpdate(
            { _id: doc._id, value: doc.value },
            { $set: { value: next } },
            { new: true }
        );
        if (updated) {
            return current;
        }
    }
    throw new Error("takeNextInvoiceNumberForPdf: не удалось зарезервировать номер счёта");
}
