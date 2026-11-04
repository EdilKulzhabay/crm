import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getSyncPeriod, mapForteTransaction, processBankTransaction, syncBankStatement } from "../bankStatementSync.js";
import { InvoicePaymentError } from "../invoicePayment.js";

const BIN = "123456789012";
const openInvoice = { _id: "inv1", number: "913", numberKey: "913", buyerBin: BIN, status: "issued", total: 30000 };

const forteOperation = (overrides = {}) => ({
    id: 354785793,
    documentNumber: "539",
    historyDate: "2026-11-02T00:00:00Z",
    payer: "ТОО Ромашка",
    payerBin: BIN,
    paymentPurpose: "Оплата по счёту № 913",
    amount: 30000,
    currency: "KZT",
    ...overrides,
});

/** In-memory BankTransaction + Invoice; applyPayment закрывает счёт один раз */
const createDeps = ({ operations = [forteOperation()], invoices = [openInvoice], applyError = null } = {}) => {
    const state = { transactions: [], invoices: invoices.map((inv) => ({ ...inv })), applied: [] };
    return {
        state,
        now: () => Date.parse("2026-11-02T10:00:00Z"),
        findLatestTransactionDate: async () => null,
        fetchIncoming: async () => operations,
        saveIfNew: async (doc) => {
            if (state.transactions.some((t) => t.bankRef === doc.bankRef)) return 0;
            state.transactions.push({ _id: `t${state.transactions.length + 1}`, status: "new", ...doc });
            return 1;
        },
        listNew: async () => state.transactions.filter((t) => t.status === "new"),
        findInvoiceByPaymentRef: async (ref) => state.invoices.find((inv) => inv.paymentRef === ref) ?? null,
        findInvoicesByNumberKeys: async (keys) => state.invoices.filter((inv) => keys.includes(inv.numberKey)),
        findOpenInvoicesByBin: async (bin) => state.invoices.filter((inv) => inv.buyerBin === bin && inv.status === "issued"),
        hasInvoicesForBin: async (bin) => state.invoices.some((inv) => inv.buyerBin === bin),
        resolveTransaction: async (id, update) => {
            state.transactions = state.transactions.map((t) => (t._id === id && t.status === "new" ? { ...t, ...update } : t));
        },
        applyPayment: async (params) => {
            if (applyError) throw applyError;
            const inv = state.invoices.find((i) => i._id === params.invoiceId);
            if (inv.status === "paid") return { status: "already_paid", invoice: inv };
            Object.assign(inv, { status: "paid", paymentRef: params.paymentRef });
            state.applied.push(params);
            return { status: "applied", invoice: inv };
        },
        logger: { error: () => {} },
    };
};

describe("bank statement sync", () => {
    test("maps a Forte operation to a bank transaction", () => {
        const doc = mapForteTransaction(forteOperation());
        assert.equal(doc.bankRef, "354785793");
        assert.equal(doc.payerBin, BIN);
        assert.equal(doc.purpose, "Оплата по счёту № 913");
        assert.equal(doc.date.toISOString(), "2026-11-02T00:00:00.000Z");
    });

    test("a matching payment closes the invoice with the bank reference", async () => {
        const deps = createDeps();

        const stats = await syncBankStatement(deps);

        assert.equal(stats.matched, 1);
        assert.equal(deps.state.applied[0].paymentRef, "forte:354785793");
        assert.equal(deps.state.applied[0].paidAmount, 30000);
        assert.equal(deps.state.transactions[0].status, "matched");
    });

    test("loading the same statement again credits nothing new", async () => {
        const deps = createDeps();
        await syncBankStatement(deps);

        const second = await syncBankStatement(deps);

        assert.equal(second.inserted, 0);
        assert.equal(second.matched, 0);
        assert.equal(deps.state.applied.length, 1);
    });

    test("crash after crediting: next run marks the operation matched without paying again", async () => {
        const deps = createDeps({ invoices: [{ ...openInvoice, status: "paid", paymentRef: "forte:354785793" }] });

        const stats = await syncBankStatement(deps);

        assert.equal(stats.matched, 1);
        assert.equal(deps.state.applied.length, 0);
    });

    test("underpayment goes to review with the reason", async () => {
        const deps = createDeps({ applyError: new InvoicePaymentError("REVIEW", "Недоплата по счёту №913") });

        const stats = await syncBankStatement(deps);

        assert.equal(stats.needs_review, 1);
        assert.equal(deps.state.transactions[0].reviewReason, "Недоплата по счёту №913");
    });

    test("payments from payers without invoices are ignored", async () => {
        const deps = createDeps({ operations: [forteOperation({ payerBin: "987654321098", paymentPurpose: "За информационные услуги" })] });

        const stats = await syncBankStatement(deps);

        assert.equal(stats.ignored, 1);
        assert.equal(deps.state.applied.length, 0);
    });

    test("an unexpected error leaves the operation for the next run", async () => {
        const deps = createDeps({ applyError: new Error("mongo down") });
        await syncBankStatement(deps);
        const [tx] = deps.state.transactions;

        const result = await processBankTransaction(tx, deps);

        assert.equal(result, "failed");
        assert.equal(deps.state.transactions[0].status, "new");
    });
});

describe("getSyncPeriod", () => {
    const now = Date.parse("2026-11-03T10:00:00Z");
    const daysAgo = (period) => Math.round((now - period.from.getTime()) / 86_400_000);

    test("первый запуск читает 31 день", () => {
        assert.equal(daysAgo(getSyncPeriod(now, null)), 31);
    });

    test("частые проверки читают последние 5 дней", () => {
        assert.equal(daysAgo(getSyncPeriod(now, new Date("2026-11-03T09:00:00Z"))), 5);
    });

    test("после перерыва читаем от последней операции с запасом 5 дней", () => {
        assert.equal(daysAgo(getSyncPeriod(now, new Date("2026-10-24T10:00:00Z"))), 15);
    });

    test("не дальше 31 дня даже после долгого перерыва", () => {
        assert.equal(daysAgo(getSyncPeriod(now, new Date("2026-08-01T00:00:00Z"))), 31);
    });
});
