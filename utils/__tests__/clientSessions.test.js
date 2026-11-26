import { test } from "node:test";
import assert from "node:assert/strict";
import {
    MAX_CLIENT_SESSIONS,
    REFRESH_GRACE_MS,
    addSession,
    clientIdFromPayload,
    findSession,
    hashToken,
    removeSession,
    rotateSession,
} from "../clientSessions.js";

const NOW = Date.UTC(2026, 10, 26, 12, 0, 0);

test("хэш токена детерминирован и не совпадает с токеном", () => {
    assert.equal(hashToken("abc"), hashToken("abc"));
    assert.notEqual(hashToken("abc"), "abc");
    assert.notEqual(hashToken("abc"), hashToken("abd"));
});

test("клиент берётся из нового и старого формата payload", () => {
    assert.equal(clientIdFromPayload({ client: "id1" }), "id1");
    assert.equal(clientIdFromPayload({ client: { _id: "id2" } }), "id2");
    assert.equal(clientIdFromPayload(null), "");
});

test("вход на втором устройстве не отзывает сессию первого", () => {
    const first = addSession(undefined, "h1", NOW);
    const both = addSession(first, "h2", NOW + 1000);
    assert.deepEqual(findSession(both, "h1", NOW + 2000), { index: both.findIndex((s) => s.hash === "h1"), isPrevious: false });
    assert.ok(findSession(both, "h2", NOW + 2000));
});

test("сессий не больше лимита: вытесняется давно не использованная", () => {
    let sessions = [];
    for (let i = 0; i <= MAX_CLIENT_SESSIONS; i++) {
        sessions = addSession(sessions, `h${i}`, NOW + i * 1000);
    }
    assert.equal(sessions.length, MAX_CLIENT_SESSIONS);
    assert.equal(findSession(sessions, "h0", NOW + 60_000), null);
    assert.ok(findSession(sessions, `h${MAX_CLIENT_SESSIONS}`, NOW + 60_000));
});

test("после ротации старый токен принимается только в коротком окне", () => {
    const sessions = addSession([], "old", NOW);
    const match = findSession(sessions, "old", NOW);
    const rotated = rotateSession(sessions, match, "new", "old", NOW);

    assert.deepEqual(findSession(rotated, "new", NOW), { index: 0, isPrevious: false });
    assert.deepEqual(findSession(rotated, "old", NOW + REFRESH_GRACE_MS), { index: 0, isPrevious: true });
    assert.equal(findSession(rotated, "old", NOW + REFRESH_GRACE_MS + 1), null);
});

test("повтор со старым токеном не продлевает окно приёма", () => {
    const sessions = rotateSession(addSession([], "old", NOW), { index: 0, isPrevious: false }, "new", "old", NOW);
    const retry = findSession(sessions, "old", NOW + 1000);
    const again = rotateSession(sessions, retry, "newer", "old", NOW + 1000);

    assert.equal(again[0].hash, "newer");
    assert.equal(new Date(again[0].rotatedAt).getTime(), NOW);
    assert.equal(findSession(again, "old", NOW + REFRESH_GRACE_MS + 1), null);
});

test("выход отзывает только свою сессию", () => {
    const sessions = addSession(addSession([], "h1", NOW), "h2", NOW);
    const left = removeSession(sessions, "h1");
    assert.equal(left.length, 1);
    assert.equal(left[0].hash, "h2");
    assert.deepEqual(removeSession(sessions, "unknown"), sessions);
    assert.deepEqual(removeSession(undefined, "h1"), []);
});

test("неизвестный токен не находит сессию", () => {
    assert.equal(findSession(addSession([], "h1", NOW), "other", NOW), null);
    assert.equal(findSession(undefined, "h1", NOW), null);
});
