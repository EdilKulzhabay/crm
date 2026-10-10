import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createCallService } from "../callService.js";
import { CALL_STATUSES, END_REASONS, SOCKET_EVENTS } from "../callConstants.js";
import { CALL_ERROR_CODES } from "../callErrors.js";

const ORDER_ID = "a".repeat(24);
const CLIENT = { type: "client", id: "c".repeat(24) };
const COURIER = { type: "courier", id: "d".repeat(24) };
const STRANGER = { type: "client", id: "e".repeat(24) };
const RING_TIMEOUT_MS = 1000;
const GRACE_MS = 500;

const makeOrder = (overrides = {}) => ({
    id: ORDER_ID,
    status: "onTheWay",
    clientId: CLIENT.id,
    courierId: COURIER.id,
    deliveredTime: null,
    clientName: "Айгерим",
    courierName: "Ерлан",
    ...overrides,
});

/** Управляемые таймеры и часы, чтобы проверять таймауты без ожидания */
const createClock = (startMs = Date.UTC(2026, 8, 29, 10)) => {
    let nowMs = startMs;
    let nextId = 1;
    const timers = new Map();
    return {
        now: () => new Date(nowMs),
        setTimer: (fn, ms) => {
            const id = nextId++;
            timers.set(id, { fn, at: nowMs + ms });
            return id;
        },
        clearTimer: (id) => timers.delete(id),
        advance: (ms) => {
            nowMs += ms;
            [...timers.entries()]
                .filter(([, t]) => t.at <= nowMs)
                .forEach(([id, t]) => {
                    timers.delete(id);
                    t.fn();
                });
        },
    };
};

const setup = ({ order = makeOrder(), repoOverrides = {}, pushNotifier, isKnownDevice, isConnected } = {}) => {
    const clock = createClock();
    const emitted = [];
    const updates = [];
    let idCounter = 0;
    const repository = {
        findOrderForCall: async (id) => (id === ORDER_ID ? order : null),
        newCallId: () => String(++idCounter).padStart(24, "0"),
        createCall: async () => {},
        updateCall: async (callId, fields) => updates.push({ callId, fields }),
        failStaleActiveCalls: async () => 0,
        ...repoOverrides,
    };
    const service = createCallService({
        repository,
        emit: (participant, event, payload) => emitted.push({ to: participant, event, payload }),
        pushNotifier,
        isKnownDevice,
        isConnected,
        logger: { error: () => {}, info: () => {} },
        now: clock.now,
        setTimer: clock.setTimer,
        clearTimer: clock.clearTimer,
        ringTimeoutMs: RING_TIMEOUT_MS,
        reconnectGraceMs: GRACE_MS,
    });
    const eventsTo = (participant, event) =>
        emitted.filter((e) => e.to.id === participant.id && e.event === event).map((e) => e.payload);
    return { service, clock, emitted, updates, eventsTo };
};

const assertCallError = async (fn, code) => {
    await assert.rejects(async () => fn(), (error) => error.code === code);
};

