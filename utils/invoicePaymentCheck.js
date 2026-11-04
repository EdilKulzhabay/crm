/**
 * Кнопка «Проверить оплату» в приложении: ограничение частоты на клиента и сводка по его счетам.
 * Автоматической сверки по расписанию нет — выписку ForteBank читаем только по нажатию
 * (или по кнопке суперадмина в CRM).
 */

/** Нажимать «Проверить оплату» можно не чаще раза в 15 минут на клиента */
export const INVOICE_CHECK_COOLDOWN_MS = 15 * 60_000;

/**
 * Атомарно занимает попытку проверки для клиента.
 * @param {string} clientId
 * @param {{
 *   claim: (clientId: string, now: Date, cutoff: Date) => Promise<{ previousCheckedAt: Date | null } | null>,
 *   getCheckedAt: (clientId: string) => Promise<Date | null | undefined>,
 * }} repo — claim возвращает null, если с прошлой проверки не прошло 15 минут
 * @returns {Promise<{ claimed: true, claimedAt: Date, previousCheckedAt: Date | null, nextCheckAt: Date }
 *   | { claimed: false, nextCheckAt: Date }>}
 */
export async function claimInvoiceCheck(clientId, repo, now = new Date()) {
    const cutoff = new Date(now.getTime() - INVOICE_CHECK_COOLDOWN_MS);
    const claimed = await repo.claim(clientId, now, cutoff);
    if (claimed) {
        return {
            claimed: true,
            claimedAt: now,
            previousCheckedAt: claimed.previousCheckedAt ?? null,
            nextCheckAt: new Date(now.getTime() + INVOICE_CHECK_COOLDOWN_MS),
        };
    }
    const checkedAt = await repo.getCheckedAt(clientId);
    const base = checkedAt ? new Date(checkedAt).getTime() : now.getTime();
    return { claimed: false, nextCheckAt: new Date(base + INVOICE_CHECK_COOLDOWN_MS) };
}

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
 *   — один выбранный счёт или все счета, ожидавшие оплаты до проверки
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
