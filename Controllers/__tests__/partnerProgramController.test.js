import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createPartnerProgramController } from "../PartnerProgramController.js";
import { PartnerLedgerError } from "../../utils/partnerLedger.js";
import { buildPartnerWithdrawMessage } from "../../telegram/sendPartnerWithdraw.js";

const CARD = { accountNumber: "KZ123456789012345678", IIN: "900101300123", fullName: "Алия Ахметова" };
const PARTNER = { _id: "p1", userName: "Алия Ахметова", phone: "+7 (700) 123-45-67", balance: 1000, cardData: CARD };
const silentLogger = { log() {}, error() {} };

const createRes = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    return res;
};

describe("PartnerProgramController", () => {
    let notifications;
    let withdrawCalls;
    let controller;
    let savedCard;
    let savedTokens;
    let removedTokens;

    beforeEach(() => {
        notifications = [];
        withdrawCalls = [];
        savedCard = null;
        savedTokens = [];
        removedTokens = [];
        controller = createPartnerProgramController({
            repo: {
                listReferredClients: async () => [
                    { _id: "c1", userName: "Марат Касымов", createdAt: "2026-10-01T07:00:00Z", haveCompletedOrder: true },
                    { _id: "c2", userName: "Дана", createdAt: "2026-10-02T07:00:00Z" },
                ],
                listTransactions: async () => [
                    { _id: "t1", type: "referral_bonus", amount: 200, status: "completed", clientName: "Марат К.", createdAt: "x", client: "c1" },
                ],
                updateCardData: async (_id, cardData) => ((savedCard = cardData), { cardData }),
                addPushToken: async (_id, token) => savedTokens.push(token),
                removePushToken: async (_id, token) => removedTokens.push(token),
            },
            withdraw: async (args) => {
                withdrawCalls.push(args);
                return { transaction: { _id: "t9", type: "withdrawal", amount: -args.amount, status: "pending", createdAt: "y" }, balance: 400, isNew: true };
            },
            notifyWithdraw: async (params) => (notifications.push(params), { ok: true }),
            logger: silentLogger,
        });
    });

    const call = async (handler, body = {}, partner = PARTNER) => {
        const res = createRes();
        await controller[handler]({ body, partner, partnerId: partner._id }, res);
        return res;
    };

    test("lists referred clients with short names and order status only", async () => {
        const res = await call("getPartnerClients");

        assert.deepEqual(res.body.clients, [
            { id: "c1", name: "Марат К.", registeredAt: "2026-10-01T07:00:00Z", hasOrdered: true },
            { id: "c2", name: "Дана", registeredAt: "2026-10-02T07:00:00Z", hasOrdered: false },
        ]);
    });

    test("serializes transactions without internal references", async () => {
        const res = await call("getPartnerTransactions");

        assert.deepEqual(res.body.transactions, [
            { id: "t1", type: "referral_bonus", amount: 200, status: "completed", clientName: "Марат К.", createdAt: "x" },
        ]);
    });

    test("validates and normalizes card data like the courier app", async () => {
        const bad = await call("updatePartnerCardData", { accountNumber: "KZ12", IIN: "900101300123", fullName: "Алия" });
        const ok = await call("updatePartnerCardData", { accountNumber: "kz12 3456 7890 1234 5678", IIN: "900101300123", fullName: " Алия Ахметова " });

        assert.equal(bad.statusCode, 400);
        assert.equal(ok.statusCode, 200);
        assert.deepEqual(savedCard, CARD);
    });

    test("creates a withdrawal and notifies the Telegram group once", async () => {
        const res = await call("requestPartnerWithdrawal", { amount: 600, requestId: "req-00001" });

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.balance, 400);
        assert.equal(withdrawCalls[0].amount, 600);
        assert.equal(notifications.length, 1);
        assert.equal(notifications[0].transactionId, "t9");
    });

    test("requires card data and a valid amount before withdrawing", async () => {
        const noCard = await call("requestPartnerWithdrawal", { amount: 600, requestId: "req-00001" }, { ...PARTNER, cardData: {} });
        const fraction = await call("requestPartnerWithdrawal", { amount: 10.5, requestId: "req-00001" });
        const noRequestId = await call("requestPartnerWithdrawal", { amount: 600 });

        assert.deepEqual([noCard.statusCode, fraction.statusCode, noRequestId.statusCode], [400, 400, 400]);
        assert.equal(withdrawCalls.length, 0);
    });

    test("maps insufficient funds to 400 and sends nothing", async () => {
        controller = createPartnerProgramController({
            withdraw: async () => {
                throw new PartnerLedgerError("INSUFFICIENT_FUNDS", "Сумма не может превышать доступный баланс");
            },
            notifyWithdraw: async (p) => notifications.push(p),
            logger: silentLogger,
        });

        const res = await call("requestPartnerWithdrawal", { amount: 5000, requestId: "req-00001" });

        assert.equal(res.statusCode, 400);
        assert.equal(notifications.length, 0);
    });

    test("saves and removes only valid Expo push tokens", async () => {
        const bad = await call("savePartnerPushToken", { token: "not-a-token" });
        const ok = await call("savePartnerPushToken", { token: "ExponentPushToken[abc123]" });
        const removed = await call("removePartnerPushToken", { token: "ExponentPushToken[abc123]" });

        assert.deepEqual([bad.statusCode, ok.statusCode, removed.statusCode], [400, 200, 200]);
        assert.deepEqual(savedTokens, ["ExponentPushToken[abc123]"]);
        assert.deepEqual(removedTokens, ["ExponentPushToken[abc123]"]);
    });

    test("does not notify again for a repeated request", async () => {
        controller = createPartnerProgramController({
            withdraw: async () => ({ transaction: { _id: "t9", type: "withdrawal", amount: -600, status: "pending" }, balance: 400, isNew: false }),
            notifyWithdraw: async (p) => notifications.push(p),
            logger: silentLogger,
        });

        await call("requestPartnerWithdrawal", { amount: 600, requestId: "req-00001" });

        assert.equal(notifications.length, 0);
    });
});

test("Telegram message contains the sum, requisites and request id", () => {
    const text = buildPartnerWithdrawMessage({ partner: PARTNER, amount: 600, transactionId: "t9", balanceAfter: 400 });

    for (const part of ["Алия Ахметова", "600 ₸", "KZ123456789012345678", "900101300123", "t9", "Остаток: 400 ₸"]) {
        assert.ok(text.includes(part), part);
    }
});
