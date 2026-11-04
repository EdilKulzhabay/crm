import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
    createForteBusinessClient,
    formatForteDate,
    isIncomingTransaction,
    readForteBusinessConfig,
} from "../forteBusiness.js";

const ACCOUNT = "KZ1596521F0008530262";
const CONFIG = { baseUrl: "https://bank.test/fincore", clientId: 1, clientSecret: "s", apiKey: "k", accountNumber: ACCOUNT };

const jwtExpiringAt = (expSec) =>
    `h.${Buffer.from(JSON.stringify({ exp: expSec })).toString("base64url")}.s`;

/** Фейковый банк: считает входы, отдаёт историю постранично с page от 0 */
const createBank = ({ operations = [], revokeFirstToken = false } = {}) => {
    const state = { logins: 0, requests: [] };
    let tokenIndex = 0;
    return {
        state,
        request: async ({ method, url, params, headers }) => {
            state.requests.push({ method, url, params, headers });
            if (url.endsWith("/auth/login")) {
                state.logins += 1;
                tokenIndex += 1;
                return { status: 200, data: { token: jwtExpiringAt(Math.floor(Date.now() / 1000) + 600) + tokenIndex } };
            }
            if (revokeFirstToken && headers.Authorization.endsWith("1")) return { status: 401, data: "Unauthorized" };
            const { page, size } = params;
            return { status: 200, data: { list: operations.slice(page * size, page * size + size), page, size, total: operations.length } };
        },
    };
};

describe("readForteBusinessConfig", () => {
    test("is disabled until every credential is set", () => {
        assert.equal(readForteBusinessConfig({ FORTE_BUSINESS_CLIENT_ID: "741" }), null);
        const config = readForteBusinessConfig({
            FORTE_BUSINESS_CLIENT_ID: "741",
            FORTE_BUSINESS_CLIENT_SECRET: "secret",
            FORTE_BUSINESS_API_KEY: "key",
            FORTE_BUSINESS_ACCOUNT: ACCOUNT,
        });
        assert.equal(config.clientId, 741);
        assert.equal(config.baseUrl, "https://gravitee-api-gateway.forte.kz/fincore");
    });
});

describe("ForteBusiness client", () => {
    test("formats dates as dd.mm.yyyy in Almaty time", () => {
        // 23:30 UTC 1 ноября — в Алматы уже 2 ноября
        assert.equal(formatForteDate(new Date("2026-11-01T23:30:00Z")), "02.11.2026");
    });

    test("loads every page starting from page 0 and sends the gateway key", async () => {
        const operations = Array.from({ length: 101 }, (_, i) => ({ id: i }));
        const bank = createBank({ operations });
        const client = createForteBusinessClient(CONFIG, { http: bank });

        const history = await client.listAccountHistory({ from: new Date(), to: new Date() });

        assert.equal(history.length, 101);
        const pages = bank.state.requests.filter((r) => r.url.endsWith("/account-history")).map((r) => r.params.page);
        assert.deepEqual(pages, [0, 1]);
        assert.ok(bank.state.requests.every((r) => r.headers["X-Gravitee-Api-Key"] === "k"));
    });

    test("reuses the token while it is valid", async () => {
        const bank = createBank();
        const client = createForteBusinessClient(CONFIG, { http: bank });

        await Promise.all([client.getAccountBalance(), client.getAccountBalance(), client.getAccountBalance()]);

        assert.equal(bank.state.logins, 1);
    });

    test("logs in again once when the bank revokes the token", async () => {
        const bank = createBank({ revokeFirstToken: true });
        const client = createForteBusinessClient(CONFIG, { http: bank });

        await client.getAccountBalance();

        assert.equal(bank.state.logins, 2);
    });

    test("a failed login is reported, not swallowed", async () => {
        const http = { request: async () => ({ status: 401, data: { message: "Unauthorized" } }) };
        const client = createForteBusinessClient(CONFIG, { http });

        await assert.rejects(client.getAccountBalance(), /ForteBusiness 401/);
    });
});

describe("isIncomingTransaction", () => {
    test("keeps only live credits to our account", () => {
        const base = { isCredit: 1, isDeleted: 0, amount: 2600, receiverAccount: ACCOUNT };
        assert.equal(isIncomingTransaction(base, ACCOUNT), true);
        assert.equal(isIncomingTransaction({ ...base, isCredit: 0 }, ACCOUNT), false);
        assert.equal(isIncomingTransaction({ ...base, isDeleted: 1 }, ACCOUNT), false);
        assert.equal(isIncomingTransaction({ ...base, receiverAccount: "KZ000" }, ACCOUNT), false);
    });
});
