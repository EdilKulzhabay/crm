/**
 * Чистые правила оплаты счетов юрлиц: что зачислять и какой счёт закрывает банковскую операцию.
 * Без БД — используется в utils/invoicePayment.js и utils/bankStatementSync.js, покрыто тестами.
 *
 * Правила (согласованы 02.11.2026):
 * - coupon: бутыли из счёта; balance: вся сумма в тенге; переплата — остаток на баланс;
 * - аренда тары в счёте только фиксируется: её сумма не зачисляется ни бутылями, ни на баланс;
 * - недоплата и клиенты «по факту» (fakt) автоматически не зачисляются — только ручная проверка;
 * - автоматически закрываем счёт, только если БИН плательщика совпадает с БИН покупателя.
 */

import { invoiceRentalTotal } from "./invoiceRental.js";

const BIN_LENGTH = 12;
const LABELED_BIN_PATTERN = /(?:БИН|ИИН|BIN|IIN)[^\d]{0,10}(\d{12})(?!\d)/iu;
const STANDALONE_BIN_PATTERN = /(?<!\d)\d{12}(?!\d)/gu;
/**
 * Номер счёта в назначении платежа. Реальные примеры из выписки:
 * «Счет на оплату №913 от 04 октября», «согласно счета № 915 от 05.10.26», «по счёту 917».
 * Отдельно «№ 248» — тоже кандидат: ложное совпадение отсечёт проверка БИН.
 */
