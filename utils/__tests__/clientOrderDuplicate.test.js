import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
    DUPLICATE_ORDER_MESSAGE,
    findDuplicateClientOrder,
    isSameOrderAddress,
    normalizeOrderAddress,
    ORDER_CREATED_AFTER_PAYMENT_MESSAGE,
    ORDER_EXISTS_CODES,
    withClientOrderLock,
} from "../clientOrderDuplicate.js";

/** Модель Mongoose: find(filter).select().lean() — запоминает фильтры */
const fakeModel = (docs) => {
    const filters = [];
    return {
        filters,
        find(filter) {
            filters.push(filter);
            return { select: () => ({ lean: async () => docs }) };
        },
    };
};

const ADDRESS = "Абая 10, этаж 3, квартира 12";
const params = (orders, invoices = []) => ({
    OrderModel: fakeModel(orders),
    ApiPayInvoiceModel: fakeModel(invoices),
    clientId: "client-1",
    dates: ["2026-11-14", "2026-11-14"],
    actual: ADDRESS,
    now: new Date("2026-11-14T08:00:00Z"),
});

describe("normalizeOrderAddress", () => {
    test("не различает регистр, пробелы, ё и «квартира»/«офис»", () => {
        assert.equal(isSameOrderAddress("  абая 10 ,этаж 3,  КВАРТИРА 12. ", ADDRESS), true);
        assert.equal(isSameOrderAddress("Абая 10, этаж 3, офис 12", ADDRESS), true);
        assert.equal(isSameOrderAddress("Тёплая 1", "Теплая 1"), true);
    });

    test("разные квартиры — разные адреса, пустой адрес ни с чем не совпадает", () => {
        assert.equal(isSameOrderAddress("Абая 10, этаж 3, квартира 13", ADDRESS), false);
        assert.equal(isSameOrderAddress("", ""), false);
        assert.equal(normalizeOrderAddress(null), "");
    });
});

describe("findDuplicateClientOrder", () => {
    test("нет заказа на этот адрес — не дубль", async () => {
        const result = await findDuplicateClientOrder(params([{ address: { actual: "Сатпаева 5" } }]));
        assert.equal(result, null);
    });

    test("тот же адрес в другой записи — дубль с понятным текстом", async () => {
        const input = params([{ address: { actual: "абая 10,  этаж 3, квартира 12" } }]);
        const result = await findDuplicateClientOrder(input);
        assert.deepEqual(result, { code: ORDER_EXISTS_CODES.duplicate, message: DUPLICATE_ORDER_MESSAGE });
        assert.deepEqual(input.OrderModel.filters[0], {
            client: "client-1",
            "date.d": { $in: ["2026-11-14"] },
            status: { $ne: "cancelled" },
        });
    });

    test("заказ создал сервер после оплаты Kaspi — прежний текст, который приложение считает успехом", async () => {
        const result = await findDuplicateClientOrder(
            params([{ address: { actual: ADDRESS } }], [{ pendingOrderDraft: { address: { actual: ADDRESS } } }])
        );
        assert.deepEqual(result, {
            code: ORDER_EXISTS_CODES.createdAfterPayment,
            message: ORDER_CREATED_AFTER_PAYMENT_MESSAGE,
        });
    });

    test("без адреса или даты проверку не делаем", async () => {
        const noAddress = params([{ address: { actual: "" } }]);
        assert.equal(await findDuplicateClientOrder({ ...noAddress, actual: " " }), null);
        assert.equal(await findDuplicateClientOrder({ ...noAddress, dates: [undefined, ""] }), null);
        assert.equal(noAddress.OrderModel.filters.length, 0);
    });
});

describe("withClientOrderLock", () => {
    test("заказы одного клиента выполняются по очереди, ошибка не ломает очередь", async () => {
        const events = [];
        const slow = withClientOrderLock("c1", async () => {
            events.push("first:start");
            await new Promise((resolve) => setTimeout(resolve, 20));
            events.push("first:end");
            throw new Error("boom");
        });
        const second = withClientOrderLock("c1", async () => {
            events.push("second");
            return "ok";
        });
        await assert.rejects(slow, /boom/);
        assert.equal(await second, "ok");
        assert.deepEqual(events, ["first:start", "first:end", "second"]);
    });

    test("разные клиенты не ждут друг друга", async () => {
        const events = [];
        const slow = withClientOrderLock("a", async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            events.push("a");
        });
        await withClientOrderLock("b", async () => events.push("b"));
        await slow;
        assert.deepEqual(events, ["b", "a"]);
    });
});
