import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { claimInvoiceCheck, INVOICE_CHECK_COOLDOWN_MS, summarizeInvoiceCheck } from "../invoicePaymentCheck.js";

/** In-memory аналог атомарного findOneAndUpdate по Client.invoicePaymentCheckedAt */
function createRepo(initialCheckedAt = null) {
    let checkedAt = initialCheckedAt;
    return {
        async claim(_clientId, now, cutoff) {
            if (checkedAt && checkedAt > cutoff) return null;
            const previousCheckedAt = checkedAt;
            checkedAt = now;
            return { previousCheckedAt };
        },
        async getCheckedAt() {
            return checkedAt;
        },
    };
}

describe("claimInvoiceCheck", () => {
    test("первая проверка разрешена, следующая — через 15 минут", async () => {
        const now = new Date("2026-11-03T10:00:00Z");
        const result = await claimInvoiceCheck("c1", createRepo(), now);
        assert.equal(result.claimed, true);
        assert.equal(result.previousCheckedAt, null);
        assert.equal(result.claimedAt, now);
        assert.equal(result.nextCheckAt.getTime(), now.getTime() + INVOICE_CHECK_COOLDOWN_MS);
    });

    test("повторное нажатие раньше 15 минут отклоняется и сообщает время следующей проверки", async () => {
        const repo = createRepo();
        await claimInvoiceCheck("c1", repo, new Date("2026-11-03T10:00:00Z"));
        const result = await claimInvoiceCheck("c1", repo, new Date("2026-11-03T10:14:00Z"));
        assert.equal(result.claimed, false);
        assert.equal(result.nextCheckAt.toISOString(), "2026-11-03T10:15:00.000Z");
    });

    test("через 15 минут проверка снова разрешена", async () => {
        const repo = createRepo(new Date("2026-11-03T10:00:00Z"));
        const result = await claimInvoiceCheck("c1", repo, new Date("2026-11-03T10:15:00Z"));
        assert.equal(result.claimed, true);
    });

    test("одновременные нажатия: проходит только одно", async () => {
        const repo = createRepo();
        const now = new Date("2026-11-03T10:00:00Z");
        const results = await Promise.all([1, 2, 3, 4, 5].map(() => claimInvoiceCheck("c1", repo, now)));
        assert.equal(results.filter((r) => r.claimed).length, 1);
    });
});

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
