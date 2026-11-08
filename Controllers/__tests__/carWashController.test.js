import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createCarWashController } from "../CarWashController.js";
import { createCarWashAdminController } from "../CarWashAdminController.js";
import { createAttemptLimiter } from "../../utils/attemptLimiter.js";
import { CarWashCouponError } from "../../utils/carWashCoupon.js";
import { createCheckAuthCarWash } from "../../utils/checkAuthCarWash.js";
import { buildCarWashRedemptionMessage } from "../../telegram/sendCarWashRedemption.js";

const USER_ID = "65f000000000000000000001";
const WASH_ID = "65f0000000000000000000aa";
const silentLogger = { log() {}, error() {} };

const createRes = () => {
    const res = { statusCode: 200, body: null };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    return res;
};
const call = async (handler, req) => {
    const res = createRes();
    await handler(req, res);
    return res;
};

const activeUser = { _id: USER_ID, fullName: "Айдар", phone: "+7 700 000 00 01", carWash: WASH_ID, status: "active", password: "hash" };
const activeWash = { _id: WASH_ID, name: "Центр", address: "Абая 1", city: "Алматы", phone: "", status: "active" };

describe("CarWashController — вход", () => {
    let controller;
    let user;
    let wash;

    beforeEach(() => {
        user = { ...activeUser };
        wash = { ...activeWash };
        controller = createCarWashController({
            repo: {
                findUserForLogin: async (phone) => (phone === "77000000001" ? user : null),
                findCarWash: async () => wash,
                touchLogin: async () => undefined,
            },
            comparePassword: async (password) => password === "secret1",
            signToken: (id) => `token-${id}`,
            loginLimiter: createAttemptLimiter({ maxFailures: 2, windowMs: 60_000 }),
            logger: silentLogger,
        });
    });

    test("верный телефон в любом формате и пароль — токен и данные мойки", async () => {
        const res = await call(controller.carWashLogin, { body: { phone: "8 (700) 000-00-01", password: "secret1" } });
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.token, `token-${USER_ID}`);
        assert.equal(res.body.carWash.name, "Центр");
        assert.equal(res.body.user.password, undefined);
    });

    test("неверный пароль — 401, после лимита — 429", async () => {
        const wrong = { body: { phone: "77000000001", password: "nope" } };
        assert.equal((await call(controller.carWashLogin, wrong)).statusCode, 401);
        assert.equal((await call(controller.carWashLogin, wrong)).statusCode, 401);
        const blocked = await call(controller.carWashLogin, { body: { phone: "77000000001", password: "secret1" } });
        assert.equal(blocked.statusCode, 429);
    });

    test("заблокированная мойка — 403 даже с верным паролем", async () => {
        wash.status = "blocked";
        const res = await call(controller.carWashLogin, { body: { phone: "77000000001", password: "secret1" } });
        assert.equal(res.statusCode, 403);
    });
});

