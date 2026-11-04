import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { applyInvoicePayment, InvoicePaymentError } from "../invoicePayment.js";

const silentLogger = { error: () => {} };

/** In-memory репозиторий: claimInvoice атомарен (issued → paid один раз), paymentRef уникален */
const createRepo = ({ paymentMethod = "coupon", invoice = {} } = {}) => {
    const state = {
        invoice: { _id: "inv1", number: "913", client: "c1", status: "issued", total: 30000, qty19: 20, qty12: 2, ...invoice },
        client: { _id: "c1", paymentMethod, balance: 1000, paidBootlesFor19: 3, paidBootlesFor12: 0, notificationPushTokens: ["t1"] },
        usedRefs: new Set(),
        logs: [],
        payments: [],
        pushes: [],
        failSideEffects: false,
    };
    return {
        state,
        findInvoice: async () => ({ ...state.invoice }),
        findClient: async () => ({ ...state.client }),
        claimInvoice: async (_id, update) => {
            await Promise.resolve(); // даём параллельному вызову вклиниться
            if (update.paymentRef && state.usedRefs.has(update.paymentRef)) {
                throw Object.assign(new Error("E11000"), { code: 11000 });
            }
            if (state.invoice.status !== "issued") return null;
            if (update.paymentRef) state.usedRefs.add(update.paymentRef);
            state.invoice = { ...state.invoice, ...update };
            return { ...state.invoice };
        },
        incrementClient: async (_id, inc) => {
            state.client = Object.fromEntries(
                Object.entries(state.client).map(([key, value]) => [key, key in inc ? value + inc[key] : value])
            );
            return { ...state.client };
        },
        markCreditApplied: async () => {
            state.invoice = { ...state.invoice, creditApplied: true };
        },
        createOperationLogs: async (rows) => {
            if (state.failSideEffects) throw new Error("db down");
            state.logs.push(...rows);
        },
        createClientPayment: async (data) => state.payments.push(data),
        notifyClient: async (_client, payload) => state.pushes.push(payload),
    };
};

const manual = { invoiceId: "inv1", paymentSource: "manual", confirmedBy: "Арай", reason: "видела в выписке" };

describe("applyInvoicePayment", () => {
    test("coupon: credits bottles once, logs, records payment and pushes", async () => {
        const repo = createRepo();

        const result = await applyInvoicePayment(manual, repo, silentLogger);

        assert.equal(result.status, "applied");
        assert.equal(repo.state.client.paidBootlesFor19, 23);
        assert.equal(repo.state.client.paidBootlesFor12, 2);
        assert.equal(repo.state.client.balance, 1000);
        assert.equal(repo.state.invoice.creditApplied, true);
        assert.deepEqual(
            repo.state.logs.map(({ field, oldValue, newValue }) => [field, oldValue, newValue]),
            [["paidBootlesFor19", 3, 23], ["paidBootlesFor12", 0, 2]]
        );
        assert.equal(repo.state.logs[0].reason, "Оплата счёта №913: видела в выписке");
        assert.equal(repo.state.payments[0].sessionOrderId, "INV-913");
        assert.equal(repo.state.pushes.length, 1);
    });

    test("calling twice credits only once", async () => {
        const repo = createRepo();
        await applyInvoicePayment(manual, repo, silentLogger);

        const second = await applyInvoicePayment(manual, repo, silentLogger);

        assert.equal(second.status, "already_paid");
        assert.equal(repo.state.client.paidBootlesFor19, 23);
    });

    test("two parallel calls credit only once", async () => {
        const repo = createRepo({ paymentMethod: "balance" });

        const results = await Promise.all([
            applyInvoicePayment(manual, repo, silentLogger),
            applyInvoicePayment(manual, repo, silentLogger),
        ]);

        assert.deepEqual(results.map((r) => r.status).sort(), ["already_paid", "applied"]);
        assert.equal(repo.state.client.balance, 1000 + 30000);
    });

    test("underpayment is rejected for review and nothing changes", async () => {
        const repo = createRepo();

        await assert.rejects(
            applyInvoicePayment({ ...manual, paidAmount: 25000 }, repo, silentLogger),
            (error) => error instanceof InvoicePaymentError && error.code === "REVIEW"
        );
        assert.equal(repo.state.invoice.status, "issued");
        assert.equal(repo.state.client.paidBootlesFor19, 3);
    });

    test("fakt client: automatic payment goes to review", async () => {
        const repo = createRepo({ paymentMethod: "fakt" });

        await assert.rejects(
            applyInvoicePayment({ ...manual, paymentSource: "bank_statement" }, repo, silentLogger),
            (error) => error.code === "REVIEW"
        );
    });

    test("fakt client: manager confirmation marks paid without crediting", async () => {
        const repo = createRepo({ paymentMethod: "fakt" });

        const result = await applyInvoicePayment({ ...manual, allowFakt: true }, repo, silentLogger);

        assert.equal(result.status, "applied");
        assert.equal(repo.state.invoice.creditKind, "none");
        assert.equal(repo.state.client.balance, 1000);
        assert.equal(repo.state.logs.length, 0);
    });

    test("the same bank operation cannot close a second invoice", async () => {
        const repo = createRepo();
        repo.state.usedRefs.add("forte:1");

        await assert.rejects(
            applyInvoicePayment({ ...manual, paymentRef: "forte:1" }, repo, silentLogger),
            (error) => error.code === "DUPLICATE_REF"
        );
        assert.equal(repo.state.client.paidBootlesFor19, 3);
    });

    test("cancelled invoice cannot be paid", async () => {
        const repo = createRepo({ invoice: { status: "cancelled" } });

        await assert.rejects(applyInvoicePayment(manual, repo, silentLogger), (error) => error.code === "CANCELLED");
    });

    test("a failing journal does not undo the credit", async () => {
        const repo = createRepo();
        repo.state.failSideEffects = true;

        const result = await applyInvoicePayment(manual, repo, silentLogger);

        assert.equal(result.status, "applied");
        assert.equal(repo.state.client.paidBootlesFor19, 23);
        assert.equal(repo.state.payments.length, 1);
        assert.equal(repo.state.pushes.length, 1);
    });
});
