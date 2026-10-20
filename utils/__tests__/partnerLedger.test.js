import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    applyPartnerBindingBonuses,
    applyPartnerOrderBonus,
    applyPartnerReferralBonus,
    orderBottleBonus,
    orderBottles,
    PARTNER_BOTTLE_BONUS_B12,
    PARTNER_BOTTLE_BONUS_B19,
    PARTNER_MIN_WITHDRAWAL,
    withdrawalFee,
    PARTNER_REFERRAL_BONUS,
    PARTNER_REFERRAL_CLIENT_BONUS,
    requestPartnerWithdrawal,
    resolvePartnerWithdrawal,
    shortClientName,
} from "../partnerLedger.js";

const PARTNER_ID = "p1";
const CARD = { accountNumber: "KZ123456789012345678", IIN: "900101300123", fullName: "Алия Ахметова" };

/** In-memory репозиторий с уникальными ограничениями как у PartnerTransaction */
const createRepo = (initialBalance = 0) => {
    const state = { balance: initialBalance, transactions: [], failAddBalance: false, failCreate: null, pushes: [],
        clientBalance: 0, clientBonusPaid: new Set(), clientsReferredByClient: new Set() };
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
                    (data.type === "referral_bonus" &&
                        t.type === "referral_bonus" &&
                        t.client === data.client &&
                        t.partner === data.partner) ||
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
        hasReferralBonus: async (clientId) =>
            state.transactions.some((t) => t.type === "referral_bonus" && t.client === clientId),
        creditClientSignupBonus: async (clientId, amount) => {
            if (state.clientBonusPaid.has(clientId) || state.clientsReferredByClient.has(clientId)) return null;
            state.clientBonusPaid.add(clientId);
            state.clientBalance += amount;
            return { _id: clientId, balance: state.clientBalance };
        },
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
        const repo = createRepo(10000);

        const result = await requestPartnerWithdrawal({ partner: partner(10000), amount: 6000, requestId: "req-00001" }, repo);

        assert.equal(result.isNew, true);
        assert.equal(result.balance, 4000);
        assert.equal(repo.state.balance, 4000);
        assert.deepEqual(
            { amount: result.transaction.amount, status: result.transaction.status, cardData: result.transaction.cardData },
            { amount: -6000, status: "pending", cardData: CARD }
        );
    });

    test("a repeated request with the same id does not deduct twice", async () => {
        const repo = createRepo(10000);
        await requestPartnerWithdrawal({ partner: partner(10000), amount: 6000, requestId: "req-00001" }, repo);

        const repeat = await requestPartnerWithdrawal({ partner: partner(4000), amount: 6000, requestId: "req-00001" }, repo);

        assert.equal(repeat.isNew, false);
        assert.equal(repo.state.balance, 4000);
        assert.equal(repo.state.transactions.length, 1);
    });

    test("refuses an amount above the balance without changing anything", async () => {
        const repo = createRepo(2000);

        await assert.rejects(
            () => requestPartnerWithdrawal({ partner: partner(2000), amount: 6000, requestId: "req-00002" }, repo),
            { code: "INSUFFICIENT_FUNDS" }
        );
        assert.equal(repo.state.balance, 2000);
    });

    test("two different requests cannot spend the same balance", async () => {
        const repo = createRepo(10000);

        const results = await Promise.allSettled([
            requestPartnerWithdrawal({ partner: partner(10000), amount: 7000, requestId: "req-a0001" }, repo),
            requestPartnerWithdrawal({ partner: partner(10000), amount: 7000, requestId: "req-b0001" }, repo),
        ]);

        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(repo.state.balance, 3000);
    });

    test("refuses amounts below the minimum and records the fee", async () => {
        const repo = createRepo(20000);

        await assert.rejects(
            () => requestPartnerWithdrawal({ partner: partner(20000), amount: PARTNER_MIN_WITHDRAWAL - 1, requestId: "req-00004" }, repo),
            { code: "BELOW_MINIMUM" }
        );
        const { transaction } = await requestPartnerWithdrawal({ partner: partner(20000), amount: 10000, requestId: "req-00005" }, repo);

        assert.equal(repo.state.balance, 10000);
        assert.deepEqual([transaction.amount, transaction.fee, transaction.payoutAmount], [-10000, 250, 9750]);
    });

    test("returns the money when the withdrawal record cannot be written", async () => {
        const repo = createRepo(10000);
        repo.state.failCreate = new Error("db down");

        await assert.rejects(() => requestPartnerWithdrawal({ partner: partner(10000), amount: 6000, requestId: "req-00003" }, repo));

        assert.equal(repo.state.balance, 10000);
    });
});