describe("CarWashController — погашение", () => {
    const req = (code) => ({ body: { code }, carWashUser: activeUser, carWash: activeWash });

    const usedCoupon = { _id: "c1", client: "cl1", code: "AAAA-BBBB-CCCC", discountPercent: 20, usedAt: new Date(), carWashName: "Центр", usedByName: "Айдар" };
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    test("успешное погашение возвращает данные операции", async () => {
        const controller = createCarWashController({
            redeem: async () => usedCoupon,
            repo: { findClient: async () => null },
            notifyRedemption: async () => ({ ok: true }),
            logger: silentLogger,
        });
        const res = await call(controller.redeemCarWashCoupon, req("aaaabbbbcccc"));
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.coupon.discountPercent, 20);
    });

    test("после погашения в Telegram уходят данные мойки и клиента", async () => {
        const sent = [];
        const client = { _id: "cl1", userName: "Асель", phone: "+77011112233" };
        const controller = createCarWashController({
            redeem: async () => usedCoupon,
            repo: { findClient: async (id) => (id === "cl1" ? client : null) },
            notifyRedemption: async (params) => (sent.push(params), { ok: true }),
            logger: silentLogger,
        });
        await call(controller.redeemCarWashCoupon, req("AAAA-BBBB-CCCC"));
        await flush();
        assert.equal(sent.length, 1);
        assert.equal(sent[0].client, client);
        assert.equal(sent[0].carWash.name, "Центр");
        assert.equal(sent[0].carWashUser.fullName, "Айдар");
    });

    test("сбой Telegram не ломает погашение", async () => {
        const errors = [];
        const controller = createCarWashController({
            redeem: async () => usedCoupon,
            repo: { findClient: async () => { throw new Error("db down"); } },
            notifyRedemption: async () => ({ ok: true }),
            logger: { log() {}, error: (...args) => errors.push(args) },
        });
        const res = await call(controller.redeemCarWashCoupon, req("AAAA-BBBB-CCCC"));
        await flush();
        assert.equal(res.statusCode, 200);
        assert.equal(errors.length, 1);
    });

    test("неудачное погашение в Telegram не отправляется", async () => {
        let sent = 0;
        const controller = createCarWashController({
            redeem: async () => { throw new CarWashCouponError("USED", "x"); },
            notifyRedemption: async () => (sent++, { ok: true }),
            logger: silentLogger,
        });
        await call(controller.redeemCarWashCoupon, req("AAAA-BBBB-CCCC"));
        await flush();
        assert.equal(sent, 0);
    });

    test("текст для Telegram содержит мойку, сотрудника и клиента", () => {
        const text = buildCarWashRedemptionMessage({
            coupon: usedCoupon,
            client: { fullName: "Асель Ж.", phone: "+77011112233" },
            carWash: activeWash,
            carWashUser: activeUser,
        });
        for (const part of ["AAAA-BBBB-CCCC", "−20%", "Мойка: Центр", "Алматы, Абая 1", "Айдар", "Асель Ж.", "+77011112233"]) {
            assert.ok(text.includes(part), part);
        }
    });

    test("причина отказа уходит кодом и статусом: USED → 409, EXPIRED → 410", async () => {
        for (const [code, status] of [["USED", 409], ["EXPIRED", 410], ["NOT_FOUND", 404]]) {
            const controller = createCarWashController({
                redeem: async () => { throw new CarWashCouponError(code, "x"); },
                logger: silentLogger,
            });
            const res = await call(controller.redeemCarWashCoupon, req("AAAA-BBBB-CCCC"));
            assert.equal(res.statusCode, status);
            assert.equal(res.body.code, code);
        }
    });

    test("подбор кода ограничен; «уже использован» в лимит не засчитывается", async () => {
        let reason = "NOT_FOUND";
        const controller = createCarWashController({
            redeem: async () => { throw new CarWashCouponError(reason, "x"); },
            redeemLimiter: createAttemptLimiter({ maxFailures: 2, windowMs: 60_000 }),
            logger: silentLogger,
        });
        reason = "USED";
        await call(controller.redeemCarWashCoupon, req("A"));
        await call(controller.redeemCarWashCoupon, req("A"));
        assert.equal((await call(controller.redeemCarWashCoupon, req("A"))).statusCode, 409);
        reason = "NOT_FOUND";
        await call(controller.redeemCarWashCoupon, req("A"));
        await call(controller.redeemCarWashCoupon, req("A"));
        assert.equal((await call(controller.redeemCarWashCoupon, req("A"))).statusCode, 429);
    });
});

describe("CarWashController — статистика купона", () => {
    test("событие клиента увеличивает свой счётчик", async () => {
        const tracked = [];
        const controller = createCarWashController({
            repo: { trackEngagement: async (clientId, fields) => tracked.push([clientId, fields.counter]) },
            logger: silentLogger,
        });
        const res = await call(controller.trackCarWashCouponEvent, { userId: "cl1", body: { event: "screenView" } });
        assert.equal(res.statusCode, 200);
        assert.deepEqual(tracked, [["cl1", "screenViews"]]);
    });

    test("неизвестное событие — 400 без записи", async () => {
        let calls = 0;
        const controller = createCarWashController({ repo: { trackEngagement: async () => calls++ }, logger: silentLogger });
        for (const event of ["hack", "__proto__", "toString", undefined]) {
            const res = await call(controller.trackCarWashCouponEvent, { userId: "cl1", body: { event } });
            assert.equal(res.statusCode, 400);
        }
        assert.equal(calls, 0);
    });

    test("админ получает переходы и просмотры", async () => {
        const controller = createCarWashAdminController({
            repo: { engagementTotals: async () => ({ clickedClients: 3, screenViews: 7 }) },
            logger: silentLogger,
        });
        const res = await call(controller.getCarWashCouponStatsAdmin, { body: {} });
        assert.deepEqual(res.body.stats, { clickedClients: 3, screenViews: 7 });
    });
});

describe("CarWashController — купоны клиента", () => {
    test("без купонов не запрашивает список моек", async () => {
        const controller = createCarWashController({
            repo: { listClientCoupons: async () => [], listActiveCarWashes: async () => assert.fail("лишний запрос") },
            logger: silentLogger,
        });
        const res = await call(controller.getCarWashCouponsMobile, { userId: "client1" });
        assert.deepEqual(res.body.coupons, []);
        assert.deepEqual(res.body.carWashes, []);
    });

    test("клиент берётся из токена и получает купоны и мойки", async () => {
        let requestedClient;
        const controller = createCarWashController({
            repo: {
                listClientCoupons: async (clientId) => ((requestedClient = clientId), [{ _id: "c1", code: "AAAA-BBBB-CCCC", discountPercent: 20, expiresAt: new Date() }]),
                listActiveCarWashes: async () => [activeWash],
            },
            logger: silentLogger,
        });
        const res = await call(controller.getCarWashCouponsMobile, { userId: "client1", body: { clientId: "someoneElse" } });
        assert.equal(requestedClient, "client1");
        assert.equal(res.body.coupons[0].code, "AAAA-BBBB-CCCC");
        assert.equal(res.body.carWashes[0].name, "Центр");
    });
});

