import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createDeliveryPartnerController } from "../DeliveryPartnerController.js";
import { createDeliveryPartnerAdminController } from "../DeliveryPartnerAdminController.js";
import { createAttemptLimiter } from "../../utils/attemptLimiter.js";
import { createCheckAuthDeliveryPartner } from "../../utils/checkAuthDeliveryPartner.js";
import { signDeliveryPartnerToken, verifyDeliveryPartnerToken } from "../../utils/deliveryPartnerToken.js";
import { signCarWashToken } from "../../utils/carWashToken.js";
import {
    buildPartnerOrdersFilter,
    parsePartnerOrdersQuery,
    toPartnerOrder,
} from "../../utils/deliveryPartnerOrders.js";

const PARTNER_ID = "65f0000000000000000000d1";
const OTHER_PARTNER_ID = "65f0000000000000000000d2";
const COURIER_A = "65f0000000000000000000c1";
const COURIER_B = "65f0000000000000000000c2";
const SECRET = "test-secret";
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

const activePartner = { _id: PARTNER_ID, name: "Быстрая доставка", phone: "+7 700 000 00 01", status: "active", password: "hash" };
const courierA = { _id: COURIER_A, fullName: "Айдар", deliveryPartnerLinkedAt: new Date("2026-11-10T20:00:00Z") };
const courierB = { _id: COURIER_B, fullName: "Ерлан", deliveryPartnerLinkedAt: null };

describe("deliveryPartnerOrders — запрос и фильтр", () => {
    test("history без периода — все заказы; некорректные даты — ошибка", () => {
        const all = buildPartnerOrdersFilter(parsePartnerOrdersQuery({ scope: "history" }, [courierA]));
        assert.equal(all["date.d"], undefined);
        assert.equal(parsePartnerOrdersQuery({ scope: "history", startDate: "13.11.2026" }, [courierA]).error, "Некорректная дата");
        assert.equal(
            parsePartnerOrdersQuery({ scope: "history", startDate: "2026-11-12", endDate: "2026-11-01" }, [courierA]).error,
            "Начало периода позже конца"
        );
    });

    test("длинный период не ограничен, можно задать только одну границу", () => {
        const long = buildPartnerOrdersFilter(
            parsePartnerOrdersQuery({ scope: "history", startDate: "2020-01-01", endDate: "2026-11-13" }, [courierA])
        );
        assert.deepEqual(long["date.d"], { $gte: "2020-01-01", $lte: "2026-11-13" });
        const fromOnly = buildPartnerOrdersFilter(parsePartnerOrdersQuery({ scope: "history", startDate: "2026-01-01" }, [courierA]));
        assert.deepEqual(fromOnly["date.d"], { $gte: "2026-01-01" });
    });

    test("чужой курьер в фильтре — ошибка, а не пустой список по всем", () => {
        const query = parsePartnerOrdersQuery({ scope: "active", courierId: "65f0000000000000000000ff" }, [courierA]);
        assert.equal(query.error, "Курьер не найден");
    });

    test("заказы курьера видны и до дня привязки", () => {
        const query = parsePartnerOrdersQuery({ scope: "history", startDate: "2026-11-01", endDate: "2026-11-12" }, [courierA, courierB]);
        const filter = buildPartnerOrdersFilter(query);
        assert.deepEqual(filter.courierAggregator.$in.map(String), [COURIER_A, COURIER_B]);
        assert.deepEqual(filter["date.d"], { $gte: "2026-11-01", $lte: "2026-11-12" });
    });

    test("active — только незавершённые статусы, без периода", () => {
        const filter = buildPartnerOrdersFilter(parsePartnerOrdersQuery({ scope: "active" }, [courierB]));
        assert.deepEqual(filter.status, { $in: ["awaitingOrder", "onTheWay"] });
        assert.equal(filter["date.d"], undefined);
    });

    test("нет курьеров — null (ничего не запрашиваем)", () => {
        assert.equal(buildPartnerOrdersFilter({ scope: "active", couriers: [] }), null);
    });

    test("заказ для партнёра без данных клиента", () => {
        const order = {
            _id: "o1",
            client: "secret-client",
            clientPhone: "77001112233",
            comment: "домофон 12",
            address: { actual: "Абая 1, кв 5", phone: "77001112233" },
            courierAggregator: COURIER_A,
            date: { d: "2026-11-12", time: "10:00-12:00" },
            status: "delivered",
            products: { b19: 2, b12: 0 },
            sum: 2600,
        };
        const view = toPartnerOrder(order, new Map([[COURIER_A, "Айдар"]]));
        assert.equal(view.address, "Абая 1, кв 5");
        assert.equal(view.courierName, "Айдар");
        assert.equal(JSON.stringify(view).includes("77001112233"), false);
        assert.equal(JSON.stringify(view).includes("домофон"), false);
        assert.equal("client" in view, false);
    });
});