test("shortClientName hides the full surname", () => {
    assert.equal(shortClientName("Марат Касымов"), "Марат К.");
    assert.equal(shortClientName("Дана"), "Дана");
    assert.equal(shortClientName(""), "Клиент");
});

describe("applyPartnerOrderBonus", () => {
    const silent = { error() {} };
    const found = (products, partner = "p1") => ({
        order: { _id: "o1", client: "c1", products, status: "delivered" },
        client: { _id: "c1", userName: "Абай Серіков", referredByPartner: partner },
    });

    const repoWith = (lookup) => {
        const repo = createRepo();
        repo.findDeliveredOrderWithPartner = async () => lookup;
        return repo;
    };

    test("pays 100 ₸ per 12.5 l and 200 ₸ per 18.9 l bottle and notifies the partner", async () => {
        const repo = repoWith(found({ b12: 1, b19: 2 }));

        assert.equal(await applyPartnerOrderBonus("o1", repo, silent), PARTNER_BOTTLE_BONUS_B12 + 2 * PARTNER_BOTTLE_BONUS_B19);
        assert.equal(repo.state.balance, 500);
        assert.deepEqual(
            { type: repo.state.transactions[0].type, bottles: repo.state.transactions[0].bottles, order: repo.state.transactions[0].order },
            { type: "order_bonus", bottles: 3, order: "o1" }
        );
        assert.match(repo.state.pushes[0].body, /Абай С\.: 3 бут\./);
    });

    test("delivering the same order twice pays once", async () => {
        const repo = repoWith(found({ b19: 2 }));
        const original = repo.createTransaction;
        repo.createTransaction = async (data) => {
            if (repo.state.transactions.some((t) => t.type === "order_bonus" && t.order === data.order)) {
                throw Object.assign(new Error("E11000"), { code: 11000 });
            }
            return original(data);
        };

        await applyPartnerOrderBonus("o1", repo, silent);
        assert.equal(await applyPartnerOrderBonus("o1", repo, silent), 0);
        assert.equal(repo.state.balance, 400);
    });

    test("pays nothing for clients without a partner or empty orders", async () => {
        assert.equal(await applyPartnerOrderBonus("o1", repoWith(null), silent), 0);
        assert.equal(await applyPartnerOrderBonus("o1", repoWith(found({ b12: 0, b19: 0 })), silent), 0);
    });

    test("never throws: a failure only logs and rolls the journal back", async () => {
        const repo = repoWith(found({ b19: 1 }));
        repo.state.failAddBalance = true;

        assert.equal(await applyPartnerOrderBonus("o1", repo, silent), 0);
        assert.equal(repo.state.transactions.length, 0);
    });

    test("counts only positive whole bottle numbers", () => {
        assert.equal(orderBottles({ b12: 2, b19: 1 }), 3);
        assert.equal(orderBottles({ b12: -1, b19: 1.5 }), 0);
        assert.equal(orderBottles(undefined), 0);
        assert.equal(orderBottleBonus({ b12: 3, b19: 0 }), 300);
        assert.equal(orderBottleBonus({ b12: -1, b19: "x" }), 0);
    });

    test("withdrawal fee is 2.5% but at least 200 ₸, rounded up", () => {
        assert.equal(withdrawalFee(5000), 200);
        assert.equal(withdrawalFee(8000), 200);
        assert.equal(withdrawalFee(10000), 250);
        assert.equal(withdrawalFee(10001), 251);
    });
});

