import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createPhoneOtpStore, OTP_VERIFY_RESULT } from "../phoneOtpStore.js";

const PHONE = "77001234567";
const PURPOSE = "partner-register";
const CODE = "123456";

describe("createPhoneOtpStore", () => {
    let nowMs;
    let store;

    beforeEach(() => {
        nowMs = Date.UTC(2026, 9, 15, 10);
        store = createPhoneOtpStore({
            now: () => nowMs,
            generateCode: () => CODE,
            codeTtlMs: 5 * 60 * 1000,
            cooldownMs: 60 * 1000,
            maxAttempts: 3,
            verificationTtlMs: 15 * 60 * 1000,
            failureWindowMs: 60 * 60 * 1000,
            maxFailuresPerWindow: 4,
        });
    });

    const issueDelivered = () => {
        const code = store.issue(PURPOSE, PHONE);
        store.finishSend(PURPOSE, PHONE, { delivered: true });
        return code;
    };

    test("accepts the issued code exactly once", () => {
        issueDelivered();

        assert.equal(store.verify(PURPOSE, PHONE, CODE), OTP_VERIFY_RESULT.OK);
        assert.equal(store.verify(PURPOSE, PHONE, CODE), OTP_VERIFY_RESULT.MISSING);
    });

    test("does not accept a code issued for another purpose", () => {
        issueDelivered();

        assert.equal(store.verify("partner-login", PHONE, CODE), OTP_VERIFY_RESULT.MISSING);
    });

    test("rejects an expired code", () => {
        issueDelivered();
        nowMs += 5 * 60 * 1000;

        assert.equal(store.verify(PURPOSE, PHONE, CODE), OTP_VERIFY_RESULT.EXPIRED);
    });

    test("burns the code after the maximum number of wrong attempts", () => {
        issueDelivered();

        assert.equal(store.verify(PURPOSE, PHONE, "000000"), OTP_VERIFY_RESULT.INVALID);
        assert.equal(store.verify(PURPOSE, PHONE, "000001"), OTP_VERIFY_RESULT.INVALID);
        assert.equal(store.verify(PURPOSE, PHONE, "000002"), OTP_VERIFY_RESULT.TOO_MANY_ATTEMPTS);
        assert.equal(store.verify(PURPOSE, PHONE, CODE), OTP_VERIFY_RESULT.MISSING);
    });

    test("enforces the resend cooldown and reports remaining seconds", () => {
        issueDelivered();
        nowMs += 20 * 1000;

        assert.deepEqual(store.checkSendAllowed(PURPOSE, PHONE), { reason: "cooldown", retryAfterSec: 40 });

        nowMs += 40 * 1000;
        assert.equal(store.checkSendAllowed(PURPOSE, PHONE), null);
    });

    test("blocks a parallel send while delivery is in progress", () => {
        store.issue(PURPOSE, PHONE);

        assert.equal(store.checkSendAllowed(PURPOSE, PHONE).reason, "in_progress");
    });

    test("failed delivery revokes the code and lifts the cooldown", () => {
        store.issue(PURPOSE, PHONE);
        store.finishSend(PURPOSE, PHONE, { delivered: false });

        assert.equal(store.checkSendAllowed(PURPOSE, PHONE), null);
        assert.equal(store.verify(PURPOSE, PHONE, CODE), OTP_VERIFY_RESULT.MISSING);
    });

    test("verification mark expires after its TTL and can be cleared", () => {
        store.markVerified(PURPOSE, PHONE);
        assert.equal(store.isVerified(PURPOSE, PHONE), true);
        assert.equal(store.isVerified("partner-login", PHONE), false);

        store.clearVerified(PURPOSE, PHONE);
        assert.equal(store.isVerified(PURPOSE, PHONE), false);

        store.markVerified(PURPOSE, PHONE);
        nowMs += 15 * 60 * 1000 + 1;
        assert.equal(store.isVerified(PURPOSE, PHONE), false);
    });

    test("cooldown is tracked per purpose", () => {
        issueDelivered();

        assert.equal(store.checkSendAllowed("partner-login", PHONE), null);
    });

    test("locks the phone after too many wrong codes across several issued codes", () => {
        issueDelivered();
        store.verify(PURPOSE, PHONE, "000000");
        store.verify(PURPOSE, PHONE, "000001");
        nowMs += 60 * 1000;
        issueDelivered();
        store.verify(PURPOSE, PHONE, "000002");

        assert.equal(store.verify(PURPOSE, PHONE, "000003"), OTP_VERIFY_RESULT.TOO_MANY_ATTEMPTS);
        nowMs += 60 * 1000;
        assert.equal(store.checkSendAllowed(PURPOSE, PHONE).reason, "locked");
        assert.equal(store.checkSendAllowed("partner-login", PHONE).reason, "locked");

        nowMs += 60 * 60 * 1000;
        assert.equal(store.checkSendAllowed(PURPOSE, PHONE), null);
    });

    test("default generator yields 6-digit numeric codes", () => {
        const realStore = createPhoneOtpStore();
        const code = realStore.issue(PURPOSE, PHONE);

        assert.match(code, /^\d{6}$/);
    });
});
