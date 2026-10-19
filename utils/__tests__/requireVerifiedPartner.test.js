import { describe, test } from "node:test";
import assert from "node:assert/strict";
import requireVerifiedPartner from "../requireVerifiedPartner.js";

const run = (partner) => {
    const res = { statusCode: null, body: null };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    let passed = false;
    requireVerifiedPartner({ partner }, res, () => (passed = true));
    return { passed, res };
};

describe("requireVerifiedPartner", () => {
    test("lets only verified partners through", () => {
        assert.equal(run({ verification: { status: "verified" } }).passed, true);
    });

    test("waiting, denied and legacy partners without the field get 403", () => {
        for (const partner of [{ verification: { status: "waiting" } }, { verification: { status: "denied" } }, {}]) {
            const { passed, res } = run(partner);
            assert.equal(passed, false);
            assert.equal(res.body.code, "PARTNER_NOT_VERIFIED");
        }
    });
});
