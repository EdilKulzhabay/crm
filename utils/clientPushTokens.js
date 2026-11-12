/**
 * FCM-токены клиентского приложения для пуша по заказу.
 *
 * `order.notificationToken` — снимок токена на момент создания заказа. После переустановки
 * приложения, обновления токена Firebase или для заказа из CRM он пустой или устаревший,
 * поэтому всегда добавляем и актуальные токены клиента (`notificationPushTokens` и
 * устаревшее одиночное поле `notificationPushToken`). Невалидные токены отсеиваются
 * при отправке (pushNotificationClient*).
 *
 * @param {{ notificationToken?: string } | null | undefined} order
 * @param {{ notificationPushToken?: string, notificationPushTokens?: string[] } | null | undefined} client
 * @returns {string[]} уникальные непустые токены
 */
export function collectOrderPushTokens(order, client) {
    const candidates = [
        order?.notificationToken,
        ...(Array.isArray(client?.notificationPushTokens) ? client.notificationPushTokens : []),
        client?.notificationPushToken,
    ];
    const tokens = candidates
        .filter((token) => typeof token === "string")
        .map((token) => token.trim())
        .filter(Boolean);
    return [...new Set(tokens)];
}
