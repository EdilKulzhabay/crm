import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { createCallService } from "../callService.js";
import { registerCallSocket } from "../callSocket.js";
import { participantKey } from "../callPolicy.js";
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

describe("сокет /calls: полный сценарий звонка", () => {
    let httpServer;
    let url;
    const sockets = [];

    const open = async (token) => {
        const socket = connect(`${url}${CALLS_NAMESPACE}`, { auth: { token }, transports: ["websocket"], forceNew: true });
        sockets.push(socket);
        await new Promise((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
        });
        return socket;
    };

    before(async () => {
        httpServer = http.createServer();
        const io = new Server(httpServer);
        const nsp = io.of(CALLS_NAMESPACE);
        let seq = 0;
        const service = createCallService({
            repository: {
                findOrderForCall: async (id) => (id === ORDER_ID ? order : null),
                newCallId: () => String(++seq).padStart(24, "0"),
                createCall: async () => {},
                updateCall: async () => {},
                failStaleActiveCalls: async () => 0,
            },
            emit: (p, event, payload) => nsp.to(participantKey(p)).emit(event, payload),
            logger: { error: () => {}, info: () => {} },
        });
        registerCallSocket(nsp, service, async (token) => TOKENS[token] ?? null);

        await new Promise((resolve) => httpServer.listen(0, resolve));
        url = `http://localhost:${httpServer.address().port}`;
    });

    after(async () => {
        sockets.forEach((s) => s.disconnect());
        await new Promise((resolve) => httpServer.close(resolve));
    });

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