describe("applyPartnerBindingBonuses", () => {
    const bonusesOf = ({ partnerBonus, clientBonus }) => ({ partnerBonus, clientBonus });
    const bind = (repo, partnerId, clientId = "c1") =>
        applyPartnerBindingBonuses({ partnerId, clientId, clientName: "Марат Касымов" }, repo);

    test("credits partner and client like a signup by code", async () => {
        const repo = createRepo();

        const result = await bind(repo, PARTNER_ID);

        assert.deepEqual(bonusesOf(result), { partnerBonus: PARTNER_REFERRAL_BONUS, clientBonus: PARTNER_REFERRAL_CLIENT_BONUS });
        assert.equal(repo.state.balance, PARTNER_REFERRAL_BONUS);
        assert.equal(repo.state.clientBalance, PARTNER_REFERRAL_CLIENT_BONUS);
        assert.equal(result.clientBalance, PARTNER_REFERRAL_CLIENT_BONUS);
        assert.equal(repo.state.transactions[0].type, "referral_bonus");
        assert.equal(repo.state.pushes.length, 1);
    });

    test("rebinding to the same partner credits nothing", async () => {
        const repo = createRepo();
        await bind(repo, PARTNER_ID);

        const again = await bind(repo, PARTNER_ID);

        assert.deepEqual(bonusesOf(again), { partnerBonus: 0, clientBonus: 0 });
        assert.equal(repo.state.transactions.length, 1);
    });

    test("a new partner is credited, the client only once", async () => {
        const repo = createRepo();
        await bind(repo, PARTNER_ID);

        const second = await bind(repo, "p2");

        assert.deepEqual(bonusesOf(second), { partnerBonus: PARTNER_REFERRAL_BONUS, clientBonus: 0 });
        assert.equal(repo.state.clientBalance, PARTNER_REFERRAL_CLIENT_BONUS);
    });

    test("a client registered by code before the flag existed gets no second client bonus", async () => {
        const repo = createRepo();
        repo.state.transactions.push({ _id: "legacy", type: "referral_bonus", client: "c1", partner: "p0" });

        const result = await bind(repo, PARTNER_ID);

        assert.deepEqual(bonusesOf(result), { partnerBonus: PARTNER_REFERRAL_BONUS, clientBonus: 0 });
    });

    test("a client invited by another client gets no partner client bonus", async () => {
        const repo = createRepo();
        repo.state.clientsReferredByClient.add("c1");

        const result = await bind(repo, PARTNER_ID);

        assert.deepEqual(bonusesOf(result), { partnerBonus: PARTNER_REFERRAL_BONUS, clientBonus: 0 });
    });
});

describe("resolvePartnerWithdrawal", () => {
    const setup = () => {
        const repo = createRepo();
        repo.state.transactions.push({ _id: "w1", partner: PARTNER_ID, type: "withdrawal", amount: -500, status: "pending" });
        repo.updateWithdrawalStatus = async (id, fromStatus, update) => {
            const row = repo.state.transactions.find((t) => t._id === id && t.type === "withdrawal" && t.status === fromStatus);
            if (!row) return null;
            Object.assign(row, update);
            return { ...row };
        };
        return repo;
    };

    test("paid keeps the balance, rejected refunds it", async () => {
        const paidRepo = setup();
        const rejectedRepo = setup();

        await resolvePartnerWithdrawal({ transactionId: "w1", status: "paid", userId: "u1" }, paidRepo);
        await resolvePartnerWithdrawal({ transactionId: "w1", status: "rejected", userId: "u1" }, rejectedRepo);

        assert.equal(paidRepo.state.balance, 0);
        assert.equal(rejectedRepo.state.balance, 500);
        assert.equal(rejectedRepo.state.transactions[0].status, "rejected");
        assert.equal(rejectedRepo.state.pushes.length, 1);
    });

    test("a request is resolved only once", async () => {
        const repo = setup();
        await resolvePartnerWithdrawal({ transactionId: "w1", status: "rejected" }, repo);

        await assert.rejects(resolvePartnerWithdrawal({ transactionId: "w1", status: "rejected" }, repo), { code: "NOT_PENDING" });
        assert.equal(repo.state.balance, 500);
    });

    test("a failed refund returns the request to pending", async () => {
        const repo = setup();
        repo.state.failAddBalance = true;

        await assert.rejects(resolvePartnerWithdrawal({ transactionId: "w1", status: "rejected" }, repo));
        assert.equal(repo.state.transactions[0].status, "pending");
    });

    test("rejects unknown statuses", async () => {
        await assert.rejects(resolvePartnerWithdrawal({ transactionId: "w1", status: "completed" }, setup()), {
            code: "INVALID_STATUS",
        });
    });
});
