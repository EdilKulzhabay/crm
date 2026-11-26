import { describe, test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.SecretKey = process.env.SecretKey || "test-access-secret";
process.env.SecretKeyRefresh = process.env.SecretKeyRefresh || "test-refresh-secret";

const { default: Client } = await import("../../Models/Client.js");
const {
    issueClientSession,
    refreshClientSession,
    revokeClientSession,
    RefreshRejectedError,
} = await import("../clientSessions.js");

const CLIENT_ID = "65f000000000000000000001";

/** Клиент в памяти вместо MongoDB: findById(...).select(...).lean() и updateOne с версией */
function useInMemoryClient(initial) {
    let doc = structuredClone(initial);
    mock.method(Client, "findById", () => ({
        select: () => ({ lean: async () => (doc ? structuredClone(doc) : null) }),
    }));
    mock.method(Client, "updateOne", async (filter, update) => {
        const version = doc.refreshSessionsVersion ?? 0;
        const expected = filter.refreshSessionsVersion;
        const matches = typeof expected === "number" ? expected === version : version === 0;
        if (!matches) {
            return { modifiedCount: 0 };
        }
        doc = { ...doc, ...structuredClone(update.$set) };
        return { modifiedCount: 1 };
    });
    return () => doc;
}

const legacyRefresh = () =>
    jwt.sign({ client: CLIENT_ID }, process.env.SecretKeyRefresh, { expiresIn: "30d" });

describe("сессии клиента", () => {
    beforeEach(() => mock.restoreAll());

    test("вход на двух устройствах — обе сессии обновляются независимо", async () => {
        const read = useInMemoryClient({ _id: CLIENT_ID, status: "active" });
        const phone1 = await issueClientSession(CLIENT_ID);
        const phone2 = await issueClientSession(CLIENT_ID);

        const next1 = await refreshClientSession(phone1.refreshToken);
        const next2 = await refreshClientSession(phone2.refreshToken);

        assert.ok(next1.accessToken && next2.accessToken);
        assert.equal(read().refreshSessions.length, 2);
        assert.equal(jwt.verify(next1.accessToken, process.env.SecretKey).client, CLIENT_ID);
    });

    test("старый одиночный refreshToken принимается один раз и становится сессией", async () => {
        const token = legacyRefresh();
        const read = useInMemoryClient({ _id: CLIENT_ID, status: "active", refreshToken: token });

        const tokens = await refreshClientSession(token);

        assert.equal(read().refreshToken, null);
        assert.equal(read().refreshSessions.length, 1);
        await refreshClientSession(tokens.refreshToken);
    });

    test("использованный токен после окна повтора отклоняется", async (t) => {
        useInMemoryClient({ _id: CLIENT_ID, status: "active" });
        const first = await issueClientSession(CLIENT_ID);
        await refreshClientSession(first.refreshToken);

        t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 3 * 60 * 1000 });
        await assert.rejects(refreshClientSession(first.refreshToken), (error) => {
            return error instanceof RefreshRejectedError && error.reason === "UNKNOWN_SESSION";
        });
    });

    test("повтор с тем же токеном сразу после ротации (потерянный ответ) проходит", async () => {
        useInMemoryClient({ _id: CLIENT_ID, status: "active" });
        const first = await issueClientSession(CLIENT_ID);
        await refreshClientSession(first.refreshToken);
        const retried = await refreshClientSession(first.refreshToken);
        assert.ok(retried.refreshToken);
    });

    test("удалённому клиенту обновление не выдаётся", async () => {
        useInMemoryClient({ _id: CLIENT_ID, status: "deleted", refreshToken: legacyRefresh() });
        await assert.rejects(refreshClientSession(legacyRefresh()), { reason: "CLIENT_INACTIVE" });
    });

    test("просроченный и поддельный токены отклоняются без обращения к базе", async () => {
        useInMemoryClient({ _id: CLIENT_ID, status: "active" });
        const expired = jwt.sign({ client: CLIENT_ID }, process.env.SecretKeyRefresh, { expiresIn: -1 });
        await assert.rejects(refreshClientSession(expired), { reason: "EXPIRED" });
        await assert.rejects(refreshClientSession("not-a-jwt"), { reason: "INVALID" });
        assert.equal(Client.findById.mock.callCount(), 0);
    });

    test("выход отзывает сессию только этого устройства и не удаляет клиента", async () => {
        const read = useInMemoryClient({ _id: CLIENT_ID, status: "active" });
        const phone1 = await issueClientSession(CLIENT_ID);
        const phone2 = await issueClientSession(CLIENT_ID);

        await revokeClientSession(phone1.refreshToken);

        assert.equal(read().status, "active");
        await assert.rejects(refreshClientSession(phone1.refreshToken), { reason: "UNKNOWN_SESSION" });
        await refreshClientSession(phone2.refreshToken);
    });

    test("выход с мусором вместо токена ничего не трогает", async () => {
        useInMemoryClient({ _id: CLIENT_ID, status: "active" });
        await revokeClientSession("garbage");
        assert.equal(Client.updateOne.mock.callCount(), 0);
    });
});
