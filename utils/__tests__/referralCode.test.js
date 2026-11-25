import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLetterCodeInput, normalizeReferralCodeInput } from "../referralCode.js";

describe("normalizeReferralCodeInput", () => {
    test("accepts latin letters and digits in any case and spacing", () => {
        assert.equal(normalizeReferralCodeInput(" abcd efgh-ijkl "), "ABCD-EFGH-IJKL");
        assert.equal(normalizeReferralCodeInput("tib12025ab3c"), "TIB1-2025-AB3C");
        assert.equal(normalizeReferralCodeInput("1234-5678-9012"), "1234-5678-9012");
    });

    test("picks the code out of a pasted invitation that contains other digits", () => {
        const invitation =
            "Приглашаю тебя\n1. Скопируй это сообщение. Код приглашения: TIB1-2025-AB3C\n2. Скачай: https://apps.apple.com/app/id6740";

        assert.equal(normalizeReferralCodeInput(invitation), "TIB1-2025-AB3C");
        assert.equal(normalizeReferralCodeInput("Код: abcd-efgh-ijkl"), "ABCD-EFGH-IJKL");
    });

    test("rejects wrong length, cyrillic look-alikes and non-strings", () => {
        assert.equal(normalizeReferralCodeInput("ABCD-EFGH"), null);
        assert.equal(normalizeReferralCodeInput("ABCD-EFGH-IJKL1"), null);
        assert.equal(normalizeReferralCodeInput("АВСD-EFGH-IJKL"), null);
        assert.equal(normalizeReferralCodeInput(123456789012), null);
        assert.equal(normalizeReferralCodeInput(""), null);
    });
});

describe("normalizeLetterCodeInput", () => {
    test("stays letters-only", () => {
        assert.equal(normalizeLetterCodeInput("abcd-efgh-ijkl"), "ABCD-EFGH-IJKL");
        assert.equal(normalizeLetterCodeInput("ABCD-EFGH-IJK1"), null);
    });
});
