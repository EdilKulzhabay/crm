import { describe, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { buildIceServers, readTurnConfig, TURN_CREDENTIAL_TTL_SEC } from "../iceServers.js";
import { createKeyedRateLimiter, createRateLimiter } from "../rateLimiter.js";
import { parseSignal } from "../callSocket.js";
import { MAX_SIGNAL_PAYLOAD_BYTES } from "../callConstants.js";

const CALL_ID = "b".repeat(24);

describe("iceServers", () => {
    test("readTurnConfig возвращает null без секрета или адресов", () => {
        assert.equal(readTurnConfig({ TURN_URLS: "turn:x:3478" }), null);
        assert.equal(readTurnConfig({ TURN_SECRET: "s" }), null);
    });

    test("учётка совместима с coturn use-auth-secret", () => {
        const config = readTurnConfig({
            TURN_SECRET: "secret",
            TURN_URLS: "turn:turn.example.kz:3478?transport=udp, turns:turn.example.kz:5349?transport=tcp",
            STUN_URLS: "stun:turn.example.kz:3478",
        });
        const nowMs = 1_000_000_000_000;

        const { iceServers, ttlSec } = buildIceServers({ type: "client", id: "c1" }, config, nowMs);

        assert.equal(ttlSec, TURN_CREDENTIAL_TTL_SEC);
        assert.deepEqual(iceServers[0], { urls: ["stun:turn.example.kz:3478"] });
        const turn = iceServers[1];
        assert.equal(turn.urls.length, 2);
        assert.equal(turn.username, `${nowMs / 1000 + TURN_CREDENTIAL_TTL_SEC}:client:c1`);
        const expected = crypto.createHmac("sha1", "secret").update(turn.username).digest("base64");
        assert.equal(turn.credential, expected);
    });
});

describe("rateLimiter", () => {
    test("пропускает limit запросов в окне и сбрасывается после него", () => {
        let now = 0;
        const allowed = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });

        assert.deepEqual([allowed(), allowed(), allowed()], [true, true, false]);
        now = 1000;
        assert.equal(allowed(), true);
    });

    test("keyed-лимит считает участников раздельно и общий для всех их сокетов", () => {
        let now = 0;
        const allowed = createKeyedRateLimiter({ limit: 1, windowMs: 1000, now: () => now });

        assert.deepEqual([allowed("client:a"), allowed("client:a"), allowed("client:b")], [true, false, true]);
        now = 1000;
        assert.equal(allowed("client:a"), true);
    });
});

describe("parseSignal", () => {
    test("принимает корректный ICE-кандидат", () => {
        const payload = { candidate: "candidate:1 1 udp 1 1.2.3.4 5 typ host", sdpMid: "0", sdpMLineIndex: 0 };
        assert.deepEqual(parseSignal({ callId: CALL_ID, kind: "ice", payload }), { callId: CALL_ID, kind: "ice", payload });
    });

    test("отклоняет неизвестный тип, битый callId и не-объект", () => {
        const isValidation = (error) => error.code === "VALIDATION";
        assert.throws(() => parseSignal({ callId: CALL_ID, kind: "hack", payload: {} }), isValidation);
        assert.throws(() => parseSignal({ callId: { $ne: null }, kind: "ice", payload: {} }), isValidation);
        assert.throws(() => parseSignal({ callId: CALL_ID, kind: "ice", payload: "x" }), isValidation);
    });

    test("отклоняет слишком большой payload", () => {
        const payload = { sdp: "x".repeat(MAX_SIGNAL_PAYLOAD_BYTES) };
        assert.throws(
            () => parseSignal({ callId: CALL_ID, kind: "offer", payload }),
            (error) => error.code === "VALIDATION"
        );
    });
});
