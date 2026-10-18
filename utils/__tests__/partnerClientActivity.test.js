import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { clientRhythm, shiftDay } from "../partnerClientActivity.js";
import { checkPartnerClientLapses } from "../partnerLapseCheck.js";

describe("clientRhythm", () => {
    test("Абай orders every 3 days and has not ordered for 4 days → lapsed", () => {
        const rhythm = clientRhythm(["2026-10-01", "2026-10-04", "2026-10-07"], "2026-10-11");

        assert.deepEqual(rhythm, {
            lastOrderDay: "2026-10-07",
            daysSinceLast: 4,
            intervalDays: 3,
            isLapsed: true,
            hasActiveOrder: false,
        });
    });

    test("exactly one interval passed → still in rhythm", () => {
        assert.equal(clientRhythm(["2026-10-01", "2026-10-04", "2026-10-07"], "2026-10-10").isLapsed, false);
    });

    test("uses only the last three orders and rounds the average up", () => {
        const rhythm = clientRhythm(["2026-09-01", "2026-10-01", "2026-10-04", "2026-10-08"], "2026-10-12");

        assert.equal(rhythm.intervalDays, 4); // интервалы 3 и 4 → 3.5 → 4
        assert.equal(rhythm.isLapsed, false);
    });

    test("needs three orders on different days to define a rhythm", () => {
        const rhythm = clientRhythm(["2026-10-01", "2026-10-01", "2026-10-04"], "2026-10-30");

        assert.equal(rhythm.intervalDays, null);
        assert.equal(rhythm.isLapsed, false);
    });

    test("an order in progress means the client has not stopped ordering", () => {
        assert.equal(clientRhythm(["2026-10-01", "2026-10-04", "2026-10-07"], "2026-10-11", true).isLapsed, false);
    });

    test("shiftDay crosses month boundaries", () => {
        assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
    });
});

describe("checkPartnerClientLapses", () => {
    const LAPSED = { lastOrderDay: "2026-10-07", daysSinceLast: 4, intervalDays: 3, isLapsed: true };

    const createDeps = (clients, rhythms) => {
        const calls = { marked: [], pushes: [] };
        return {
            calls,
            deps: {
                today: () => "2026-10-11",
                listPartnerClients: async () => clients,
                loadRhythm: async () => new Map(Object.entries(rhythms)),
                markNotified: async (id, day) => calls.marked.push({ id, day }),
                notify: async (partnerId, message) => calls.pushes.push({ partnerId, ...message }),
                logger: { log() {} },
            },
        };
    };

    test("notifies the partner once about a lapsed client", async () => {
        const { calls, deps } = createDeps(
            [
                { _id: "c1", userName: "Абай Серіков", referredByPartner: "p1", partnerLapseNotifiedDay: null },
                { _id: "c2", userName: "Дана", referredByPartner: "p1", partnerLapseNotifiedDay: null },
            ],
            { c1: LAPSED, c2: { ...LAPSED, isLapsed: false } }
        );

        assert.equal(await checkPartnerClientLapses(deps), 1);
        assert.deepEqual(calls.marked, [{ id: "c1", day: "2026-10-07" }]);
        assert.equal(calls.pushes[0].partnerId, "p1");
        assert.match(calls.pushes[0].body, /Абай С\. обычно заказывает воду раз в 3 дн\., но не заказывал уже 4 дн\./);
        assert.deepEqual(calls.pushes[0].data, { type: "client_lapsed", clientId: "c1" });
    });

    test("does not repeat the notification for the same break", async () => {
        const { calls, deps } = createDeps(
            [{ _id: "c1", userName: "Абай", referredByPartner: "p1", partnerLapseNotifiedDay: "2026-10-07" }],
            { c1: LAPSED }
        );

        assert.equal(await checkPartnerClientLapses(deps), 0);
        assert.equal(calls.pushes.length, 0);
    });
});
