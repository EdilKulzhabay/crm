/**
 * Итог по счетам клиента для приложения (статус оплаты).
 * Сверку с выпиской ForteBank делает расписание раз в час — см. utils/bankStatementSync.js.
 */

const sumCredited = (invoices) =>
    invoices.reduce(
        (sum, invoice) => ({
            b19: sum.b19 + (invoice.credited?.b19 || 0),
            b12: sum.b12 + (invoice.credited?.b12 || 0),
            balance: sum.balance + (invoice.credited?.balance || 0),
        }),
        { b19: 0, b12: 0, balance: 0 }
    );

const creditKindOf = (credited) => {
    if (credited.b19 > 0 || credited.b12 > 0) return "bottles";
    if (credited.balance > 0) return "balance";
    return "none";
};

/**
 * Итог для приложения по счетам после проверки.
 * @param {Array<{ status: string, creditKind?: string, credited?: { b19: number, b12: number, balance: number } }>} invoices
 *   — один выбранный счёт или неоплаченные счета клиента
 * @returns {{ status: "paid"|"waiting"|"cancelled"|"none", waitingCount: number, creditKind?: string, credited?: object }}
 */
export function summarizeInvoiceCheck(invoices) {
    const waitingCount = invoices.filter((invoice) => invoice.status === "issued").length;
    const paid = invoices.filter((invoice) => invoice.status === "paid");

    if (paid.length > 0) {
        const credited = sumCredited(paid);
        const creditKind = paid.length === 1 ? paid[0].creditKind : creditKindOf(credited);
        return { status: "paid", waitingCount, creditKind, credited };
    }
    if (waitingCount > 0) return { status: "waiting", waitingCount };
    if (invoices.some((invoice) => invoice.status === "cancelled")) return { status: "cancelled", waitingCount: 0 };
    return { status: "none", waitingCount: 0 };
}