describe("checkAuthCarWash", () => {
    const run = async ({ user = activeUser, wash = activeWash, tokenUser = USER_ID } = {}) => {
        const middleware = createCheckAuthCarWash({
            verifyToken: () => tokenUser,
            findUserById: async () => user,
            findCarWashById: async () => wash,
        });
        const res = createRes();
        let isNextCalled = false;
        const req = { headers: { authorization: "Bearer t" } };
        await middleware(req, res, () => { isNextCalled = true; });
        return { res, isNextCalled, req };
    };

    test("активный сотрудник активной мойки проходит, мойка берётся из базы", async () => {
        const { isNextCalled, req } = await run();
        assert.equal(isNextCalled, true);
        assert.equal(req.carWash.name, "Центр");
    });

    test("без токена — 401, заблокированный сотрудник — 403", async () => {
        assert.equal((await run({ tokenUser: null })).res.statusCode, 401);
        assert.equal((await run({ user: { ...activeUser, status: "blocked" } })).res.statusCode, 403);
    });
});

describe("CarWashAdminController", () => {
    let calls;
    let controller;

    beforeEach(() => {
        calls = { createdUsers: [], updatedUsers: [] };
        controller = createCarWashAdminController({
            repo: {
                carWashExists: async (id) => id === WASH_ID,
                createUser: async (data) => (calls.createdUsers.push(data), { _id: USER_ID, status: "active", ...data }),
                updateUser: async (id, data) => (calls.updatedUsers.push(data), { _id: id, status: "active", fullName: "Айдар", phone: "x", ...data }),
                createCarWash: async (data) => ({ _id: WASH_ID, status: "active", ...data }),
                listCarWashes: async () => [activeWash],
                listUsers: async () => [activeUser],
            },
            hashPassword: async (password) => `hash:${password}`,
            logger: silentLogger,
        });
    });

    test("мойка создаётся с городом по умолчанию; без адреса — 400", async () => {
        const ok = await call(controller.saveCarWashAdmin, { body: { name: "Центр", address: "Абая 1" }, userId: "admin" });
        assert.equal(ok.body.carWash.city, "Алматы");
        const bad = await call(controller.saveCarWashAdmin, { body: { name: "Центр" }, userId: "admin" });
        assert.equal(bad.statusCode, 400);
    });

    test("ссылка 2ГИС сохраняется, чужая ссылка — 400", async () => {
        const ok = await call(controller.saveCarWashAdmin, {
            body: { name: "Центр", address: "Абая 1", mapUrl: "http://go.2gis.com/abc" },
            userId: "admin",
        });
        assert.equal(ok.body.carWash.mapUrl, "https://go.2gis.com/abc");
        const bad = await call(controller.saveCarWashAdmin, {
            body: { name: "Центр", address: "Абая 1", mapUrl: "https://evil.com" },
            userId: "admin",
        });
        assert.equal(bad.statusCode, 400);
    });

    test("новый сотрудник: пароль обязателен и хранится только хэшем", async () => {
        const noPassword = await call(controller.saveCarWashUserAdmin, { body: { carWashId: WASH_ID, fullName: "Айдар", phone: "87000000001" } });
        assert.equal(noPassword.statusCode, 400);

        const res = await call(controller.saveCarWashUserAdmin, {
            body: { carWashId: WASH_ID, fullName: "Айдар", phone: "87000000001", password: "secret1" },
            userId: "admin",
        });
        assert.equal(res.statusCode, 200);
        assert.equal(calls.createdUsers[0].password, "hash:secret1");
        assert.equal(calls.createdUsers[0].phoneNormalized, "77000000001");
        assert.equal(res.body.user.password, undefined);
    });

    test("изменение сотрудника без пароля не трогает пароль", async () => {
        await call(controller.saveCarWashUserAdmin, {
            body: { userId: USER_ID, carWashId: WASH_ID, fullName: "Айдар", phone: "77000000001", password: "" },
        });
        assert.equal("password" in calls.updatedUsers[0], false);
    });

    test("занятый номер — 409", async () => {
        const dupController = createCarWashAdminController({
            repo: { carWashExists: async () => true, createUser: async () => { throw Object.assign(new Error("dup"), { code: 11000 }); } },
            hashPassword: async () => "h",
            logger: silentLogger,
        });
        const res = await call(dupController.saveCarWashUserAdmin, {
            body: { carWashId: WASH_ID, fullName: "Айдар", phone: "77000000001", password: "secret1" },
        });
        assert.equal(res.statusCode, 409);
    });

    test("список моек со своими сотрудниками", async () => {
        const res = await call(controller.getCarWashesAdmin, {});
        assert.equal(res.body.carWashes[0].users[0].fullName, "Айдар");
    });
});
