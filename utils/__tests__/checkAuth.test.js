import { describe, test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.SecretKey = process.env.SecretKey || "test-access-secret";

const { default: checkAuth, AUTH_ERROR_CODES } = await import("../checkAuth.js");
const { default: User } = await import("../../Models/User.js");
const { default: Courier } = await import("../../Models/Courier.js");
const { default: Client } = await import("../../Models/Client.js");
const { default: Department } = await import("../../Models/Department.js");

const CLIENT_ID = "65f000000000000000000001";

function run(authorization) {
    const res = { statusCode: 200, body: null };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    const req = { headers: authorization ? { authorization } : {}, method: "POST", path: "/test" };
    let isNextCalled = false;
    return checkAuth(req, res, () => {
        isNextCalled = true;
    }).then(() => ({ res, req, isNextCalled }));
}

const clientToken = (options = { expiresIn: "30d" }) =>
    `Bearer ${jwt.sign({ client: CLIENT_ID }, process.env.SecretKey, options)}`;

function mockLookups(found) {
    for (const Model of [User, Courier, Department]) {
        mock.method(Model, "findById", async () => null);
    }
    mock.method(Client, "findById", found);
}

describe("checkAuth", () => {
    beforeEach(() => {
        mock.restoreAll();
        mock.method(console, "warn", () => {});
        mock.method(console, "error", () => {});
    });

    test("без токена — 403 TOKEN_MISSING", async () => {
        const { res, isNextCalled } = await run();
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.code, AUTH_ERROR_CODES.missing);
        assert.equal(isNextCalled, false);
    });

    test("просроченный токен — 403 TOKEN_EXPIRED, приложение может обновить сессию", async () => {
        const { res } = await run(clientToken({ expiresIn: -1 }));
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.code, AUTH_ERROR_CODES.expired);
    });

    test("поддельный токен — 403 TOKEN_INVALID", async () => {
        const { res } = await run("Bearer not-a-jwt");
        assert.equal(res.body.code, AUTH_ERROR_CODES.invalid);
    });

    test("сбой базы — 500, а не «Нет доступа»", async () => {
        mockLookups(async () => null);
        mock.method(User, "findById", async () => {
            throw new Error("connection reset");
        });
        const { res, isNextCalled } = await run(clientToken());
        assert.equal(res.statusCode, 500);
        assert.equal(isNextCalled, false);
    });

    test("аккаунта больше нет — 403 USER_NOT_FOUND", async () => {
        mockLookups(async () => null);
        const { res } = await run(clientToken());
        assert.equal(res.body.code, AUTH_ERROR_CODES.userNotFound);
    });

    test("действующий токен клиента пропускает запрос", async () => {
        mockLookups(async () => new Client({ _id: CLIENT_ID }));
        const { req, isNextCalled } = await run(clientToken());
        assert.equal(isNextCalled, true);
        assert.equal(req.userType, "client");
        assert.equal(String(req.userId), CLIENT_ID);
    });
});
