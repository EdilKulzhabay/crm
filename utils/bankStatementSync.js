import BankTransaction from "../Models/BankTransaction.js";
import Invoice from "../Models/Invoice.js";
import { createForteBusinessClient, isIncomingTransaction, readForteBusinessConfig } from "./forteBusiness.js";
import { decideTransactionMatch, extractInvoiceNumberKeys, MATCH_ACTIONS, normalizeBin } from "./invoiceMatching.js";
import { applyInvoicePayment, InvoicePaymentError, SYSTEM_CONFIRMED_BY } from "./invoicePayment.js";

/**
 * Сверка счетов юрлиц с выпиской ForteBusiness: новые поступления → BankTransaction → зачисление по счёту.
 * Запуск только вручную: «Проверить оплату» в приложении (раз в 15 мин на клиента) и кнопка суперадмина в CRM.
 */

/** Запас назад от последней загруженной операции: выходные + задержка проводки. Повторы безопасны — bankRef уникален */
const SYNC_OVERLAP_DAYS = 5;
/** Дальше этого выписку не читаем (первый запуск или долгий перерыв между проверками) */
const SYNC_MAX_LOOKBACK_DAYS = 31;
const DAY_MS = 86_400_000;

/**
 * Период выписки. Расписания нет, между проверками могут пройти недели,
 * поэтому читаем от последней сохранённой операции (с запасом), но не дальше 31 дня.
 * @param {number} now — мс
 * @param {Date | null} latestStoredDate — дата последней сохранённой операции
 */
export function getSyncPeriod(now, latestStoredDate) {
    const earliest = now - SYNC_MAX_LOOKBACK_DAYS * DAY_MS;
    const sinceLatest = latestStoredDate
        ? new Date(latestStoredDate).getTime() - SYNC_OVERLAP_DAYS * DAY_MS
        : earliest;
    const recent = now - SYNC_OVERLAP_DAYS * DAY_MS;
    return { from: new Date(Math.max(earliest, Math.min(sinceLatest, recent))), to: new Date(now) };
}
/** Сколько несопоставленных операций разбирать за один запуск */
const MAX_PENDING_PER_RUN = 500;
export const BANK_REF_PREFIX = "forte:";

/** Поля BankTransaction из операции account-history */
export function mapForteTransaction(tx) {
    return {
        bankRef: String(tx.id),
        documentNumber: String(tx.documentNumber ?? ""),
        date: new Date(tx.historyDate),
        amount: Number(tx.amount),
        currency: tx.currency || "KZT",
        payerName: tx.payer || "",
        payerBin: normalizeBin(tx.payerBin) ?? "",
        payerAccount: tx.payerAccount || "",
        payerBank: tx.payerBank || "",
        purpose: tx.paymentPurpose || "",
        purposeCode: tx.paymentPurposeCode || "",
    };
}

let forteClient = null;
function getForteClient() {
    if (forteClient) return forteClient;
    const config = readForteBusinessConfig();
    if (!config) throw new Error("ForteBusiness не настроен: заполните FORTE_BUSINESS_* в .env");
    forteClient = createForteBusinessClient(config);
    return forteClient;
}

export const defaultSyncDeps = {
    now: () => Date.now(),
    fetchIncoming: async (period) => {
        const client = getForteClient();
        const history = await client.listAccountHistory(period);
        return history.filter((tx) => isIncomingTransaction(tx, client.accountNumber));
    },
    findLatestTransactionDate: async () =>
        (await BankTransaction.findOne().sort({ date: -1 }).select("date").lean())?.date ?? null,
    /** @returns {Promise<number>} 1 — операция новая, 0 — уже была */
    saveIfNew: async (doc) =>
        (await BankTransaction.updateOne({ bankRef: doc.bankRef }, { $setOnInsert: doc }, { upsert: true })).upsertedCount,
    listNew: () => BankTransaction.find({ status: "new" }).sort({ date: 1, _id: 1 }).limit(MAX_PENDING_PER_RUN).lean(),
    findInvoiceByPaymentRef: (paymentRef) => Invoice.findOne({ paymentRef }).select("_id").lean(),
    findInvoicesByNumberKeys: (keys) => Invoice.find({ numberKey: { $in: keys } }).lean(),
    findOpenInvoicesByBin: (bin) => Invoice.find({ buyerBin: bin, status: "issued" }).lean(),
    hasInvoicesForBin: async (bin) => Boolean(await Invoice.exists({ buyerBin: bin })),
    /** Только из new: ручное решение менеджера не перезаписываем */
    resolveTransaction: (id, update) =>
        BankTransaction.updateOne({ _id: id, status: "new" }, { $set: { ...update, resolvedAt: new Date() } }),
    applyPayment: (params) => applyInvoicePayment(params),
    logger: console,
};

