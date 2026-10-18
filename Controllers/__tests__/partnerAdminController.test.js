import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createPartnerAdminController } from "../PartnerAdminController.js";
import { createRequireSuperAdmin } from "../../utils/requireSuperAdmin.js";

const CLIENT_ID = "a".repeat(24);
const PARTNER_ID = "b".repeat(24);
const PARTNER = { _id: PARTNER_ID, userName: "Алия", phone: "+7 700", referralCode: "ABCD-EFGH-IJKL", status: "active" };
const silentLogger = { log() {}, error() {} };

const createRes = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    return res;
};

describe("PartnerAdminController", () => {
    let binding;
    let controller;

    beforeEach(() => {
        binding = null;
        controller = createPartnerAdminController({
            repo: {
                searchPartners: async () => [PARTNER],
                findClientPartnerId: async (id) => (id === CLIENT_ID ? binding : undefined),
                findPartner: async (id) => (id === PARTNER_ID ? PARTNER : null),
                setClientPartner: async (id, partnerId) => (id === CLIENT_ID ? ((binding = partnerId), { _id: id }) : null),
            },
            logger: silentLogger,
        });
    });

    const call = async (handler, body) => {
        const res = createRes();
        await controller[handler]({ body, userId: "admin" }, res);
        return res;
    };

    test("binds and unbinds a client", async () => {
        const bound = await call("setClientPartner", { clientId: CLIENT_ID, partnerId: PARTNER_ID });
        const current = await call("getClientPartnerAdmin", { clientId: CLIENT_ID });
        const unbound = await call("setClientPartner", { clientId: CLIENT_ID, partnerId: null });

        assert.equal(bound.body.partner.referralCode, "ABCD-EFGH-IJKL");
        assert.equal(current.body.partner.id, PARTNER_ID);
        assert.equal(unbound.body.partner, null);
        assert.equal(binding, null);
    });

    test("rejects unknown partners and malformed ids", async () => {
        const unknown = await call("setClientPartner", { clientId: CLIENT_ID, partnerId: "c".repeat(24) });
        const malformed = await call("setClientPartner", { clientId: { $ne: null }, partnerId: PARTNER_ID });
        const missingClient = await call("setClientPartner", { clientId: "d".repeat(24), partnerId: PARTNER_ID });

        assert.deepEqual([unknown.statusCode, malformed.statusCode, missingClient.statusCode], [404, 400, 404]);
    });

    test("search requires at least two characters", async () => {
        const short = await call("searchPartnersAdmin", { query: "a" });
        const ok = await call("searchPartnersAdmin", { query: "Ал" });

        assert.deepEqual(short.body.partners, []);
        assert.equal(ok.body.partners.length, 1);
    });
});

describe("requireSuperAdmin", () => {
    const run = async (userType, role) => {
        const middleware = createRequireSuperAdmin({ findUserRole: async () => role });
        const res = createRes();
        let passed = false;
        await middleware({ userType, userId: "u1" }, res, () => (passed = true));
        return { passed, res };
    };

    test("lets only a superAdmin through", async () => {
        assert.equal((await run("user", "superAdmin")).passed, true);
        assert.equal((await run("user", "admin")).res.statusCode, 403);
        assert.equal((await run("client", undefined)).res.statusCode, 403);
    });
});