const INVOICE_NUMBER_PATTERNS = [
    /сч[её]т[а-яё]*\s*(?:на\s+оплату\s*)?(?:№|N|#)?\s*(\d{1,12})(?!\d)/giu,
    /№\s*(\d{1,12})(?!\d)/gu,
];

export const INVOICE_CREDIT_KINDS = Object.freeze({ BOTTLES: "bottles", BALANCE: "balance", NONE: "none" });
export const MATCH_ACTIONS = Object.freeze({ APPLY: "apply", REVIEW: "review", IGNORE: "ignore" });

/** Ключ номера счёта: без ведущих нулей, чтобы «000913» и «913» совпадали */
export function invoiceNumberKey(number) {
    const text = String(number ?? "").trim();
    return /^\d+$/.test(text) ? BigInt(text).toString() : text.toUpperCase();
}

/** @returns {string | null} 12 цифр или null */
export function normalizeBin(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits.length === BIN_LENGTH ? digits : null;
}

/**
 * БИН/ИИН из свободного текста реквизитов: сначала подписанный «БИН …», иначе единственное 12-значное число.
 * @returns {string | null}
 */
export function extractBin(text) {
    const source = String(text ?? "");
    const labeled = source.match(LABELED_BIN_PATTERN);
    if (labeled) return labeled[1];
    const unique = [...new Set(source.match(STANDALONE_BIN_PATTERN) ?? [])];
    return unique.length === 1 ? unique[0] : null;
}

/** @returns {string[]} ключи номеров счетов из назначения платежа */
export function extractInvoiceNumberKeys(purpose) {
    const text = String(purpose ?? "");
    const keys = INVOICE_NUMBER_PATTERNS.flatMap((pattern) => [...text.matchAll(pattern)].map((m) => invoiceNumberKey(m[1])));
    return [...new Set(keys)];
}

const toTiyn = (amount) => Math.round(Number(amount) * 100);

/**
 * Что зачислить клиенту за оплату счёта.
 * @param {{ invoice: { total: number, qty19?: number, qty12?: number, number: string },
 *           amount: number, paymentMethod: string, allowFakt?: boolean }} params
 *   allowFakt — менеджер вручную подтверждает счёт клиента «по факту»: отмечаем оплату, ничего не зачисляя.
 * @returns {{ ok: true, creditKind: string, credited: { b19: number, b12: number, balance: number } }
 *         | { ok: false, reason: string }}
 */
export function evaluateInvoicePayment({ invoice, amount, paymentMethod, allowFakt = false }) {
    const paid = toTiyn(amount);
    const total = toTiyn(invoice.total);
    if (!(paid > 0)) {
        return { ok: false, reason: "Сумма оплаты не указана" };
    }
    if (paid < total) {
        return { ok: false, reason: `Недоплата по счёту №${invoice.number}: получено ${paid / 100} ₸, по счёту ${total / 100} ₸` };
    }
    const overpayment = (paid - total) / 100;

    if (paymentMethod === "coupon") {
        return {
            ok: true,
            creditKind: INVOICE_CREDIT_KINDS.BOTTLES,
            credited: { b19: invoice.qty19 || 0, b12: invoice.qty12 || 0, balance: overpayment },
        };
    }
    if (paymentMethod === "balance") {
        const rental = toTiyn(invoiceRentalTotal(invoice));
        return { ok: true, creditKind: INVOICE_CREDIT_KINDS.BALANCE, credited: { b19: 0, b12: 0, balance: (paid - rental) / 100 } };
    }
    if (paymentMethod === "fakt" && allowFakt) {
        return { ok: true, creditKind: INVOICE_CREDIT_KINDS.NONE, credited: { b19: 0, b12: 0, balance: 0 } };
    }
    if (paymentMethod === "fakt") {
        return { ok: false, reason: "Клиент работает «по факту»: зачисление по счёту решает менеджер" };
    }
    return { ok: false, reason: `Неизвестный способ оплаты клиента: ${paymentMethod || "—"}` };
}

/**
 * Какой счёт закрывает входящая операция.
 * @param {{ tx: { amount: number, payerBin: string },
 *           invoicesByNumber: Array<{ number: string, buyerBin?: string | null, status: string, total: number }>,
 *           openInvoicesOfPayer: Array<{ number: string, total: number }>,
 *           isKnownPayer: boolean }} params
 *   invoicesByNumber — счета с номерами из назначения платежа (любой статус и БИН);
 *   openInvoicesOfPayer — неоплаченные счета с БИН покупателя = БИН плательщика;
 *   isKnownPayer — плательщику когда-либо выставлялся счёт.
 * @returns {{ action: "apply", invoice: object } | { action: "review", reason: string, invoice?: object } | { action: "ignore" }}
 */
export function decideTransactionMatch({ tx, invoicesByNumber, openInvoicesOfPayer, isKnownPayer }) {
    const payerBin = normalizeBin(tx.payerBin);
    const byNumberOfPayer = invoicesByNumber.filter((inv) => payerBin && normalizeBin(inv.buyerBin) === payerBin);

    if (byNumberOfPayer.length > 0) {
        const open = byNumberOfPayer.find((inv) => inv.status === "issued");
        if (open) return { action: MATCH_ACTIONS.APPLY, invoice: open };
        const [closed] = byNumberOfPayer;
        const state = closed.status === "paid" ? "уже оплачен — возможна повторная оплата" : "отменён";
        return { action: MATCH_ACTIONS.REVIEW, reason: `Счёт №${closed.number} ${state}`, invoice: closed };
    }

    const withoutBin = invoicesByNumber.find((inv) => inv.status === "issued" && !normalizeBin(inv.buyerBin));
    if (withoutBin) {
        return {
            action: MATCH_ACTIONS.REVIEW,
            reason: `В назначении счёт №${withoutBin.number}, но у счёта не указан БИН покупателя`,
            invoice: withoutBin,
        };
    }

    const sameAmount = openInvoicesOfPayer.filter((inv) => toTiyn(inv.total) === toTiyn(tx.amount));
    if (sameAmount.length === 1) return { action: MATCH_ACTIONS.APPLY, invoice: sameAmount[0] };
    if (sameAmount.length > 1) {
        return {
            action: MATCH_ACTIONS.REVIEW,
            reason: `Несколько неоплаченных счетов на эту сумму: №${sameAmount.map((inv) => inv.number).join(", №")}`,
        };
    }
    if (!isKnownPayer) return { action: MATCH_ACTIONS.IGNORE };
    return {
        action: MATCH_ACTIONS.REVIEW,
        reason:
            invoicesByNumber.length > 0
                ? "Номер счёта в назначении есть, но БИН плательщика не совпадает с БИН покупателя"
                : "Не найден неоплаченный счёт этого плательщика на эту сумму",
    };
}
