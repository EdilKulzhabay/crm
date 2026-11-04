import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { canUserAccessClient } from "../crmClientAccess.js";

const FRANCHISEE_ID = "f".repeat(24);

describe("canUserAccessClient", () => {
    test("super admin sees any client", () => {
        assert.equal(canUserAccessClient({ role: "superAdmin", _id: "x" }, { franchisee: FRANCHISEE_ID }), true);
    });

    test("franchisee sees only own clients", () => {
        const admin = { role: "admin", _id: FRANCHISEE_ID };

        assert.equal(canUserAccessClient(admin, { franchisee: FRANCHISEE_ID }), true);
        assert.equal(canUserAccessClient(admin, { franchisee: "a".repeat(24) }), false);
    });

    test("other roles and missing records are denied", () => {
        assert.equal(canUserAccessClient({ role: "operator", _id: FRANCHISEE_ID }, { franchisee: FRANCHISEE_ID }), false);
        assert.equal(canUserAccessClient(null, { franchisee: FRANCHISEE_ID }), false);
        assert.equal(canUserAccessClient({ role: "superAdmin" }, null), false);
    });
});
