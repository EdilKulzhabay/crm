import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "events";
import { callIdToUuid, createCallPushNotifier, PUSH_TYPES } from "../push/callPushNotifier.js";
import { createApnsSender } from "../push/apnsSender.js";
import { parsePushTokenInput, parseTokenOnly } from "../push/pushTokenInput.js";
import { readApnsConfig } from "../push/pushConfig.js";

const CALLEE = { type: "client", id: "c".repeat(24) };
const CALL_ID = "b".repeat(24);
const IOS_TOKEN = "a".repeat(64);
const ANDROID_TOKEN = "fcm-token:" + "x".repeat(40);
const INCOMING = { callId: CALL_ID, orderId: "o1", caller: { type: "courier", name: "Ерлан" }, ringTimeoutMs: 40_000 };

const createSenderStub = (resultByToken = {}) => {
    const sent = [];
    return {
        sent,
        send: async (message) => {
            sent.push(message);
            return resultByToken[message.token] ?? { ok: true };
        },
    };
};

const setupNotifier = ({ devices, apnsResults, fcmResults, apnsEnabled = true } = {}) => {
    const deleted = [];
    const errors = [];
    const apns = createSenderStub(apnsResults);
    const fcm = createSenderStub(fcmResults);
    const notifier = createCallPushNotifier({
        tokenRepository: {
            findTokens: async () => devices,
            deleteTokens: async (tokens) => deleted.push(...tokens),
        },
        apns: apnsEnabled ? apns : null,
        apnsTopics: apnsEnabled ? { client: "com.client.voip", courier: "com.courier.voip" } : null,
        fcmByType: { client: fcm, courier: null },
        now: () => 1_000,
        logger: { error: (message) => errors.push(message), warn: () => {} },
    });
    return { notifier, apns, fcm, deleted, errors };
};

const BOTH_DEVICES = [
    { platform: "ios", token: IOS_TOKEN, apnsEnvironment: "sandbox" },
    { platform: "android", token: ANDROID_TOKEN, apnsEnvironment: null },
];

describe("callIdToUuid", () => {
    test("детерминированный UUID из ObjectId", () => {
        assert.equal(callIdToUuid("0123456789ABCDEF01234567"), "01234567-89ab-cdef-0123-456700000000");
    });
});

describe("callPushNotifier", () => {
    test("входящий: VoIP-пуш на iOS с topic и окружением, data-сообщение на Android", async () => {
        const { notifier, apns, fcm } = setupNotifier({ devices: BOTH_DEVICES });

        await notifier.notifyIncomingCall(CALLEE, INCOMING);

        assert.equal(apns.sent.length, 1);
        assert.equal(apns.sent[0].topic, "com.client.voip");
        assert.equal(apns.sent[0].environment, "sandbox");
        assert.equal(apns.sent[0].payload.type, PUSH_TYPES.INCOMING_CALL);
        assert.equal(apns.sent[0].payload.callUuid, callIdToUuid(CALL_ID));
        assert.equal(apns.sent[0].payload.expiresAt, 41_000);

        assert.equal(fcm.sent.length, 1);
        assert.equal(fcm.sent[0].ttlMs, 40_000);
        assert.equal(fcm.sent[0].data.callerName, "Ерлан");
        assert.ok(Object.values(fcm.sent[0].data).every((value) => typeof value === "string"), "FCM data — только строки");
    });

    test("протухшие токены удаляются, прочие ошибки логируются", async () => {
        const { notifier, deleted, errors } = setupNotifier({
            devices: BOTH_DEVICES,
            apnsResults: { [IOS_TOKEN]: { ok: false, isInvalidToken: true, reason: "Unregistered" } },
            fcmResults: { [ANDROID_TOKEN]: { ok: false, isInvalidToken: false, reason: "messaging/internal-error" } },
        });

        await notifier.notifyIncomingCall(CALLEE, INCOMING);

        assert.deepEqual(deleted, [IOS_TOKEN]);
        assert.equal(errors.length, 1);
        assert.match(errors[0], /internal-error/);
    });

    test("отмена звонка уходит только на Android: VoIP-пуш без показа CallKit запрещён", async () => {
        const { notifier, apns, fcm } = setupNotifier({ devices: BOTH_DEVICES });

        await notifier.notifyCallEnded(CALLEE, { callId: CALL_ID, ttlMs: 40_000 });

        assert.equal(apns.sent.length, 0);
        assert.equal(fcm.sent.length, 1);
        assert.equal(fcm.sent[0].data.type, PUSH_TYPES.CALL_ENDED);
    });

    test("предупреждение, если у участника не осталось рабочих токенов", async () => {
        const warnings = [];
        const notifier = createCallPushNotifier({
            tokenRepository: { findTokens: async () => [BOTH_DEVICES[0]], deleteTokens: async () => {} },
            apns: { send: async () => ({ ok: false, isInvalidToken: true, reason: "Unregistered" }) },
            apnsTopics: { client: "com.client.voip", courier: "com.courier.voip" },
            fcmByType: { client: null, courier: null },
            logger: { error: () => {}, warn: (message) => warnings.push(message) },
        });

        await notifier.notifyIncomingCall(CALLEE, INCOMING);

        assert.equal(warnings.length, 1);
        assert.match(warnings[0], /не осталось рабочих push-токенов/);
    });

    test("APNs не настроен — iOS пропускается без ошибок", async () => {
        const { notifier, fcm, errors } = setupNotifier({ devices: BOTH_DEVICES, apnsEnabled: false });

        await notifier.notifyIncomingCall(CALLEE, INCOMING);

        assert.equal(fcm.sent.length, 1);
        assert.equal(errors.length, 0);
    });
});