async function decideForTransaction(tx, deps) {
    const keys = extractInvoiceNumberKeys(tx.purpose);
    const payerBin = normalizeBin(tx.payerBin);
    const [invoicesByNumber, openInvoicesOfPayer, isKnownPayer] = await Promise.all([
        keys.length > 0 ? deps.findInvoicesByNumberKeys(keys) : [],
        payerBin ? deps.findOpenInvoicesByBin(payerBin) : [],
        payerBin ? deps.hasInvoicesForBin(payerBin) : false,
    ]);
    return decideTransactionMatch({ tx, invoicesByNumber, openInvoicesOfPayer, isKnownPayer });
}

/**
 * Разбирает одну новую операцию.
 * @returns {Promise<"matched"|"needs_review"|"ignored"|"failed">}
 */
export async function processBankTransaction(tx, deps = defaultSyncDeps) {
    const paymentRef = BANK_REF_PREFIX + tx.bankRef;
    try {
        // Счёт уже закрыт этой операцией (сбой после зачисления на прошлом запуске)
        const alreadyApplied = await deps.findInvoiceByPaymentRef(paymentRef);
        if (alreadyApplied) {
            await deps.resolveTransaction(tx._id, { status: "matched", invoice: alreadyApplied._id, resolvedBy: SYSTEM_CONFIRMED_BY });
            return "matched";
        }

        const decision = await decideForTransaction(tx, deps);
        if (decision.action === MATCH_ACTIONS.IGNORE) {
            await deps.resolveTransaction(tx._id, { status: "ignored", resolvedBy: SYSTEM_CONFIRMED_BY });
            return "ignored";
        }
        if (decision.action === MATCH_ACTIONS.REVIEW) {
            await deps.resolveTransaction(tx._id, {
                status: "needs_review",
                reviewReason: decision.reason,
                invoice: decision.invoice?._id ?? null,
            });
            return "needs_review";
        }

        const result = await deps.applyPayment({
            invoiceId: decision.invoice._id,
            paidAmount: tx.amount,
            paymentSource: "bank_statement",
            paymentRef,
            confirmedBy: SYSTEM_CONFIRMED_BY,
            reason: `выписка Forte, п/п №${tx.documentNumber || "—"}`,
        });
        if (result.status === "already_paid") {
            await deps.resolveTransaction(tx._id, {
                status: "needs_review",
                reviewReason: `Счёт №${decision.invoice.number} уже оплачен — возможна повторная оплата`,
                invoice: decision.invoice._id,
            });
            return "needs_review";
        }
        await deps.resolveTransaction(tx._id, { status: "matched", invoice: decision.invoice._id, resolvedBy: SYSTEM_CONFIRMED_BY });
        return "matched";
    } catch (error) {
        if (error instanceof InvoicePaymentError) {
            await deps.resolveTransaction(tx._id, { status: "needs_review", reviewReason: error.message });
            return "needs_review";
        }
        // Остаётся new — разберём на следующем запуске
        deps.logger.error(`[bankStatementSync] операция ${tx.bankRef}:`, error?.message || error);
        return "failed";
    }
}

/**
 * Загружает выписку и разбирает все неразобранные операции.
 * @returns {Promise<{ fetched: number, inserted: number, matched: number, needs_review: number, ignored: number, failed: number }>}
 */
export async function syncBankStatement(deps = defaultSyncDeps) {
    const period = getSyncPeriod(deps.now(), await deps.findLatestTransactionDate());
    const incoming = await deps.fetchIncoming(period);

    let inserted = 0;
    for (const tx of incoming) {
        inserted += await deps.saveIfNew(mapForteTransaction(tx));
    }

    const stats = { fetched: incoming.length, inserted, matched: 0, needs_review: 0, ignored: 0, failed: 0 };
    for (const tx of await deps.listNew()) {
        stats[await processBankTransaction(tx, deps)] += 1;
    }
    return stats;
}

let runningSync = null;
let lastFinishedAt = 0;

/**
 * Запуск без параллельных копий (CRM, приложение).
 * @param {{ minIntervalMs?: number }} [options] — не запускать, если прошлая сверка была недавно
 * @returns {Promise<object>} статистика, { skipped: true } или { disabled: true }
 */
export function runBankStatementSync({ minIntervalMs = 0 } = {}, deps = defaultSyncDeps) {
    if (!isBankStatementSyncConfigured()) return Promise.resolve({ disabled: true });
    if (runningSync) return runningSync;
    if (minIntervalMs > 0 && deps.now() - lastFinishedAt < minIntervalMs) {
        return Promise.resolve({ skipped: true });
    }
    runningSync = syncBankStatement(deps).finally(() => {
        runningSync = null;
        lastFinishedAt = deps.now();
    });
    return runningSync;
}

export function isBankStatementSyncConfigured() {
    return readForteBusinessConfig() !== null;
}
