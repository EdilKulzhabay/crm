import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getCounterpart, isActingAs, isOrderCallable, parseDeviceId, participantRoom } from "../callPolicy.js";
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
        assert.deepEqual(getCounterpart(order(), { type: "courier", id: "courier1" }), { type: "client", id: "client1", deviceId: null });
    });

    test("совпадение id при другом типе не даёт доступа", () => {
        assert.equal(getCounterpart(order({ courierId: "same", clientId: "x" }), { type: "client", id: "same" }), null);
    });
});

describe("устройство участника", () => {
    const CLIENT = { type: "client", id: "client1" };

    test("клиент-вызываемый получает устройство, с которого создан заказ", () => {
        const counterpart = getCounterpart(order({ clientDeviceId: "device-A1" }), { type: "courier", id: "courier1" });
        assert.deepEqual(counterpart, { type: "client", id: "client1", deviceId: "device-A1" });
    });

    test("заказ без устройства — звонок на весь аккаунт клиента", () => {
        const counterpart = getCounterpart(order(), { type: "courier", id: "courier1" });
        assert.deepEqual(counterpart, { type: "client", id: "client1", deviceId: null });
    });

    test("комната устройства отличается от комнаты аккаунта", () => {
        assert.equal(participantRoom(CLIENT), "client:client1");
        assert.equal(participantRoom({ ...CLIENT, deviceId: "device-A1" }), "client:client1:device:device-A1");
    });

    test("сторона с устройством — действовать может только это устройство", () => {
        const side = { ...CLIENT, deviceId: "device-A1" };
        assert.equal(isActingAs(side, { ...CLIENT, deviceId: "device-A1" }), true);
        assert.equal(isActingAs(side, { ...CLIENT, deviceId: "device-B2" }), false);
        assert.equal(isActingAs(side, CLIENT), false);
    });

    test("сторона без устройства — любое устройство аккаунта", () => {
        assert.equal(isActingAs(CLIENT, { ...CLIENT, deviceId: "device-B2" }), true);
        assert.equal(isActingAs(CLIENT, { type: "client", id: "other" }), false);
    });

    test("parseDeviceId принимает только короткие безопасные строки", () => {
        assert.equal(parseDeviceId("3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e"), "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e");
        assert.equal(parseDeviceId(undefined), null);
        assert.equal(parseDeviceId(""), null);
        assert.equal(parseDeviceId({ $ne: null }), null);
        assert.equal(parseDeviceId("a".repeat(65)), null);
        assert.equal(parseDeviceId("bad id with spaces"), null);
    });
});
