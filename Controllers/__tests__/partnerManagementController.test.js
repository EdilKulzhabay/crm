import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createPartnerManagementController } from "../PartnerManagementController.js";
import { PartnerLedgerError } from "../../utils/partnerLedger.js";

const PARTNER_ID = "b".repeat(24);
const BLOCKED_ID = "65f0000000000000000000bb";
const TX_ID = "c".repeat(24);
const silentLogger = { log() {}, error() {} };

const createRes = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    return res;
};

describe("PartnerManagementController", () => {
    let controller;
    let calls;

    beforeEach(() => {
        calls = { filters: [], periods: [], statuses: [], verifications: [], pushes: [] };
        const partner = { _id: PARTNER_ID, userName: "Алия", status: "active", balance: 300, expoPushTokens: ["t"] };
        controller = createPartnerManagementController({
            repo: {
                listPartners: async (filter) => (calls.filters.push(filter), [partner]),
                findPartner: async (id) =>
                    id === PARTNER_ID ? partner : id === BLOCKED_ID ? { ...partner, _id: BLOCKED_ID, status: "deleted" } : null,
                transactionTotals: async (_ids, period) => {
                    calls.periods.push(period);
                    return period.from ? [{ _id: PARTNER_ID, orderBonus: 400 }] : [{ _id: PARTNER_ID, orderBonus: 999, pendingOut: 200, pendingCount: 1 }];
                },
                clientTotals: async () => [{ _id: PARTNER_ID, clients: 2, orderedClients: 1 }],
                monthlyTotals: async () => [{ _id: "2026-10", orderBonus: 400 }],
                listClients: async () => [{ _id: "cl1", userName: "Марат Касымов", phone: "+7 700" }],
                loadRhythm: async () => new Map([["cl1", { isLapsed: true, lastOrderDay: "2026-10-01" }]]),
                listTransactions: async () => [],
                listPendingWithdrawals: async () => [{ _id: TX_ID, type: "withdrawal", amount: -200, status: "pending", cardData: { IIN: "1" } }],
                setPartnerVerification: async (id, verification) =>
                    (calls.verifications.push(verification), id === PARTNER_ID ? { verification } : null),
                notify: async (id, message) => (calls.pushes.push(message), { sent: 1 }),
                setPartnerStatus: async (id, status) => (calls.statuses.push(status), id === PARTNER_ID ? { status } : null),
            },
            runLapseCheck: async () => 3,
            resolveWithdrawal: async ({ status }) => {
                if (status === "again") throw new PartnerLedgerError("NOT_PENDING", "уже обработана");
                return { _id: TX_ID, type: "withdrawal", amount: -200, status };
            },
            logger: silentLogger,
        });
    });

    const AUTHOR = { changedBy: "Менеджер Аня", reason: "Звонок партнёра" };
    const call = async (handler, body) => {
        const res = createRes();
        await controller[handler]({ body: { ...AUTHOR, ...body }, userId: "admin" }, res);
        return res;
    };

    test("list combines period earnings with current pending payouts", async () => {
        const res = await call("getPartnersAdmin", { startDate: "2026-10-01", endDate: "2026-10-31", status: "active" });

        const [row] = res.body.partners;
        assert.equal(row.earned, 400);
        assert.equal(row.pendingOut, 200);
        assert.equal(res.body.summary.clients, 2);
        assert.deepEqual(calls.filters[0], { $and: [{ status: "active" }] });
        assert.equal(row.verificationStatus, "waiting");
    });

    test("list validates period and status", async () => {
        const badPeriod = await call("getPartnersAdmin", { startDate: "2026-13-45" });
        const badStatus = await call("getPartnersAdmin", { status: { $ne: null } });

        assert.deepEqual([badPeriod.statusCode, badStatus.statusCode], [400, 400]);
    });

    test("details include clients with rhythm, pending withdrawals and devices", async () => {
        const res = await call("getPartnerDetailsAdmin", { partnerId: PARTNER_ID });

        assert.equal(res.body.partner.devices, 1);
        assert.equal(res.body.clients[0].name, "Марат Касымов");
        assert.equal(res.body.clients[0].isLapsed, true);
        assert.equal(res.body.pendingWithdrawals[0].cardData.IIN, "1");
        assert.equal(res.body.monthly[0].earned, 400);
    });

    test("details 404 for unknown partner", async () => {
        const res = await call("getPartnerDetailsAdmin", { partnerId: "d".repeat(24) });

        assert.equal(res.statusCode, 404);
    });

    test("actions require who and why", async () => {
        const responses = await Promise.all([
            call("setPartnerStatusAdmin", { partnerId: PARTNER_ID, status: "blocked", changedBy: "" }),
            call("setPartnerVerificationAdmin", { partnerId: PARTNER_ID, status: "verified", reason: " " }),
            call("resolvePartnerWithdrawalAdmin", { transactionId: TX_ID, status: "paid", reason: undefined, changedBy: undefined }),
        ]);

        assert.deepEqual(responses.map((res) => res.statusCode), [400, 400, 400]);
        assert.deepEqual(calls.statuses, []);
    });

    test("blocks and unblocks, rejecting other statuses", async () => {
        const blocked = await call("setPartnerStatusAdmin", { partnerId: PARTNER_ID, status: "blocked" });
        const invalid = await call("setPartnerStatusAdmin", { partnerId: PARTNER_ID, status: "deleted" });

        assert.equal(blocked.body.status, "blocked");
        assert.equal(invalid.statusCode, 400);
        assert.deepEqual(calls.statuses, ["blocked"]);
    });

    test("waiting filter includes partners registered before verification existed", async () => {
        await call("getPartnersAdmin", { verification: "waiting" });

        assert.deepEqual(calls.filters[0].$and[0].$or[1], { "verification.status": { $exists: false } });
    });

    test("approves, or denies only with a reason, and notifies the partner", async () => {
        const approved = await call("setPartnerVerificationAdmin", { partnerId: PARTNER_ID, status: "verified" });
        const noReason = await call("setPartnerVerificationAdmin", { partnerId: PARTNER_ID, status: "denied", message: " " });
        const denied = await call("setPartnerVerificationAdmin", { partnerId: PARTNER_ID, status: "denied", message: "Нет фото" });
        const invalid = await call("setPartnerVerificationAdmin", { partnerId: PARTNER_ID, status: "waiting" });

        assert.equal(approved.body.verificationStatus, "verified");
        assert.deepEqual([noReason.statusCode, invalid.statusCode], [400, 400]);
        assert.equal(denied.body.verificationMessage, "Нет фото");
        assert.deepEqual(calls.pushes.map((push) => push.title), ["Аккаунт подтверждён", "Проверка не пройдена"]);
    });

    test("manual lapse check requires who and why and reports sent notifications", async () => {
        const missing = await call("runPartnerLapseCheckAdmin", { changedBy: "" });
        const ok = await call("runPartnerLapseCheckAdmin", {});

        assert.equal(missing.statusCode, 400);
        assert.equal(ok.body.notified, 3);
    });

    test("resolving a withdrawal twice answers 409", async () => {
        const ok = await call("resolvePartnerWithdrawalAdmin", { transactionId: TX_ID, status: "paid" });
        const again = await call("resolvePartnerWithdrawalAdmin", { transactionId: TX_ID, status: "again" });

        assert.equal(ok.body.transaction.status, "paid");
        assert.equal(again.statusCode, 409);
    });

    describe("sendPartnerNotificationAdmin", () => {
        test("sends the push to an active partner and reports devices", async () => {
            const res = await call("sendPartnerNotificationAdmin", { partnerId: PARTNER_ID, title: " Новости ", body: "Бонус за бутыль вырос" });

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.sent, 1);
            assert.deepEqual(calls.pushes, [{ title: "Новости", body: "Бонус за бутыль вырос", data: { type: "admin_message" } }]);
        });

        test("validates input and refuses inactive or unknown partners", async () => {
            const responses = await Promise.all([
                call("sendPartnerNotificationAdmin", { partnerId: "x", title: "a", body: "b" }),
                call("sendPartnerNotificationAdmin", { partnerId: PARTNER_ID, title: "", body: "b" }),
                call("sendPartnerNotificationAdmin", { partnerId: PARTNER_ID, title: "a", body: "b".repeat(501) }),
                call("sendPartnerNotificationAdmin", { partnerId: BLOCKED_ID, title: "a", body: "b" }),
                call("sendPartnerNotificationAdmin", { partnerId: "65f0000000000000000000cc", title: "a", body: "b" }),
            ]);

            assert.deepEqual(responses.map((res) => res.statusCode), [400, 400, 400, 409, 404]);
            assert.deepEqual(calls.pushes, []);
        });

        test("requires the change author like other admin actions", async () => {
            const res = createRes();
            await controller.sendPartnerNotificationAdmin({ body: { partnerId: PARTNER_ID, title: "a", body: "b" }, userId: "admin" }, res);

            assert.equal(res.statusCode, 400);
        });
    });
});
