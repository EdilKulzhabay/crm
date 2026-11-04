import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { calculateBottleEarnings, getCourierPayoutRates, getOrderPayoutRates } from "../courierPayout.js";

describe("courier payout rates", () => {
    test("falls back to default rates when the courier has none", () => {
        assert.deepEqual(getCourierPayoutRates({ price12: 0, price19: 0 }), { price12: 300, price19: 500 });
    });

    test("a delivered order keeps the rate fixed at delivery after the tariff changes", () => {
        const order = { products: { b12: 2, b19: 3 }, courierPayoutRates: { price12: 300, price19: 500 } };
        const courierAfterTariffChange = { price12: 400, price19: 700 };

        const earnings = calculateBottleEarnings(order.products, getOrderPayoutRates(order, courierAfterTariffChange));

        assert.equal(earnings, 2 * 300 + 3 * 500);
    });

    test("an old order without a snapshot uses the current courier rate", () => {
        const order = { products: { b12: 1, b19: 1 } };

        assert.deepEqual(getOrderPayoutRates(order, { price12: 400, price19: 700 }), { price12: 400, price19: 700 });
    });

    test("ignores missing product counts", () => {
        assert.equal(calculateBottleEarnings({ b19: 2 }, { price12: 300, price19: 500 }), 1000);
        assert.equal(calculateBottleEarnings(undefined, { price12: 300, price19: 500 }), 0);
    });
});
