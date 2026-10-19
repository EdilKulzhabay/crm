import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyRows, buildPartnerRow, parsePeriod, periodMatch, summarizePartners } from "../partnerAnalytics.js";

describe("parsePeriod", () => {
    test("uses Almaty days, end date inclusive", () => {
        const { from, to } = parsePeriod({ startDate: "2026-10-01", endDate: "2026-10-31" });

        assert.equal(from.toISOString(), "2026-09-30T19:00:00.000Z");
        assert.equal(to.toISOString(), "2026-10-31T19:00:00.000Z");
    });

    test("empty bounds mean all time", () => {
        assert.deepEqual(parsePeriod({}), { from: null, to: null });
        assert.deepEqual(periodMatch({ from: null, to: null }), {});
    });

    test("rejects malformed or reversed dates", () => {
        assert.equal(parsePeriod({ startDate: "01.10.2026" }), null);
        assert.equal(parsePeriod({ startDate: { $gt: "" } }), null);
        assert.equal(parsePeriod({ startDate: "2026-10-31", endDate: "2026-10-01" }), null);
    });
});

describe("buildPartnerRow / summarizePartners", () => {
    const partner = (id, status = "active") => ({ _id: id, userName: id, phone: "", referralCode: "", status, balance: 100 });

    test("period sums come from the journal, pending is current", () => {
        const row = buildPartnerRow(partner("p1"), {
            periodTotals: { referralBonus: 400, referralCount: 2, orderBonus: 1200, bottles: 6, paidOut: 500, pendingOut: 0 },
            pendingTotals: { pendingOut: 300, pendingCount: 1 },
            clientTotals: { clients: 5, orderedClients: 3 },
        });

        assert.equal(row.earned, 1600);
        assert.equal(row.paidOut, 500);
        assert.equal(row.pendingOut, 300);
        assert.equal(row.clients, 5);
    });

    test("partners without activity get zeros and the summary adds up", () => {
        const rows = [
            buildPartnerRow(partner("p1"), { periodTotals: { orderBonus: 200 }, clientTotals: { clients: 1 } }),
            buildPartnerRow(partner("p2", "blocked")),
        ];

        const summary = summarizePartners(rows);

        assert.equal(rows[1].earned, 0);
        assert.deepEqual(
            [summary.partners, summary.activePartners, summary.earned, summary.clients, summary.balance],
            [2, 1, 200, 1, 200]
        );
    });

    test("monthly rows are newest first", () => {
        const rows = buildMonthlyRows([{ _id: "2026-08", orderBonus: 200 }, { _id: "2026-10", referralBonus: 200 }]);

        assert.deepEqual(rows.map((row) => [row.month, row.earned]), [["2026-10", 200], ["2026-08", 200]]);
    });
});
