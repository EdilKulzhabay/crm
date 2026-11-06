import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isOrderAssignedToCourier } from "../orderCourierAssignment.js";

describe("isOrderAssignedToCourier", () => {
    test("заказ без курьера можно удалять", () => {
        assert.equal(isOrderAssignedToCourier({ courier: null, courierAggregator: null }), false);
        assert.equal(isOrderAssignedToCourier({}), false);
    });

    test("назначен курьеру-агрегатору", () => {
        assert.equal(isOrderAssignedToCourier({ courierAggregator: "c1" }), true);
    });

    test("назначен старому курьеру", () => {
        assert.equal(isOrderAssignedToCourier({ courier: "c1", courierAggregator: null }), true);
    });

    test("нет заказа — не назначен", () => {
        assert.equal(isOrderAssignedToCourier(null), false);
    });
});