/** Фейковая HTTP/2-сессия: отвечает заданными статусами по очереди */
const createFakeHttp2 = (responses) => {
    const requests = [];
    let connects = 0;
    const connect = (host) => {
        connects += 1;
        const session = new EventEmitter();
        session.closed = false;
        session.destroyed = false;
        session.close = () => {};
        session.request = (headers) => {
            const request = new EventEmitter();
            request.setEncoding = () => {};
            request.setTimeout = () => {};
            request.close = () => {};
            request.end = (body) => {
                requests.push({ host, headers, body: JSON.parse(body) });
                const { status, body: responseBody = "" } = responses.shift();
                setImmediate(() => {
                    request.emit("response", { ":status": status });
                    if (responseBody) request.emit("data", responseBody);
                    request.emit("close");
                });
            };
            return request;
        };
        return session;
    };
    return { connect, requests, connects: () => connects };
};

describe("apnsSender", () => {
    const createSender = (fake, signJwt = () => "signed-jwt") =>
        createApnsSender({ keyPem: "pem", keyId: "KEY123", teamId: "TEAM123", connect: fake.connect, signJwt });
    const message = (environment = "production") => ({ token: IOS_TOKEN, environment, topic: "com.client.voip", payload: {} });

    test("VoIP-заголовки, окружение и переиспользование HTTP/2-сессии", async () => {
        const fake = createFakeHttp2([{ status: 200 }, { status: 200 }]);
        const sender = createSender(fake);

        assert.deepEqual(await sender.send(message("sandbox")), { ok: true });
        await sender.send(message("sandbox"));

        const [first] = fake.requests;
        assert.equal(first.host, "https://api.sandbox.push.apple.com");
        assert.equal(first.headers[":path"], `/3/device/${IOS_TOKEN}`);
        assert.equal(first.headers["apns-push-type"], "voip");
        assert.equal(first.headers["apns-topic"], "com.client.voip");
        assert.equal(first.headers["apns-expiration"], "0");
        assert.equal(first.headers.authorization, "bearer signed-jwt");
        assert.equal(fake.connects(), 1);
    });

    test("410 и BadDeviceToken — токен невалиден, 500 — нет", async () => {
        const fake = createFakeHttp2([
            { status: 410, body: JSON.stringify({ reason: "Unregistered" }) },
            { status: 400, body: JSON.stringify({ reason: "BadDeviceToken" }) },
            { status: 500, body: JSON.stringify({ reason: "InternalServerError" }) },
        ]);
        const sender = createSender(fake);

        const results = [await sender.send(message()), await sender.send(message()), await sender.send(message())];

        assert.deepEqual(
            results.map((r) => r.isInvalidToken),
            [true, true, false]
        );
        assert.equal(results[2].reason, "InternalServerError");
    });

    test("provider token (JWT) кешируется и перевыпускается после 403", async () => {
        const fake = createFakeHttp2([
            { status: 200 },
            { status: 403, body: JSON.stringify({ reason: "ExpiredProviderToken" }) },
            { status: 200 },
        ]);
        let signed = 0;
        const sender = createSender(fake, () => `jwt-${++signed}`);

        await sender.send(message());
        await sender.send(message());
        await sender.send(message());

        assert.deepEqual(
            fake.requests.map((r) => r.headers.authorization),
            ["bearer jwt-1", "bearer jwt-1", "bearer jwt-2"]
        );
    });
});

describe("pushTokenInput", () => {
    test("iOS: hex-токен в нижнем регистре и окружение обязательно", () => {
        assert.deepEqual(parsePushTokenInput({ platform: "ios", token: "A".repeat(64), apnsEnvironment: "production" }), {
            platform: "ios",
            token: "a".repeat(64),
            apnsEnvironment: "production",
        });
        assert.throws(() => parsePushTokenInput({ platform: "ios", token: "A".repeat(64) }), { code: "VALIDATION" });
        assert.throws(() => parsePushTokenInput({ platform: "ios", token: "zz", apnsEnvironment: "production" }), {
            code: "VALIDATION",
        });
    });

    test("Android: FCM-токен, окружение игнорируется", () => {
        assert.deepEqual(parsePushTokenInput({ platform: "android", token: ANDROID_TOKEN, apnsEnvironment: "sandbox" }), {
            platform: "android",
            token: ANDROID_TOKEN,
            apnsEnvironment: null,
        });
        assert.throws(() => parsePushTokenInput({ platform: "android", token: { $ne: "" } }), { code: "VALIDATION" });
        assert.throws(() => parsePushTokenInput({ platform: "web", token: ANDROID_TOKEN }), { code: "VALIDATION" });
    });

    test("parseTokenOnly отклоняет не-строки (NoSQL-инъекции)", () => {
        assert.equal(parseTokenOnly({ token: ANDROID_TOKEN }), ANDROID_TOKEN);
        assert.throws(() => parseTokenOnly({ token: { $gt: "" } }), { code: "VALIDATION" });
    });
});

describe("pushConfig", () => {
    test("APNs включается только при полном наборе переменных", () => {
        const env = {
            APNS_KEY_PATH: "/secrets/key.p8",
            APNS_KEY_ID: "KEY",
            APNS_TEAM_ID: "TEAM",
            APNS_BUNDLE_ID_CLIENT: "com.tibetskayaclientapp",
            APNS_BUNDLE_ID_COURIER: "com.tibetskayacourier2.app",
        };
        const config = readApnsConfig(env, () => "pem");
        assert.deepEqual(config.topics, {
            client: "com.tibetskayaclientapp.voip",
            courier: "com.tibetskayacourier2.app.voip",
        });
        assert.equal(readApnsConfig({ ...env, APNS_TEAM_ID: "" }, () => "pem"), null);
    });
});
