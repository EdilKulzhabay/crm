import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getCounterpart, isOrderCallable } from "../callPolicy.js";
import { CALL_WINDOW_AFTER_DELIVERY_MS } from "../callConstants.js";

const NOW = new Date(Date.UTC(2026, 8, 29, 10));
const order = (overrides = {}) => ({
    id: "o",
    status: "onTheWay",
    clientId: "client1",
    courierId: "courier1",
    deliveredTime: null,
    clientName: "",
    courierName: "",
    ...overrides,
});

describe("isOrderCallable", () => {
    test("разрешено сразу после назначения курьера", () => {
        assert.equal(isOrderCallable(order({ status: "awaitingOrder" }), NOW), true);
    });

    test("запрещено, пока курьер не назначен", () => {
        assert.equal(isOrderCallable(order({ courierId: null }), NOW), false);
    });

    test("запрещено для отменённого заказа", () => {
        assert.equal(isOrderCallable(order({ status: "cancelled" }), NOW), false);
    });

    test("разрешено в пределах окна после доставки", () => {
        const deliveredTime = new Date(NOW.getTime() - CALL_WINDOW_AFTER_DELIVERY_MS);
        assert.equal(isOrderCallable(order({ status: "delivered", deliveredTime }), NOW), true);
    });

    test("запрещено после окна доставки", () => {
        const deliveredTime = new Date(NOW.getTime() - CALL_WINDOW_AFTER_DELIVERY_MS - 1);
        assert.equal(isOrderCallable(order({ status: "delivered", deliveredTime }), NOW), false);
    });

    test("доставлен без deliveredTime — запрещено", () => {
        assert.equal(isOrderCallable(order({ status: "delivered" }), NOW), false);
    });
});

describe("getCounterpart", () => {
    test("для клиента — курьер, для курьера — клиент", () => {
        assert.deepEqual(getCounterpart(order(), { type: "client", id: "client1" }), { type: "courier", id: "courier1" });
        assert.deepEqual(getCounterpart(order(), { type: "courier", id: "courier1" }), { type: "client", id: "client1" });
    });

    test("совпадение id при другом типе не даёт доступа", () => {
        assert.equal(getCounterpart(order({ courierId: "same", clientId: "x" }), { type: "client", id: "same" }), null);
    });
});
