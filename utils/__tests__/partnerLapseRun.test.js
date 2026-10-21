import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { runPartnerLapseCheck } from "../partnerLapseCheck.js";

describe("runPartnerLapseCheck", () => {
    test("parallel runs share one check and notify once", async () => {
        const pushes = [];
        const deps = {
            today: () => "2026-10-11",
            listPartnerClients: async () => [{ _id: "c1", userName: "Марат", referredByPartner: "p1", partnerLapseNotifiedDay: null }],
            loadRhythm: async () =>
                new Map([["c1", { isLapsed: true, lastOrderDay: "2026-10-07", intervalDays: 3, daysSinceLast: 4 }]]),
            markNotified: async () => undefined,
            notify: async (partnerId, message) => pushes.push(message),
            logger: { log() {} },
        };

        const results = await Promise.all([runPartnerLapseCheck(deps), runPartnerLapseCheck(deps)]);

        assert.deepEqual(results, [1, 1]);
        assert.equal(pushes.length, 1);
    });
});
