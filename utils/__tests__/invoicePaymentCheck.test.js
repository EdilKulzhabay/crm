import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { summarizeInvoiceCheck } from "../invoicePaymentCheck.js";

describe("summarizeInvoiceCheck", () => {
    test("нет неоплаченных счетов", () => {
        assert.deepEqual(summarizeInvoiceCheck([]), { status: "none", waitingCount: 0 });
    });

    test("счёт ещё не оплачен", () => {
        assert.deepEqual(summarizeInvoiceCheck([{ status: "issued" }]), { status: "waiting", waitingCount: 1 });
    });

    test("один счёт оплачен — возвращаем его зачисление", () => {
        const result = summarizeInvoiceCheck([
            { status: "paid", creditKind: "bottles", credited: { b19: 20, b12: 0, balance: 500 } },
            { status: "issued" },
        ]);
        assert.equal(result.status, "paid");
        assert.equal(result.waitingCount, 1);
        assert.equal(result.creditKind, "bottles");
        assert.deepEqual(result.credited, { b19: 20, b12: 0, balance: 500 });
    });

    test("несколько оплаченных счетов — зачисления суммируются", () => {
        const result = summarizeInvoiceCheck([
            { status: "paid", creditKind: "balance", credited: { b19: 0, b12: 0, balance: 1000 } },
            { status: "paid", creditKind: "balance", credited: { b19: 0, b12: 0, balance: 2500 } },
        ]);
        assert.equal(result.creditKind, "balance");
        assert.deepEqual(result.credited, { b19: 0, b12: 0, balance: 3500 });
    });

    test("выбранный счёт отменён", () => {
        assert.deepEqual(summarizeInvoiceCheck([{ status: "cancelled" }]), { status: "cancelled", waitingCount: 0 });
    });
});
