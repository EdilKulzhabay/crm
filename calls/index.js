import express from "express";
import { CALLS_NAMESPACE } from "./callConstants.js";
import { checkCallAuth, resolveCallParticipant } from "./callAuth.js";
import { CallError, toPublicError } from "./callErrors.js";
import { participantKey } from "./callPolicy.js";
import { mongoCallRepository } from "./callRepository.js";
import { createCallService } from "./callService.js";
import { registerCallSocket } from "./callSocket.js";
import { buildIceServers, readTurnConfig } from "./iceServers.js";
import { createCallPushNotifierFromEnv, mongoPushTokenRepository } from "./push/index.js";
import { parsePushTokenInput, parseTokenOnly } from "./push/pushTokenInput.js";

const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_ERROR = 500;

/** Единая обработка ошибок REST-эндпоинтов звонков */
const handleRoute = (handler) => async (req, res) => {
    try {
        await handler(req, res);
    } catch (error) {
        if (!(error instanceof CallError)) console.error(`[calls] ${req.method} ${req.originalUrl}:`, error);
        const status = error instanceof CallError ? HTTP_BAD_REQUEST : HTTP_INTERNAL_ERROR;
        res.status(status).json({ success: false, ...toPublicError(error) });
    }
};

const createCallRouter = (turnConfig, tokenRepository) => {
    const router = express.Router();

    router.get("/ice-servers", checkCallAuth, (req, res) => {
        if (!turnConfig) {
            return res.status(503).json({ success: false, message: "Звонки временно недоступны" });
        }
        res.set("Cache-Control", "no-store");
        res.json({ success: true, ...buildIceServers(req.callParticipant, turnConfig) });
    });

    // Регистрация VoIP-токена (iOS) / FCM-токена (Android) для пушей о входящих звонках
    router.post(
        "/push-token",
        checkCallAuth,
        handleRoute(async (req, res) => {
            const input = parsePushTokenInput(req.body);
            await tokenRepository.saveToken({ participant: req.callParticipant, ...input });
            res.json({ success: true });
        })
    );

    // Выход из аккаунта: устройство больше не должно получать звонки
    router.delete(
        "/push-token",
        checkCallAuth,
        handleRoute(async (req, res) => {
            await tokenRepository.removeToken(req.callParticipant, parseTokenOnly(req.body));
            res.json({ success: true });
        })
    );

    return router;
};

/**
 * Подключает VoIP-звонки клиент ↔ курьер.
 * Отдельный namespace /calls с обязательной JWT-авторизацией, чтобы не ломать
 * существующие подписки CRM в namespace по умолчанию.
 *
 * @param {import("socket.io").Server} io
 */
export const initCalls = (io) => {
    const nsp = io.of(CALLS_NAMESPACE);
    const service = createCallService({
        repository: mongoCallRepository,
        emit: (participant, event, payload) => nsp.to(participantKey(participant)).emit(event, payload),
        pushNotifier: createCallPushNotifierFromEnv(),
    });

    registerCallSocket(nsp, service, resolveCallParticipant);

    service
        .recoverAfterRestart()
        .catch((error) => console.error("[calls] не удалось закрыть оборванные звонки после рестарта:", error));

    const turnConfig = readTurnConfig();
    if (!turnConfig) {
        console.warn("[calls] TURN_SECRET / TURN_URLS не заданы — /calls/ice-servers будет отвечать 503");
    }

    return { service, router: createCallRouter(turnConfig, mongoPushTokenRepository) };
};
