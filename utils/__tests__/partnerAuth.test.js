import { describe, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { signPartnerToken, verifyPartnerToken } from "../partnerToken.js";
import { createCheckAuthPartner } from "../checkAuthPartner.js";

const SECRET = "test-secret";
const PARTNER_ID = "a".repeat(24);

const createRes = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (body) => {
        res.body = body;
        return res;
    };
    return res;
};

describe("partner token", () => {
    test("round-trips the partner id", () => {
        const token = signPartnerToken(PARTNER_ID, SECRET);

        assert.equal(verifyPartnerToken(token, SECRET), PARTNER_ID);
    });

    test("is not verifiable with the shared SecretKey used by checkAuth/checkAuthAggregator", () => {
        const token = signPartnerToken(PARTNER_ID, SECRET);

        assert.throws(() => jwt.verify(token, SECRET));
    });

    test("rejects a client token signed with the shared SecretKey", () => {
        const clientToken = jwt.sign({ client: PARTNER_ID }, SECRET);

        assert.equal(verifyPartnerToken(clientToken, SECRET), null);
    });

    test("rejects garbage and empty tokens", () => {
        assert.equal(verifyPartnerToken("not-a-jwt", SECRET), null);
        assert.equal(verifyPartnerToken("", SECRET), null);
    });

    test("refuses to sign without a secret", () => {
        assert.throws(() => signPartnerToken(PARTNER_ID, ""), /SecretKey/);
    });
});

describe("checkAuthPartner", () => {
    const run = async ({ authorization, partner, verifyToken = () => PARTNER_ID }) => {
        const middleware = createCheckAuthPartner({
            verifyToken,
            findPartnerById: async () => partner,
        });
        const req = { headers: { authorization } };
        const res = createRes();
        let nextCalled = false;
        await middleware(req, res, () => {
            nextCalled = true;
        });
        return { req, res, nextCalled };
    };

    test("attaches an active partner and calls next", async () => {
        const { req, nextCalled } = await run({
            authorization: "Bearer token",
            partner: { _id: PARTNER_ID, status: "active" },
        });

        assert.equal(nextCalled, true);
        assert.equal(req.partnerId, PARTNER_ID);
    });

    test("returns 401 for an invalid token", async () => {
        const { res, nextCalled } = await run({
            authorization: "Bearer bad",
            verifyToken: () => null,
            partner: null,
        });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 401);
    });

    test("returns 401 when the partner no longer exists", async () => {
        const { res } = await run({ authorization: "Bearer token", partner: null });

        assert.equal(res.statusCode, 401);
    });

    test("returns 401 for a deleted account so every device signs out", async () => {
        const { res, nextCalled } = await run({
            authorization: "Bearer token",
            partner: { _id: PARTNER_ID, status: "deleted" },
        });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 401);
    });

    test("returns 403 for a blocked partner", async () => {
        const { res, nextCalled } = await run({
            authorization: "Bearer token",
            partner: { _id: PARTNER_ID, status: "blocked" },
        });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 403);
    });
});
