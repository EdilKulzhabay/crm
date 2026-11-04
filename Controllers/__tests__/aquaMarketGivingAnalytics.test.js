import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildAquaMarketGivingPipeline, summarizeAquaMarketGiving } from "../AquaMarketController.js";

const row = (aquaMarketId, courierId, full, empty = { b12: 0, b19: 0 }, givingCount = 1) => ({
    aquaMarketId,
    aquaMarketAddress: `Адрес ${aquaMarketId}`,
    courierId,
    courierName: courierId ? `Курьер ${courierId}` : undefined,
    givingCount,
    full,
    empty,
});

describe("buildAquaMarketGivingPipeline", () => {
    test("filters courier handouts and returns within the period", () => {
        const range = { start: new Date("2026-10-01T00:00:00+05:00"), end: new Date("2026-10-01T23:59:59+05:00") };

        const [match] = buildAquaMarketGivingPipeline(range);

        assert.deepEqual(match.$match, {
            actionType: { $in: ["giving", "receiving"] },
            createdAt: { $gte: range.start, $lte: range.end },
        });
    });
});

describe("summarizeAquaMarketGiving", () => {
    test("groups couriers under aquamarkets and sums totals", () => {
        const result = summarizeAquaMarketGiving([
            row("m1", "c1", { b12: 2, b19: 10 }, { b12: 1, b19: 8 }, 2),
            row("m1", "c2", { b12: 0, b19: 5 }),
            row("m2", "c1", { b12: 1, b19: 1 }),
        ]);

        assert.deepEqual(result.totals, { givingCount: 4, full: { b12: 3, b19: 16 }, empty: { b12: 1, b19: 8 } });
        assert.deepEqual(result.aquaMarkets.map((m) => m.aquaMarketId), ["m1", "m2"]);
        assert.deepEqual(result.aquaMarkets[0].totals.full, { b12: 2, b19: 15 });
        assert.deepEqual(result.aquaMarkets[0].couriers.map((c) => c.courierId), ["c1", "c2"]);
    });

    test("sorts couriers by bottles taken and labels missing couriers", () => {
        const result = summarizeAquaMarketGiving([
            row("m1", null, { b12: 0, b19: 1 }),
            row("m1", "c9", { b12: 0, b19: 7 }),
        ]);

        assert.deepEqual(result.aquaMarkets[0].couriers.map((c) => c.courierName), ["Курьер c9", "Без курьера"]);
    });

    test("returns empty totals for a period without handouts", () => {
        assert.deepEqual(summarizeAquaMarketGiving([]), {
            aquaMarkets: [],
            totals: { givingCount: 0, full: { b12: 0, b19: 0 }, empty: { b12: 0, b19: 0 } },
        });
    });
});
