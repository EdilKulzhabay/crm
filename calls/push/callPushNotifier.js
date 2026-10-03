import { PUSH_PLATFORMS } from "../../Models/CallPushToken.js";

/** @typedef {import("../callPolicy.js").Participant} Participant */
/** @typedef {{ send: (message: object) => Promise<{ ok: boolean, isInvalidToken?: boolean, reason?: string }> }} Sender */

export const PUSH_TYPES = Object.freeze({
    INCOMING_CALL: "incoming_call",
    CALL_ENDED: "call_ended",
});

/**
 * CallKit требует UUID, а у звонка ObjectId (24 hex). Детерминированное преобразование,
 * чтобы нативный код, JS и сервер получали один и тот же UUID без обмена.
 * @param {string} callId
 */
export const callIdToUuid = (callId) => {
    const hex = `${callId.toLowerCase()}00000000`;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

/**
 * Пуши о звонках на все устройства вызываемого.
 * iOS — только VoIP-пуш входящего: каждый VoIP-пуш iOS обязана показать в CallKit,
 * поэтому «звонок отменён» на iOS доставляется сокетом или локальным таймаутом.
 * Android — data-сообщения и на входящий, и на отмену (чтобы убрать уведомление).
 *
 * @param {{
 *   tokenRepository: typeof import("./pushTokenRepository.js").mongoPushTokenRepository,
 *   apns: Sender | null,
 *   apnsTopics: { client: string, courier: string } | null,
 *   fcmByType: { client: Sender | null, courier: Sender | null },
 *   now?: () => number,
 *   logger?: Pick<Console, "error" | "warn">,
 * }} deps
 */
export const createCallPushNotifier = ({ tokenRepository, apns, apnsTopics, fcmByType, now = Date.now, logger = console }) => {
    const sendToIos = (participant, device, payload) => {
        if (!apns || !apnsTopics) return null;
        return apns.send({
            token: device.token,
            environment: device.apnsEnvironment || "production",
            topic: apnsTopics[participant.type],
            payload,
        });
    };

    const sendToAndroid = (participant, device, data, ttlMs) => {
        const fcm = fcmByType[participant.type];
        if (!fcm) return null;
        return fcm.send({ token: device.token, data, ttlMs });
    };

    /** Отправляет на устройства, удаляет протухшие токены, логирует остальные ошибки */
    const deliver = async (participant, devices, sendOne) => {
        const attempts = devices
            .map((device) => ({ device, pending: sendOne(device) }))
            .filter(({ pending }) => pending !== null);
        const results = await Promise.all(attempts.map(({ pending }) => pending));

        const invalidTokens = [];
        results.forEach((result, index) => {
            if (result.ok) return;
            const { device } = attempts[index];
            if (result.isInvalidToken) {
                invalidTokens.push(device.token);
            } else {
                logger.error(
                    `[calls] пуш ${device.platform} для ${participant.type}:${participant.id} не отправлен: ${result.reason}`
                );
            }
        });
        await tokenRepository.deleteTokens(invalidTokens);
        if (invalidTokens.length > 0 && invalidTokens.length === devices.length) {
            // Входящие до следующего открытия приложения (перерегистрации токена) не дойдут
            logger.warn(`[calls] у ${participant.type}:${participant.id} не осталось рабочих push-токенов`);
        }
    };

    /**
     * @param {Participant} callee
     * @param {{ callId: string, orderId: string, caller: { type: string, name: string }, ringTimeoutMs: number }} call
     */
    const notifyIncomingCall = async (callee, { callId, orderId, caller, ringTimeoutMs }) => {
        const devices = await tokenRepository.findTokens(callee);
        const expiresAt = now() + ringTimeoutMs;
        const fields = {
            type: PUSH_TYPES.INCOMING_CALL,
            callId,
            callUuid: callIdToUuid(callId),
            orderId,
            callerType: caller.type,
            callerName: caller.name,
        };

        await deliver(callee, devices, (device) =>
            device.platform === PUSH_PLATFORMS.IOS
                ? sendToIos(callee, device, { aps: {}, ...fields, expiresAt })
                : sendToAndroid(callee, device, { ...fields, expiresAt: String(expiresAt) }, ringTimeoutMs)
        );
    };

    /**
     * Звонок завершился до ответа — убрать уведомление на Android.
     * @param {Participant} callee
     * @param {{ callId: string, ttlMs: number }} call
     */
    const notifyCallEnded = async (callee, { callId, ttlMs }) => {
        const devices = (await tokenRepository.findTokens(callee)).filter(
            (device) => device.platform === PUSH_PLATFORMS.ANDROID
        );
        await deliver(callee, devices, (device) =>
            sendToAndroid(callee, device, { type: PUSH_TYPES.CALL_ENDED, callId, callUuid: callIdToUuid(callId) }, ttlMs)
        );
    };

    return Object.freeze({ notifyIncomingCall, notifyCallEnded });
};

/** Заглушка, когда пуши не настроены (и для тестов сервиса) */
export const noopCallPushNotifier = Object.freeze({
    notifyIncomingCall: async () => {},
    notifyCallEnded: async () => {},
});