describe("invite", () => {
    test("курьер звонит клиенту: клиент получает call:incoming с именем курьера", async () => {
        const { service, eventsTo } = setup();

        const result = await service.invite(COURIER, ORDER_ID);

        assert.equal(result.callee.type, "client");
        assert.equal(result.callee.name, "Айгерим");
        const [incoming] = eventsTo(CLIENT, SOCKET_EVENTS.INCOMING);
        assert.deepEqual(incoming, {
            callId: result.callId,
            orderId: ORDER_ID,
            caller: { type: "courier", name: "Ерлан" },
        });
    });

    test("клиент может звонить курьеру", async () => {
        const { service, eventsTo } = setup();
        await service.invite(CLIENT, ORDER_ID);
        assert.equal(eventsTo(COURIER, SOCKET_EVENTS.INCOMING).length, 1);
    });

    test("ORDER_NOT_FOUND для несуществующего заказа", async () => {
        const { service } = setup();
        await assertCallError(() => service.invite(COURIER, "f".repeat(24)), CALL_ERROR_CODES.ORDER_NOT_FOUND);
    });

    test("FORBIDDEN, если звонящий не участник заказа", async () => {
        const { service } = setup();
        await assertCallError(() => service.invite(STRANGER, ORDER_ID), CALL_ERROR_CODES.FORBIDDEN);
    });

    test("FORBIDDEN, пока курьер не назначен", async () => {
        const { service } = setup({ order: makeOrder({ courierId: null }) });
        await assertCallError(() => service.invite(CLIENT, ORDER_ID), CALL_ERROR_CODES.FORBIDDEN);
    });

    test("CALL_NOT_ALLOWED для отменённого заказа", async () => {
        const { service } = setup({ order: makeOrder({ status: "cancelled" }) });
        await assertCallError(() => service.invite(CLIENT, ORDER_ID), CALL_ERROR_CODES.CALL_NOT_ALLOWED);
    });

    test("BUSY, если у вызываемого уже есть звонок", async () => {
        const { service } = setup();
        await service.invite(COURIER, ORDER_ID);
        await assertCallError(() => service.invite(CLIENT, ORDER_ID), CALL_ERROR_CODES.BUSY);
    });

    test("одновременные встречные звонки: проходит только один", async () => {
        const { service } = setup();

        const results = await Promise.allSettled([service.invite(COURIER, ORDER_ID), service.invite(CLIENT, ORDER_ID)]);

        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const [rejected] = results.filter((r) => r.status === "rejected");
        assert.equal(rejected.reason.code, CALL_ERROR_CODES.BUSY);
    });

    test("если запись в БД упала, участники освобождаются", async () => {
        let shouldFail = true;
        const { service } = setup({
            repoOverrides: {
                createCall: async () => {
                    if (shouldFail) throw new Error("db down");
                },
            },
        });

        await assert.rejects(() => service.invite(COURIER, ORDER_ID), /db down/);
        shouldFail = false;
        await assert.doesNotReject(() => service.invite(COURIER, ORDER_ID));
    });
});

describe("accept / reject / end", () => {
    let ctx;
    let callId;

    beforeEach(async () => {
        ctx = setup();
        ({ callId } = await ctx.service.invite(COURIER, ORDER_ID));
    });

    test("вызываемый принимает: звонящий получает call:accepted, статус сохраняется", async () => {
        await ctx.service.accept(CLIENT, callId);

        assert.deepEqual(ctx.eventsTo(COURIER, SOCKET_EVENTS.ACCEPTED), [{ callId }]);
        assert.equal(ctx.updates.at(-1).fields.status, CALL_STATUSES.ACCEPTED);
    });

    test("звонящий не может принять собственный звонок", async () => {
        await assertCallError(() => ctx.service.accept(COURIER, callId), CALL_ERROR_CODES.FORBIDDEN);
    });

    test("повторный accept — INVALID_STATE", async () => {
        await ctx.service.accept(CLIENT, callId);
        await assertCallError(() => ctx.service.accept(CLIENT, callId), CALL_ERROR_CODES.INVALID_STATE);
    });

    test("посторонний не видит чужой звонок", async () => {
        await assertCallError(() => ctx.service.accept(STRANGER, callId), CALL_ERROR_CODES.CALL_NOT_FOUND);
    });

    test("reject завершает звонок со статусом rejected для обеих сторон", async () => {
        await ctx.service.reject(CLIENT, callId);

        const [ended] = ctx.eventsTo(COURIER, SOCKET_EVENTS.ENDED);
        assert.equal(ended.status, CALL_STATUSES.REJECTED);
        assert.equal(ctx.eventsTo(CLIENT, SOCKET_EVENTS.ENDED).length, 1);
    });

    test("end звонящим до ответа — cancelled", async () => {
        await ctx.service.end(COURIER, callId);
        const [ended] = ctx.eventsTo(CLIENT, SOCKET_EVENTS.ENDED);
        assert.equal(ended.status, CALL_STATUSES.CANCELLED);
        assert.equal(ended.reason, END_REASONS.CANCELLED);
    });

    test("end вызываемым до ответа — rejected", async () => {
        await ctx.service.end(CLIENT, callId);
        const [ended] = ctx.eventsTo(COURIER, SOCKET_EVENTS.ENDED);
        assert.equal(ended.status, CALL_STATUSES.REJECTED);
    });

    test("end в разговоре сохраняет длительность", async () => {
        await ctx.service.accept(CLIENT, callId);
        ctx.clock.advance(65_000);

        await ctx.service.end(CLIENT, callId);

        const last = ctx.updates.at(-1).fields;
        assert.equal(last.status, CALL_STATUSES.ENDED);
        assert.equal(last.durationSec, 65);
        assert.equal(last.endedBy, "client");
    });

    test("после завершения участники снова свободны", async () => {
        await ctx.service.end(COURIER, callId);
        await assert.doesNotReject(() => ctx.service.invite(CLIENT, ORDER_ID));
    });

    test("действие с завершённым звонком — CALL_NOT_FOUND", async () => {
        await ctx.service.end(COURIER, callId);
        await assertCallError(() => ctx.service.end(COURIER, callId), CALL_ERROR_CODES.CALL_NOT_FOUND);
    });
});