describe("DeliveryPartnerController", () => {
    const makeController = (repoOverrides = {}) =>
        createDeliveryPartnerController({
            repo: {
                findPartnerForLogin: async () => activePartner,
                touchLogin: async () => undefined,
                listCouriers: async () => [courierA],
                listOrders: async () => [],
                summarize: async () => ({ orders: 0, delivered: 0, b19: 0, b12: 0, sum: 0 }),
                ...repoOverrides,
            },
            comparePassword: async (password) => password === "secret1",
            signToken: () => "token",
            loginLimiter: createAttemptLimiter({ maxFailures: 2, windowMs: 60_000 }),
            logger: silentLogger,
        });

    test("вход: неверный пароль 401, после лимита 429", async () => {
        const controller = makeController();
        const req = { body: { phone: "87000000001", password: "wrong" } };
        assert.equal((await call(controller.deliveryPartnerLogin, req)).statusCode, 401);
        assert.equal((await call(controller.deliveryPartnerLogin, req)).statusCode, 401);
        assert.equal((await call(controller.deliveryPartnerLogin, req)).statusCode, 429);
    });

    test("вход: заблокированный партнёр 403", async () => {
        const controller = makeController({ findPartnerForLogin: async () => ({ ...activePartner, status: "blocked" }) });
        const res = await call(controller.deliveryPartnerLogin, { body: { phone: "87000000001", password: "secret1" } });
        assert.equal(res.statusCode, 403);
    });

    test("вход: успешный — токен без пароля в ответе", async () => {
        const res = await call(makeController().deliveryPartnerLogin, { body: { phone: "+7 700 000 00 01", password: "secret1" } });
        assert.equal(res.body.token, "token");
        assert.equal(JSON.stringify(res.body).includes("hash"), false);
    });

    test("заказы: курьеры берутся только у партнёра из токена", async () => {
        let requestedPartner;
        let usedFilter;
        const controller = makeController({
            listCouriers: async (partnerId) => ((requestedPartner = partnerId), [courierA]),
            listOrders: async (filter) => ((usedFilter = filter), [{ _id: "o1", courierAggregator: COURIER_A, date: { d: "2026-11-12" }, status: "onTheWay" }]),
        });
        const res = await call(controller.getDeliveryPartnerOrders, {
            deliveryPartner: activePartner,
            body: { scope: "active" },
        });
        assert.equal(requestedPartner, PARTNER_ID);
        assert.deepEqual(usedFilter.courierAggregator.$in.map(String), [COURIER_A]);
        assert.equal(res.body.orders[0].courierName, "Айдар");
        assert.equal(res.body.summary, undefined);
    });

    test("заказы: страница — по лишней строке определяется hasMore", async () => {
        const many = Array.from({ length: 101 }, (_, i) => ({ _id: `o${i}`, courierAggregator: COURIER_A, date: { d: "2026-11-12" } }));
        const controller = makeController({ listOrders: async () => many });
        const res = await call(controller.getDeliveryPartnerOrders, {
            deliveryPartner: activePartner,
            body: { scope: "history", startDate: "2026-11-01", endDate: "2026-11-12" },
        });
        assert.equal(res.body.orders.length, 100);
        assert.equal(res.body.hasMore, true);
        assert.ok(res.body.summary);
    });

    test("заказы: у партнёра нет курьеров — пустой ответ без запроса заказов", async () => {
        const controller = makeController({
            listCouriers: async () => [],
            listOrders: async () => assert.fail("заказы не должны запрашиваться"),
        });
        const res = await call(controller.getDeliveryPartnerOrders, { deliveryPartner: activePartner, body: { scope: "active" } });
        assert.deepEqual(res.body.orders, []);
    });
});

