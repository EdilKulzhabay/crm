import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DELETABLE_ORDER_FILTER, isOrderAssignedToCourier, isOrderDeletionBlocked } from "../orderCourierAssignment.js";

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

describe("isOrderDeletionBlocked", () => {
    test("заказ в работе у курьера удалять нельзя", () => {
        assert.equal(isOrderDeletionBlocked({ status: "onTheWay", courierAggregator: "c1" }), true);
        assert.equal(isOrderDeletionBlocked({ status: "awaitingOrder", courier: "c1" }), true);
    });

    test("доставленный или отменённый заказ с курьером удалять можно", () => {
        assert.equal(isOrderDeletionBlocked({ status: "delivered", courierAggregator: "c1" }), false);
        assert.equal(isOrderDeletionBlocked({ status: "cancelled", courier: "c1" }), false);
    });

    test("заказ без курьера удалять можно", () => {
        assert.equal(isOrderDeletionBlocked({ status: "awaitingOrder", courier: null, courierAggregator: null }), false);
    });

    test("атомарный фильтр пропускает завершённые заказы", () => {
        assert.deepEqual(DELETABLE_ORDER_FILTER.$or[0], { status: { $in: ["delivered", "cancelled"] } });
    });
});
