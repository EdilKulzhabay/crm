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
    let bonusCalls;
    let bonusError;
    let operationLog;

    beforeEach(() => {
        operationLog = [];
        binding = null;
        bonusCalls = [];
        bonusError = null;
        controller = createPartnerAdminController({
            repo: {
                searchPartners: async () => [PARTNER],
                findClientPartnerId: async (id) => (id === CLIENT_ID ? { partnerId: binding } : null),
                findPartner: async (id) => (id === PARTNER_ID ? PARTNER : null),
                setClientPartner: async (id, partnerId) =>
                    id === CLIENT_ID ? ((binding = partnerId), { _id: id, userName: "Марат" }) : null,
                logOperation: async (entry) => operationLog.push(entry),
            },
            applyBonuses: async (args) => {
                if (bonusError) throw bonusError;
                bonusCalls.push(args);
                return { partnerBonus: 200, clientBonus: 200, clientBalance: 700 };
            },
            logger: silentLogger,
        });
    });

    const AUTHOR = { changedBy: "Менеджер Аня", reason: "Клиент пришёл от партнёра" };
    const call = async (handler, body) => {
        const res = createRes();
        await controller[handler]({ body: { ...AUTHOR, ...body }, userId: "admin" }, res);
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

    test("binding applies signup bonuses, unbinding does not", async () => {
        const bound = await call("setClientPartner", { clientId: CLIENT_ID, partnerId: PARTNER_ID });
        const unbound = await call("setClientPartner", { clientId: CLIENT_ID, partnerId: null });

        assert.deepEqual(bound.body.bonuses, { partnerBonus: 200, clientBonus: 200, clientBalance: 700 });
        assert.deepEqual(bonusCalls, [{ partnerId: PARTNER_ID, clientId: CLIENT_ID, clientName: "Марат" }]);
        assert.deepEqual(unbound.body.bonuses, { partnerBonus: 0, clientBonus: 0 });
    });

    test("a client without a partner is not an error", async () => {
        const res = await call("getClientPartnerAdmin", { clientId: CLIENT_ID });

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.partner, null);
    });

    test("binding requires who and why and is written to the client operation log", async () => {
        const missing = await call("setClientPartner", { clientId: CLIENT_ID, partnerId: PARTNER_ID, reason: "" });
        await call("setClientPartner", { clientId: CLIENT_ID, partnerId: PARTNER_ID });

        assert.equal(missing.statusCode, 400);
        assert.deepEqual(
            operationLog.map(({ field, oldValue, newValue, changedBy }) => [field, oldValue, newValue, changedBy]),
            [
                ["partner", "нет", "Алия · ABCD-EFGH-IJKL", "Менеджер Аня"],
                ["balance", 500, 700, "Менеджер Аня"],
            ]
        );
    });

    test("a bonus failure keeps the binding and is reported", async () => {
        bonusError = new Error("db down");

        const res = await call("setClientPartner", { clientId: CLIENT_ID, partnerId: PARTNER_ID });

        assert.equal(res.statusCode, 200);
        assert.equal(binding, PARTNER_ID);
        assert.equal(res.body.bonuses.isFailed, true);
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
