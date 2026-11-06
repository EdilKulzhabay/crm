import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
    CAR_WASH_COUPON_TTL_MS,
    CarWashCouponError,
    generateCarWashCouponCode,
    issueCarWashCoupon,
    normalizeCarWashCouponCode,
    redeemCarWashCoupon,
} from "../carWashCoupon.js";
import { createAttemptLimiter } from "../attemptLimiter.js";
import { signCarWashToken, verifyCarWashToken } from "../carWashToken.js";
import { signPartnerToken } from "../partnerToken.js";

const NOW = new Date("2026-11-05T10:00:00Z");
const silentLogger = { log() {}, error() {} };
const duplicateKey = (field) => Object.assign(new Error("dup"), { code: 11000, keyPattern: { [field]: 1 } });

const issueRepo = (overrides = {}) => {
    const created = [];
    return {
        created,
        findDeliveredOrder: async () => ({ _id: "order1", client: "client1", status: "delivered" }),
        hasActiveCarWash: async () => true,
        createCoupon: async (data) => (created.push(data), { _id: "coupon1", ...data }),
        ...overrides,
    };
};

describe("generateCarWashCouponCode / normalizeCarWashCouponCode", () => {
    test("код — 12 латинских букв в формате XXXX-XXXX-XXXX", () => {
        assert.match(generateCarWashCouponCode(), /^[A-Z]{4}-[A-Z]{4}-[A-Z]{4}$/);
    });

    test("ввод сотрудника нормализуется: регистр, пробелы и дефисы не важны", () => {
        assert.equal(normalizeCarWashCouponCode(" abcd efgh-ijkl "), "ABCD-EFGH-IJKL");
        assert.equal(normalizeCarWashCouponCode("ABCDEFGH"), null);
        assert.equal(normalizeCarWashCouponCode(12345), null);
    });
});

describe("issueCarWashCoupon", () => {
    test("выдаёт купон −20% на 72 часа за доставленный заказ", async () => {
        const repo = issueRepo();
        const coupon = await issueCarWashCoupon("order1", { repo, now: () => NOW, generateCode: () => "AAAA-BBBB-CCCC" });

        assert.equal(coupon.code, "AAAA-BBBB-CCCC");
        assert.equal(coupon.discountPercent, 20);
        assert.equal(coupon.client, "client1");
        assert.equal(coupon.expiresAt.getTime() - NOW.getTime(), CAR_WASH_COUPON_TTL_MS);
    });

    test("не выдаёт купон, если заказ не доставлен", async () => {
        const repo = issueRepo({ findDeliveredOrder: async () => ({ _id: "order1", client: "client1", status: "onTheWay" }) });
        assert.equal(await issueCarWashCoupon("order1", { repo }), null);
        assert.equal(repo.created.length, 0);
    });

    test("не выдаёт купон, пока нет ни одной активной мойки", async () => {
        const repo = issueRepo({ hasActiveCarWash: async () => false });
        assert.equal(await issueCarWashCoupon("order1", { repo }), null);
        assert.equal(repo.created.length, 0);
    });

    test("повторная доставка того же заказа не выдаёт второй купон", async () => {
        const repo = issueRepo({ createCoupon: async () => { throw duplicateKey("order"); } });
        assert.equal(await issueCarWashCoupon("order1", { repo, logger: silentLogger }), null);
    });

    test("при совпадении кода генерирует новый", async () => {
        const codes = ["AAAA-AAAA-AAAA", "BBBB-BBBB-BBBB"];
        let attempts = 0;
        const repo = issueRepo({
            createCoupon: async (data) => {
                attempts += 1;
                if (attempts === 1) throw duplicateKey("code");
                return data;
            },
        });
        const coupon = await issueCarWashCoupon("order1", { repo, generateCode: () => codes.shift() });
        assert.equal(coupon.code, "BBBB-BBBB-BBBB");
    });

    test("сбой базы не ломает доставку: возвращает null и пишет в лог", async () => {
        const errors = [];
        const repo = issueRepo({ findDeliveredOrder: async () => { throw new Error("db down"); } });
        const result = await issueCarWashCoupon("order1", { repo, logger: { error: (...args) => errors.push(args) } });
        assert.equal(result, null);
        assert.equal(errors.length, 1);
    });
});

describe("redeemCarWashCoupon", () => {
    const user = { _id: "user1", fullName: "Айдар" };
    const carWash = { _id: "wash1", name: "Центр" };
    const redeem = (repo, rawCode = "aaaa-bbbb-cccc") => redeemCarWashCoupon({ rawCode, user, carWash }, { repo, now: () => NOW });
    const rejectsWith = (promise, code) =>
        assert.rejects(promise, (error) => error instanceof CarWashCouponError && error.code === code);

    test("гасит действующий купон и запоминает мойку и сотрудника", async () => {
        let call;
        const repo = {
            markUsed: async (code, now, update) => ((call = { code, now, update }), { code, status: "used", ...update }),
        };
        const coupon = await redeem(repo);

        assert.equal(coupon.status, "used");
        assert.equal(call.code, "AAAA-BBBB-CCCC");
        assert.equal(call.now, NOW);
        assert.deepEqual(call.update, { usedBy: "user1", usedByName: "Айдар", carWash: "wash1", carWashName: "Центр" });
    });

    test("код неверного формата — INVALID_CODE без запроса в базу", async () => {
        await rejectsWith(redeem({ markUsed: async () => assert.fail("не должен обращаться к базе") }, "123"), "INVALID_CODE");
    });

    test("несуществующий код — NOT_FOUND", async () => {
        await rejectsWith(redeem({ markUsed: async () => null, findByCode: async () => null }), "NOT_FOUND");
    });

    test("уже погашенный купон — USED", async () => {
        await rejectsWith(redeem({ markUsed: async () => null, findByCode: async () => ({ status: "used" }) }), "USED");
    });

    test("просроченный купон — EXPIRED", async () => {
        await rejectsWith(redeem({ markUsed: async () => null, findByCode: async () => ({ status: "active" }) }), "EXPIRED");
    });
});

describe("createAttemptLimiter", () => {
    test("блокирует после maxFailures и снимает блок после окна", () => {
        let time = 0;
        const limiter = createAttemptLimiter({ maxFailures: 2, windowMs: 60_000, now: () => time });
        limiter.registerFailure("k");
        assert.equal(limiter.retryAfterSeconds("k"), 0);
        limiter.registerFailure("k");
        assert.equal(limiter.retryAfterSeconds("k"), 60);
        time = 60_000;
        assert.equal(limiter.retryAfterSeconds("k"), 0);
    });

    test("reset очищает счётчик", () => {
        const limiter = createAttemptLimiter({ maxFailures: 1, windowMs: 60_000 });
        limiter.registerFailure("k");
        limiter.reset("k");
        assert.equal(limiter.retryAfterSeconds("k"), 0);
    });
});

describe("carWashToken", () => {
    test("свой токен проходит, токен партнёра и токен на другом ключе — нет", () => {
        const token = signCarWashToken("65f000000000000000000001", "secret");
        assert.equal(verifyCarWashToken(token, "secret"), "65f000000000000000000001");
        assert.equal(verifyCarWashToken(token, "other"), null);
        assert.equal(verifyCarWashToken(signPartnerToken("65f000000000000000000001", "secret"), "secret"), null);
    });
});
