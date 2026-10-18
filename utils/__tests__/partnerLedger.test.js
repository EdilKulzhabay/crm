import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    applyPartnerReferralBonus,
    PARTNER_REFERRAL_BONUS,
    requestPartnerWithdrawal,
    shortClientName,
} from "../partnerLedger.js";

const PARTNER_ID = "p1";
const CARD = { accountNumber: "KZ123456789012345678", IIN: "900101300123", fullName: "Алия Ахметова" };

/** In-memory репозиторий с уникальными ограничениями как у PartnerTransaction */
const createRepo = (initialBalance = 0) => {
    const state = { balance: initialBalance, transactions: [], failAddBalance: false, failCreate: null, pushes: [] };
    const duplicate = () => Object.assign(new Error("E11000"), { code: 11000 });
    return {
        state,
        addBalance: async (_id, amount) => {
            if (state.failAddBalance) throw new Error("db down");
            state.balance += amount;
            return { balance: state.balance };
        },
        reserveBalance: async (_id, amount) => {
            if (state.balance < amount) return null;
            state.balance -= amount;
            return { balance: state.balance };
        },
        createTransaction: async (data) => {
            if (state.failCreate) throw state.failCreate;
            const clash = state.transactions.find(
                (t) =>
                    (data.type === "referral_bonus" && t.type === "referral_bonus" && t.client === data.client) ||
                    (data.type === "withdrawal" && t.type === "withdrawal" && t.requestId === data.requestId)
            );
            if (clash) throw duplicate();
            const row = { _id: `t${state.transactions.length + 1}`, ...data };
            state.transactions.push(row);
            return row;
        },
        deleteTransaction: async (id) => {
            state.transactions = state.transactions.filter((t) => t._id !== id);
        },
        findWithdrawalByRequestId: async (_partner, requestId) =>
            state.transactions.find((t) => t.type === "withdrawal" && t.requestId === requestId) ?? null,
        notify: async (partnerId, message) => state.pushes.push({ partnerId, ...message }),
    };
};

const partner = (balance) => ({ _id: PARTNER_ID, balance, cardData: CARD });

describe("applyPartnerReferralBonus", () => {
    test("credits the partner once per client", async () => {
        const repo = createRepo();

        assert.equal(await applyPartnerReferralBonus({ partnerId: PARTNER_ID, clientId: "c1", clientName: "Марат Касымов" }, repo), true);
        assert.equal(await applyPartnerReferralBonus({ partnerId: PARTNER_ID, clientId: "c1", clientName: "Марат Касымов" }, repo), false);

        assert.equal(repo.state.balance, PARTNER_REFERRAL_BONUS);
        assert.equal(repo.state.transactions.length, 1);
        assert.equal(repo.state.transactions[0].clientName, "Марат К.");
        assert.equal(repo.state.pushes.length, 1);
        assert.match(repo.state.pushes[0].body, /Марат К\./);
    });

    test("removes the journal entry when the balance update fails", async () => {
        const repo = createRepo();
        repo.state.failAddBalance = true;

        await assert.rejects(() => applyPartnerReferralBonus({ partnerId: PARTNER_ID, clientId: "c1", clientName: "X" }, repo));

        assert.equal(repo.state.transactions.length, 0);
        assert.equal(repo.state.pushes.length, 0);
    });
});

describe("requestPartnerWithdrawal", () => {
    test("deducts the amount immediately and records a pending withdrawal", async () => {
        const repo = createRepo(1000);

        const result = await requestPartnerWithdrawal({ partner: partner(1000), amount: 600, requestId: "req-00001" }, repo);

        assert.equal(result.isNew, true);
        assert.equal(result.balance, 400);
        assert.equal(repo.state.balance, 400);
        assert.deepEqual(
            { amount: result.transaction.amount, status: result.transaction.status, cardData: result.transaction.cardData },
            { amount: -600, status: "pending", cardData: CARD }
        );
    });

    test("a repeated request with the same id does not deduct twice", async () => {
        const repo = createRepo(1000);
        await requestPartnerWithdrawal({ partner: partner(1000), amount: 600, requestId: "req-00001" }, repo);

        const repeat = await requestPartnerWithdrawal({ partner: partner(400), amount: 600, requestId: "req-00001" }, repo);

        assert.equal(repeat.isNew, false);
        assert.equal(repo.state.balance, 400);
        assert.equal(repo.state.transactions.length, 1);
    });

    test("refuses an amount above the balance without changing anything", async () => {
        const repo = createRepo(200);

        await assert.rejects(
            () => requestPartnerWithdrawal({ partner: partner(200), amount: 600, requestId: "req-00002" }, repo),
            { code: "INSUFFICIENT_FUNDS" }
        );
        assert.equal(repo.state.balance, 200);
    });

    test("two different requests cannot spend the same balance", async () => {
        const repo = createRepo(1000);

        const results = await Promise.allSettled([
            requestPartnerWithdrawal({ partner: partner(1000), amount: 700, requestId: "req-a0001" }, repo),
            requestPartnerWithdrawal({ partner: partner(1000), amount: 700, requestId: "req-b0001" }, repo),
        ]);

        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(repo.state.balance, 300);
    });

    test("returns the money when the withdrawal record cannot be written", async () => {
        const repo = createRepo(1000);
        repo.state.failCreate = new Error("db down");

        await assert.rejects(() => requestPartnerWithdrawal({ partner: partner(1000), amount: 600, requestId: "req-00003" }, repo));

        assert.equal(repo.state.balance, 1000);
    });
});

test("shortClientName hides the full surname", () => {
    assert.equal(shortClientName("Марат Касымов"), "Марат К.");
    assert.equal(shortClientName("Дана"), "Дана");
    assert.equal(shortClientName(""), "Клиент");
});