describe("таймауты", () => {
    test("без ответа звонок становится missed", async () => {
        const { service, clock, eventsTo, updates } = setup();
        const { callId } = await service.invite(COURIER, ORDER_ID);

        clock.advance(RING_TIMEOUT_MS);

        const [ended] = eventsTo(COURIER, SOCKET_EVENTS.ENDED);
        assert.equal(ended.status, CALL_STATUSES.MISSED);
        assert.equal(updates.at(-1).callId, callId);
        await assertCallError(() => service.accept(CLIENT, callId), CALL_ERROR_CODES.CALL_NOT_FOUND);
    });

    test("принятый звонок не завершается по таймауту дозвона", async () => {
        const { service, clock, eventsTo } = setup();
        const { callId } = await service.invite(COURIER, ORDER_ID);
        await service.accept(CLIENT, callId);

        clock.advance(RING_TIMEOUT_MS * 5);

        assert.equal(eventsTo(COURIER, SOCKET_EVENTS.ENDED).length, 0);
    });

    test("потеря связи дольше grace-периода — failed / connection_lost", async () => {
        const { service, clock, eventsTo } = setup();
        const { callId } = await service.invite(COURIER, ORDER_ID);
        await service.accept(CLIENT, callId);

        service.onParticipantOffline(CLIENT);
        clock.advance(GRACE_MS);

        const [ended] = eventsTo(COURIER, SOCKET_EVENTS.ENDED);
        assert.equal(ended.status, CALL_STATUSES.FAILED);
        assert.equal(ended.reason, END_REASONS.CONNECTION_LOST);
    });

    test("переподключение в grace-период сохраняет звонок и возвращает его состояние", async () => {
        const { service, clock, eventsTo } = setup();
        const { callId } = await service.invite(COURIER, ORDER_ID);
        await service.accept(CLIENT, callId);

        service.onParticipantOffline(CLIENT);
        clock.advance(GRACE_MS / 2);
        const resumed = service.onParticipantOnline(CLIENT);
        clock.advance(GRACE_MS * 2);

        assert.deepEqual(resumed, { callId, orderId: ORDER_ID, status: CALL_STATUSES.ACCEPTED, role: "callee" });
        assert.equal(eventsTo(COURIER, SOCKET_EVENTS.ENDED).length, 0);
    });

    test("onParticipantOnline без звонка возвращает null", () => {
        const { service } = setup();
        assert.equal(service.onParticipantOnline(CLIENT), null);
    });
});

