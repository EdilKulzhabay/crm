import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseAlmatyDayRange } from "../almatyDateRange.js";

describe("parseAlmatyDayRange", () => {
    test("covers whole Almaty days (UTC+5)", () => {
        const range = parseAlmatyDayRange("2026-10-01", "2026-10-02");

        assert.equal(range.start.toISOString(), "2026-09-30T19:00:00.000Z");
        assert.equal(range.end.toISOString(), "2026-10-02T18:59:59.999Z");
    });

    test("rejects malformed or reversed dates", () => {
        assert.equal(parseAlmatyDayRange("2026-10", "2026-10-02"), null);
        assert.equal(parseAlmatyDayRange(undefined, "2026-10-02"), null);
        assert.equal(parseAlmatyDayRange("2026-10-05", "2026-10-02"), null);
        assert.equal(parseAlmatyDayRange("2026-13-40", "2026-13-41"), null);
    });
});
