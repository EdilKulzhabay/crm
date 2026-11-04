export const INVOICE_STATUS_LABELS = { issued: "Ожидает оплаты", paid: "Оплачен", cancelled: "Отменён" };
export const INVOICE_STATUS_CLASSES = { issued: "text-yellow-400", paid: "text-green-400", cancelled: "text-gray-400" };
export const PAYMENT_SOURCE_LABELS = { manual: "вручную", bank_statement: "по выписке Forte" };

export const BANK_TRANSACTION_STATUS_LABELS = {
    needs_review: "Требует проверки",
    matched: "Зачтено в счёт",
    ignored: "Не оплата счёта",
    new: "Не разобрано",
};

export const formatTenge = (amount) => `${Number(amount || 0).toLocaleString("ru-RU")} ₸`;

export const formatDate = (date) =>
    date ? new Date(date).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

export const formatDay = (date) =>
    date ? new Date(date).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

/** Что зачислено по оплаченному счёту */
export function formatCredited(invoice) {
    if (invoice.creditKind === "none") return "без зачисления (по факту)";
    const { b19 = 0, b12 = 0, balance = 0 } = invoice.credited || {};
    const parts = [b19 > 0 && `${b19} × 19 л`, b12 > 0 && `${b12} × 12 л`, balance > 0 && formatTenge(balance)].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "—";
}

export const errorMessage = (e, fallback) => e?.response?.data?.message || fallback;
