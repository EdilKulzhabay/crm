import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { createCallService } from "../callService.js";
import { createParticipantChannel, registerCallSocket } from "../callSocket.js";
import { CALLS_NAMESPACE, SOCKET_EVENTS } from "../callConstants.js";

const ORDER_ID = "a".repeat(24);
const TOKENS = {
    client: { type: "client", id: "c".repeat(24) },
    courier: { type: "courier", id: "d".repeat(24) },
};

const order = {
    id: ORDER_ID,
    status: "onTheWay",
    clientId: TOKENS.client.id,
    courierId: TOKENS.courier.id,
    deliveredTime: null,
    clientName: "Клиент",
    courierName: "Курьер",
};

const waitFor = (socket, event) => new Promise((resolve) => socket.once(event, resolve));
const request = (socket, event, data) => socket.emitWithAck(event, data);
const NO_EVENT_WAIT_MS = 150;
/** true, если событие пришло за NO_EVENT_WAIT_MS */
const receives = (socket, event) =>
    new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), NO_EVENT_WAIT_MS);
        socket.once(event, () => {
            clearTimeout(timer);
            resolve(true);
        });
    });

/** Сервер звонков на случайном порту, как в initCalls, но с заказом из теста */
const createTestServer = (callOrder) => {
    let httpServer;
    let url;
    const sockets = [];

    const start = async () => {
        httpServer = http.createServer();
        const io = new Server(httpServer);
        const nsp = io.of(CALLS_NAMESPACE);
        const channel = createParticipantChannel(nsp);
        let seq = 0;
        const service = createCallService({
            repository: {
                findOrderForCall: async (id) => (id === ORDER_ID ? callOrder : null),
                newCallId: () => String(++seq).padStart(24, "0"),
                createCall: async () => {},
                updateCall: async () => {},
                failStaleActiveCalls: async () => 0,
            },
            emit: channel.emit,
            isConnected: channel.isConnected,
            isKnownDevice: async (participant) => channel.isConnected(participant),
            logger: { error: () => {}, info: () => {} },
        });
        registerCallSocket(nsp, service, async (token) => TOKENS[token] ?? null);

        await new Promise((resolve) => httpServer.listen(0, resolve));
        url = `http://localhost:${httpServer.address().port}`;
    };

    const open = async (token, deviceId) => {
        const socket = connect(`${url}${CALLS_NAMESPACE}`, {
            auth: { token, deviceId },
            transports: ["websocket"],
            forceNew: true,
        });
        sockets.push(socket);
        await new Promise((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
        });
        return socket;
    };

    const stop = async () => {
        sockets.forEach((s) => s.disconnect());
        await new Promise((resolve) => httpServer.close(resolve));
    };

    return { start, open, stop };
};

describe("сокет /calls: полный сценарий звонка", () => {
    const server = createTestServer(order);
    const open = (token) => server.open(token);

    before(server.start);
    after(server.stop);

    test("без валидного токена подключение отклоняется", async () => {
        await assert.rejects(() => open("bad-token"), /UNAUTHORIZED/);
    });

    test("invite → incoming → accept → offer/answer → end", async () => {
        const courier = await open("courier");
        const client = await open("client");

        const incomingP = waitFor(client, SOCKET_EVENTS.INCOMING);
        const invite = await request(courier, SOCKET_EVENTS.INVITE, { orderId: ORDER_ID });
        assert.equal(invite.ok, true);
        const incoming = await incomingP;
        assert.equal(incoming.callId, invite.data.callId);

        const acceptedP = waitFor(courier, SOCKET_EVENTS.ACCEPTED);
        assert.equal((await request(client, SOCKET_EVENTS.ACCEPT, { callId: incoming.callId })).ok, true);
        await acceptedP;

        const offerP = waitFor(client, SOCKET_EVENTS.SIGNAL);
        await request(courier, SOCKET_EVENTS.SIGNAL, {
            callId: incoming.callId,
            kind: "offer",
            payload: { type: "offer", sdp: "v=0" },
        });
        assert.equal((await offerP).kind, "offer");

        const endedP = waitFor(courier, SOCKET_EVENTS.ENDED);
        assert.equal((await request(client, SOCKET_EVENTS.END, { callId: incoming.callId })).ok, true);
        assert.equal((await endedP).status, "ended");

        courier.disconnect();
        client.disconnect();
    });

    test("лимит invite не сбрасывается переподключением", async () => {
        // Каждый invite — с нового сокета; 6-й должен упереться в лимит 5/мин
        let last;
        for (let i = 0; i < 6; i += 1) {
            const client = await open("client");
            last = await request(client, SOCKET_EVENTS.INVITE, { orderId: "f".repeat(24) });
            client.disconnect();
        }
        assert.equal(last.error.code, "RATE_LIMITED");
    });

    test("ошибки валидации возвращаются в ack, а не роняют сокет", async () => {
        const courier = await open("courier");

        const response = await request(courier, SOCKET_EVENTS.INVITE, { orderId: { $gt: "" } });

        assert.deepEqual(response, { ok: false, error: { code: "VALIDATION", message: "Некорректный orderId" } });
        assert.equal(courier.connected, true);
        courier.disconnect();
    });
});

describe("сокет /calls: звонок на устройство, с которого создан заказ", () => {
    const DEVICE_A = "device-AAAA";
    const DEVICE_B = "device-BBBB";
    const server = createTestServer({ ...order, clientDeviceId: DEVICE_A });

    before(server.start);
    after(server.stop);

    test("входящий получает только устройство заказа, принять с другого нельзя", async () => {
        const courier = await server.open("courier");
        const clientA = await server.open("client", DEVICE_A);
        const clientB = await server.open("client", DEVICE_B);

        const incomingOnA = waitFor(clientA, SOCKET_EVENTS.INCOMING);
        const incomingOnB = receives(clientB, SOCKET_EVENTS.INCOMING);
        const invite = await request(courier, SOCKET_EVENTS.INVITE, { orderId: ORDER_ID });
        const { callId } = invite.data;

        assert.equal((await incomingOnA).callId, callId);
        assert.equal(await incomingOnB, false);

        const acceptFromB = await request(clientB, SOCKET_EVENTS.ACCEPT, { callId });
        assert.equal(acceptFromB.error.code, "CALL_NOT_FOUND");

        assert.equal((await request(clientA, SOCKET_EVENTS.ACCEPT, { callId })).ok, true);
        assert.equal((await request(courier, SOCKET_EVENTS.END, { callId })).ok, true);
    });
});

describe("сокет /calls: устройство заказа больше не на связи", () => {
    const DEVICE_B = "device-BBBB";
    const server = createTestServer({ ...order, clientDeviceId: "device-AAAA" });

    before(server.start);
    after(server.stop);

    test("устройство заказа не в сети и без пушей — звонок на все устройства", async () => {
        const courier = await server.open("courier");
        const clientB = await server.open("client", DEVICE_B);

        const incomingOnB = waitFor(clientB, SOCKET_EVENTS.INCOMING);
        const invite = await request(courier, SOCKET_EVENTS.INVITE, { orderId: ORDER_ID });

        assert.equal((await incomingOnB).callId, invite.data.callId);
        assert.equal((await request(courier, SOCKET_EVENTS.END, { callId: invite.data.callId })).ok, true);
    });
});