describe("relaySignal", () => {
    test("пересылает SDP второй стороне только в принятом звонке", async () => {
        const { service, eventsTo } = setup();
        const { callId } = await service.invite(COURIER, ORDER_ID);

        assert.throws(
            () => service.relaySignal(COURIER, callId, "offer", { sdp: "x" }),
            (error) => error.code === CALL_ERROR_CODES.INVALID_STATE
        );

        await service.accept(CLIENT, callId);
        service.relaySignal(COURIER, callId, "offer", { type: "offer", sdp: "v=0" });

        assert.deepEqual(eventsTo(CLIENT, SOCKET_EVENTS.SIGNAL), [
            { callId, kind: "offer", payload: { type: "offer", sdp: "v=0" } },
        ]);
    });

    test("посторонний не может слать сигналы в чужой звонок", async () => {
        const { service } = setup();
        const { callId } = await service.invite(COURIER, ORDER_ID);
        await service.accept(CLIENT, callId);

        assert.throws(
            () => service.relaySignal(STRANGER, callId, "ice", {}),
            (error) => error.code === CALL_ERROR_CODES.CALL_NOT_FOUND
        );
    });
});

describe("устойчивость", () => {
    test("ошибка записи истории не обрывает звонок", async () => {
        const { service, eventsTo } = setup({
            repoOverrides: {
                updateCall: async () => {
                    throw new Error("db down");
                },
            },
        });
        const { callId } = await service.invite(COURIER, ORDER_ID);

        await assert.doesNotReject(() => service.accept(CLIENT, callId));
        assert.equal(eventsTo(COURIER, SOCKET_EVENTS.ACCEPTED).length, 1);
    });
});

describe("пуши о звонке", () => {
    const createPushSpy = ({ failIncoming = false } = {}) => {
        const incoming = [];
        const ended = [];
        return {
            incoming,
            ended,
            notifier: {
                notifyIncomingCall: async (callee, call) => {
                    incoming.push({ callee, call });
                    if (failIncoming) throw new Error("apns down");
                },
                notifyCallEnded: async (callee, call) => {
                    ended.push({ callee, call });
                },
            },
        };
    };
    const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

    test("invite отправляет пуш вызываемому с именем звонящего", async () => {
        const push = createPushSpy();
        const { service } = setup({ pushNotifier: push.notifier });

        const { callId } = await service.invite(COURIER, ORDER_ID);

        assert.equal(push.incoming.length, 1);
        assert.deepEqual(push.incoming[0].callee, { ...CLIENT, deviceId: null });
        assert.equal(push.incoming[0].call.callId, callId);
        assert.deepEqual(push.incoming[0].call.caller, { type: "courier", name: "Ерлан" });
        assert.equal(push.incoming[0].call.ringTimeoutMs, RING_TIMEOUT_MS);
    });

    test("ошибка отправки пуша не ломает звонок", async () => {
        const push = createPushSpy({ failIncoming: true });
        const { service, eventsTo } = setup({ pushNotifier: push.notifier });

        const { callId } = await service.invite(COURIER, ORDER_ID);
        await flushPromises();

        assert.equal(eventsTo(CLIENT, SOCKET_EVENTS.INCOMING).length, 1);
        await assert.doesNotReject(() => service.accept(CLIENT, callId));
    });

    test("неотвеченный звонок (отмена, пропущенный) шлёт пуш отмены вызываемому", async () => {
        const push = createPushSpy();
        const { service, clock } = setup({ pushNotifier: push.notifier });

        const first = await service.invite(COURIER, ORDER_ID);
        await service.end(COURIER, first.callId);
        const second = await service.invite(COURIER, ORDER_ID);
        clock.advance(RING_TIMEOUT_MS);

        assert.deepEqual(
            push.ended.map((entry) => entry.call.callId),
            [first.callId, second.callId]
        );
        assert.ok(push.ended.every((entry) => entry.callee.id === CLIENT.id));
    });

    test("завершение принятого звонка пуш отмены не шлёт", async () => {
        const push = createPushSpy();
        const { service } = setup({ pushNotifier: push.notifier });

        const { callId } = await service.invite(COURIER, ORDER_ID);
        await service.accept(CLIENT, callId);
        await service.end(CLIENT, callId);

        assert.equal(push.ended.length, 0);
    });
});

