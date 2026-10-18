import { Expo } from "expo-server-sdk";
import Partner from "../Models/Partner.js";

/**
 * Push-уведомления партнёрам через Expo Push Service (как у курьеров).
 * iOS — Expo отправляет через APNs (ключ хранится в EAS), Android — через FCM V1
 * (ключ сервисного аккаунта Firebase-проекта tibetskayapartner загружается в EAS credentials).
 * Отдельно от pushNotification.js: тот при импорте читает ключ Firebase курьеров.
 */
export const MAX_PUSH_TOKENS = 5;

const expo = new Expo({ useFcmV1: true });

const defaultDeps = {
    findTokens: async (partnerId) =>
        (await Partner.findById(partnerId).select("expoPushTokens").lean())?.expoPushTokens ?? [],
    removeTokens: (partnerId, tokens) =>
        Partner.updateOne({ _id: partnerId }, { $pull: { expoPushTokens: { $in: tokens } } }),
    send: (messages) => expo.sendPushNotificationsAsync(messages),
    logger: console,
};

/**
 * Отправляет уведомление на все устройства партнёра. Никогда не бросает исключение:
 * уведомление — второстепенный эффект, оно не должно ломать регистрацию клиента или вывод.
 * Токены, на которые Expo ответил DeviceNotRegistered, удаляются.
 */
export async function sendPartnerPush(partnerId, { title, body, data = {} }, deps = defaultDeps) {
    try {
        const tokens = (await deps.findTokens(partnerId)).filter((token) => Expo.isExpoPushToken(token));
        if (tokens.length === 0) return { sent: 0 };

        const messages = tokens.map((to) => ({ to, title, body, data, sound: "default", channelId: "default" }));
        const tickets = await deps.send(messages);

        const stale = tickets
            .map((ticket, index) => (ticket.details?.error === "DeviceNotRegistered" ? tokens[index] : null))
            .filter(Boolean);
        if (stale.length) await deps.removeTokens(partnerId, stale);

        return { sent: tickets.filter((ticket) => ticket.status === "ok").length };
    } catch (error) {
        deps.logger.error("[Partner push] не удалось отправить уведомление:", error?.message || error);
        return { sent: 0 };
    }
}
