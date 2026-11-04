import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
    ClientPhonesError,
    MAX_ADDITIONAL_PHONES,
    clientHasPhone,
    findClientByAnyPhone,
    normalizeAdditionalPhones,
} from "../clientPhones.js";

describe("normalizeAdditionalPhones", () => {
    test("normalizes formats, drops duplicates and the primary number", () => {
        const result = normalizeAdditionalPhones(
            ["+7 (701) 111-22-33", "87011112233", "7011112244", "+7 700 000 00 00"],
            "+7 700 000-00-00"
        );

        assert.deepEqual(result, ["77011112233", "77011112244"]);
    });

    test("rejects an invalid number", () => {
        assert.throws(() => normalizeAdditionalPhones(["12345"], "77000000000"), ClientPhonesError);
    });

    test("rejects a non-array payload", () => {
        assert.throws(() => normalizeAdditionalPhones("77011112233", "77000000000"), ClientPhonesError);
    });

    test("rejects more than the allowed number of phones", () => {
        const phones = Array.from({ length: MAX_ADDITIONAL_PHONES + 1 }, (_, i) => `7701111220${i}`);

        assert.throws(() => normalizeAdditionalPhones(phones, "77000000000"), ClientPhonesError);
    });

    test("accepts an empty list (removes all additional phones)", () => {
        assert.deepEqual(normalizeAdditionalPhones([], "77000000000"), []);
    });
});

describe("clientHasPhone", () => {
    const client = { phone: "+7 (700) 000-00-00", additionalPhones: ["77011112233"] };

    test("matches the primary phone in any format", () => {
        assert.equal(clientHasPhone(client, "77000000000"), true);
    });

    test("matches an additional phone", () => {
        assert.equal(clientHasPhone(client, "77011112233"), true);
    });

    test("does not match a number sharing only the suffix", () => {
        assert.equal(clientHasPhone(client, "79011112233"), false);
    });
});

describe("findClientByAnyPhone", () => {
    const createModel = (clients) => {
        const calls = [];
        return {
            calls,
            find(filter) {
                calls.push(filter);
                return { limit: async () => clients };
            },
        };
    };

    test("finds a client by an additional phone and searches both fields", async () => {
        const owner = { _id: "c1", phone: "77000000000", additionalPhones: ["77011112233"] };
        const model = createModel([owner]);

        const found = await findClientByAnyPhone(model, "+7 701 111 22 33");

        assert.equal(found, owner);
        assert.deepEqual(Object.keys(model.calls[0].$or[0]), ["phone"]);
        assert.deepEqual(Object.keys(model.calls[0].$or[1]), ["additionalPhones"]);
    });

    test("excludes the given client from the lookup", async () => {
        const model = createModel([]);

        await findClientByAnyPhone(model, "77011112233", { excludeClientId: "c1" });

        assert.deepEqual(model.calls[0]._id, { $ne: "c1" });
    });

    test("returns null for an unparseable phone without querying", async () => {
        const model = createModel([]);

        assert.equal(await findClientByAnyPhone(model, "abc"), null);
        assert.equal(model.calls.length, 0);
    });
});
