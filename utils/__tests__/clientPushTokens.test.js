import { test } from "node:test";
import assert from "node:assert/strict";
import { collectOrderPushTokens } from "../clientPushTokens.js";

test("добавляет актуальные токены клиента к устаревшему токену заказа", () => {
    const tokens = collectOrderPushTokens(
        { notificationToken: "old" },
        { notificationPushTokens: ["new1", "new2"], notificationPushToken: "legacy" },
    );
    assert.deepEqual(tokens, ["old", "new1", "new2", "legacy"]);
});

test("без токена в заказе берёт токены клиента", () => {
    assert.deepEqual(collectOrderPushTokens({ notificationToken: "" }, { notificationPushTokens: ["a"] }), ["a"]);
});

test("убирает дубли, пробелы и пустые значения", () => {
    const tokens = collectOrderPushTokens(
        { notificationToken: " a " },
        { notificationPushTokens: ["a", "", null, "b"], notificationPushToken: "b" },
    );
    assert.deepEqual(tokens, ["a", "b"]);
});

test("без заказа и клиента — пустой список", () => {
    assert.deepEqual(collectOrderPushTokens(null, undefined), []);
});
