import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sendPartnerPush } from "../partnerPush.js";

const VALID = "ExponentPushToken[abc123]";
const STALE = "ExponentPushToken[old456]";
const silentLogger = { error() {} };

const deps = (tokens, tickets, overrides = {}) => {
    const calls = { sent: null, removed: null };
    return {
        calls,
        deps: {
            findTokens: async () => tokens,
            send: async (messages) => ((calls.sent = messages), tickets),
            removeTokens: async (_id, list) => (calls.removed = list),
            logger: silentLogger,
            ...overrides,
        },
    };
};

describe("sendPartnerPush", () => {
    test("sends to valid Expo tokens and drops unregistered devices", async () => {
        const { calls, deps: d } = deps([VALID, STALE, "garbage"], [
            { status: "ok" },
            { status: "error", details: { error: "DeviceNotRegistered" } },
        ]);

        const result = await sendPartnerPush("p1", { title: "T", body: "B" }, d);

        assert.equal(result.sent, 1);
        assert.deepEqual(calls.sent.map((m) => m.to), [VALID, STALE]);
        assert.deepEqual(calls.removed, [STALE]);
    });

    test("does nothing without tokens", async () => {
        const { calls, deps: d } = deps([], []);

        assert.deepEqual(await sendPartnerPush("p1", { title: "T", body: "B" }, d), { sent: 0 });
        assert.equal(calls.sent, null);
    });

    test("never throws when Expo is unavailable", async () => {
        const { deps: d } = deps([VALID], [], { send: async () => { throw new Error("network"); } });

        assert.deepEqual(await sendPartnerPush("p1", { title: "T", body: "B" }, d), { sent: 0 });
    });
});