describe("звонок на устройство, с которого создан заказ", () => {
    const DEVICE_A = "device-AAAA";
    const DEVICE_B = "device-BBBB";
    const CLIENT_A = { ...CLIENT, deviceId: DEVICE_A };
    const CLIENT_B = { ...CLIENT, deviceId: DEVICE_B };
    const orderFromA = makeOrder({ clientDeviceId: DEVICE_A });

    const devicesOf = (emitted, event) => emitted.filter((e) => e.event === event).map((e) => e.to.deviceId ?? null);

    test("входящий и пуш уходят только на устройство заказа", async () => {
        const pushed = [];
        const { service, emitted } = setup({
            order: orderFromA,
            isKnownDevice: async () => true,
            pushNotifier: {
                notifyIncomingCall: async (callee) => pushed.push(callee),
                notifyCallEnded: async () => {},
            },
        });

        await service.invite(COURIER, ORDER_ID);

        assert.deepEqual(devicesOf(emitted, SOCKET_EVENTS.INCOMING), [DEVICE_A]);
        assert.deepEqual(pushed, [CLIENT_A]);
    });

    test("устройство заказа больше не зарегистрировано — звонок на весь аккаунт", async () => {
        const { service, emitted } = setup({ order: orderFromA, isKnownDevice: async () => false });

        await service.invite(COURIER, ORDER_ID);

        assert.deepEqual(devicesOf(emitted, SOCKET_EVENTS.INCOMING), [null]);
    });

    test("другое устройство аккаунта не может принять или отклонить звонок", async () => {
        const { service } = setup({ order: orderFromA });
        const { callId } = await service.invite(COURIER, ORDER_ID);

        await assertCallError(() => service.accept(CLIENT_B, callId), CALL_ERROR_CODES.CALL_NOT_FOUND);
        await assertCallError(() => service.reject(CLIENT_B, callId), CALL_ERROR_CODES.CALL_NOT_FOUND);
        await service.accept(CLIENT_A, callId);
    });

    test("завершение звонка приходит на устройство заказа", async () => {
        const { service, emitted } = setup({ order: orderFromA });
        const { callId } = await service.invite(COURIER, ORDER_ID);

        await service.end(COURIER, callId);

        const endedTo = emitted.filter((e) => e.event === SOCKET_EVENTS.ENDED && e.to.type === "client");
        assert.deepEqual(endedTo.map((e) => e.to.deviceId), [DEVICE_A]);
    });

    test("восстановление звонка — только на устройстве заказа", async () => {
        const { service } = setup({ order: orderFromA });
        const { callId } = await service.invite(COURIER, ORDER_ID);
        await service.accept(CLIENT_A, callId);

        assert.equal(service.onParticipantOnline(CLIENT_B), null);
        assert.equal(service.onParticipantOnline(CLIENT_A)?.callId, callId);
    });

    test("отключение другого устройства не обрывает звонок", async () => {
        const { service, clock, eventsTo } = setup({ order: orderFromA });
        const { callId } = await service.invite(COURIER, ORDER_ID);
        await service.accept(CLIENT_A, callId);

        service.onParticipantOffline(CLIENT_B);
        clock.advance(GRACE_MS * 2);

        assert.equal(eventsTo(COURIER, SOCKET_EVENTS.ENDED).length, 0);
    });

    test("сторона ещё на связи другим сокетом — grace-период не запускается", async () => {
        const { service, clock, eventsTo } = setup({ order: orderFromA, isConnected: () => true });
        const { callId } = await service.invite(COURIER, ORDER_ID);
        await service.accept(CLIENT_A, callId);

        service.onParticipantOffline(CLIENT_A);
        clock.advance(GRACE_MS * 2);

        assert.equal(eventsTo(COURIER, SOCKET_EVENTS.ENDED).length, 0);
    });

    test("клиент звонит с устройства — ответ курьера приходит на это устройство", async () => {
        const { service, emitted } = setup();
        const { callId } = await service.invite(CLIENT_A, ORDER_ID);

        await service.accept(COURIER, callId);

        assert.deepEqual(devicesOf(emitted, SOCKET_EVENTS.ACCEPTED), [DEVICE_A]);
    });
});