describe("checkAuthDeliveryPartner и токен", () => {
    test("токен мойки не принимается кабинетом партнёра", () => {
        const carWashToken = signCarWashToken(PARTNER_ID, SECRET);
        assert.equal(verifyDeliveryPartnerToken(carWashToken, SECRET), null);
        assert.equal(verifyDeliveryPartnerToken(signDeliveryPartnerToken(PARTNER_ID, SECRET), SECRET), PARTNER_ID);
    });

    test("нет токена — 401, заблокирован — 403, активен — next", async () => {
        const run = async (partner, token = "t") => {
            const middleware = createCheckAuthDeliveryPartner({
                verifyToken: (value) => (value ? PARTNER_ID : null),
                findPartnerById: async () => partner,
            });
            const res = createRes();
            let isNext = false;
            const req = { headers: { authorization: token ? `Bearer ${token}` : "" } };
            await middleware(req, res, () => (isNext = true));
            return { res, isNext, req };
        };
        assert.equal((await run(activePartner, "")).res.statusCode, 401);
        assert.equal((await run({ ...activePartner, status: "blocked" })).res.statusCode, 403);
        const ok = await run(activePartner);
        assert.equal(ok.isNext, true);
        assert.equal(ok.req.deliveryPartner._id, PARTNER_ID);
    });
});

describe("DeliveryPartnerAdminController — привязка курьера", () => {
    const linkedAt = new Date("2026-10-01T00:00:00Z");
    const NOW = new Date("2026-11-12T06:00:00Z");
    const makeAdmin = (courier, updates) =>
        createDeliveryPartnerAdminController({
            repo: {
                findCourier: async () => courier,
                partnerExists: async (id) => id === PARTNER_ID || id === OTHER_PARTNER_ID,
                updateCourier: async (id, update) => (updates.push(update), { ...courier, ...update }),
            },
            now: () => NOW,
            logger: silentLogger,
        });

    test("привязка к тому же партнёру не сбрасывает дату", async () => {
        const updates = [];
        const admin = makeAdmin({ _id: COURIER_A, deliveryPartner: PARTNER_ID, deliveryPartnerLinkedAt: linkedAt }, updates);
        const res = await call(admin.setCourierDeliveryPartnerAdmin, { body: { courierId: COURIER_A, deliveryPartnerId: PARTNER_ID } });
        assert.equal(res.body.success, true);
        assert.equal(updates.length, 0);
    });

    test("смена партнёра ставит новую дату привязки", async () => {
        const updates = [];
        const admin = makeAdmin({ _id: COURIER_A, deliveryPartner: PARTNER_ID, deliveryPartnerLinkedAt: linkedAt }, updates);
        await call(admin.setCourierDeliveryPartnerAdmin, { body: { courierId: COURIER_A, deliveryPartnerId: OTHER_PARTNER_ID } });
        assert.deepEqual(updates, [{ deliveryPartner: OTHER_PARTNER_ID, deliveryPartnerLinkedAt: NOW }]);
    });

    test("отвязка — null", async () => {
        const updates = [];
        const admin = makeAdmin({ _id: COURIER_A, deliveryPartner: PARTNER_ID, deliveryPartnerLinkedAt: linkedAt }, updates);
        await call(admin.setCourierDeliveryPartnerAdmin, { body: { courierId: COURIER_A, deliveryPartnerId: null } });
        assert.deepEqual(updates, [{ deliveryPartner: null, deliveryPartnerLinkedAt: null }]);
    });

    test("несуществующий партнёр — 404, некорректный id — 400", async () => {
        const admin = makeAdmin({ _id: COURIER_A, deliveryPartner: null }, []);
        const missing = await call(admin.setCourierDeliveryPartnerAdmin, {
            body: { courierId: COURIER_A, deliveryPartnerId: "65f0000000000000000000ee" },
        });
        assert.equal(missing.statusCode, 404);
        const invalid = await call(admin.setCourierDeliveryPartnerAdmin, { body: { courierId: COURIER_A, deliveryPartnerId: "x" } });
        assert.equal(invalid.statusCode, 400);
    });

    test("создание партнёра: пароль обязателен, хэшируется", async () => {
        let created;
        const admin = createDeliveryPartnerAdminController({
            repo: { createPartner: async (data) => ((created = data), { _id: PARTNER_ID, ...data, status: "active" }) },
            hashPassword: async (password) => `hashed:${password}`,
            logger: silentLogger,
        });
        const noPassword = await call(admin.saveDeliveryPartnerAdmin, { body: { name: "А", phone: "87000000001" } });
        assert.equal(noPassword.statusCode, 400);
        const res = await call(admin.saveDeliveryPartnerAdmin, {
            userId: "admin",
            body: { name: "Быстрая доставка", phone: "8 700 000 00 01", password: "secret1" },
        });
        assert.equal(res.body.success, true);
        assert.equal(created.password, "hashed:secret1");
        assert.equal(created.phoneNormalized, "77000000001");
        assert.equal(JSON.stringify(res.body).includes("hashed"), false);
    });
});
