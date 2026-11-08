import axios from "axios";

/**
 * Уведомление о погашенном купоне на мойку в Telegram-группу.
 * Env: TELEGRAM_BOT_TOKEN_SUPPORT (тот же бот, что для поддержки и выводов),
 * TELEGRAM_CAR_WASH_CHAT_ID — id группы, куда приходят погашения.
 */
const ALMATY_TIME_ZONE = "Asia/Almaty";

const formatAlmatyTime = (date) =>
    new Date(date).toLocaleString("ru-RU", { timeZone: ALMATY_TIME_ZONE, dateStyle: "short", timeStyle: "short" });

export function buildCarWashRedemptionMessage({ coupon, client, carWash, carWashUser }) {
    const clientName = client?.fullName || client?.userName || "—";
    return [
        `Купон на мойку −${coupon.discountPercent}% погашен`,
        "",
        `Код: ${coupon.code}`,
        `Время: ${formatAlmatyTime(coupon.usedAt)}`,
        "",
        `Мойка: ${carWash.name}`,
        `Адрес: ${[carWash.city, carWash.address].filter(Boolean).join(", ") || "—"}`,
        `Телефон мойки: ${carWash.phone || "—"}`,
        `Сотрудник: ${carWashUser.fullName || "—"} (${carWashUser.phone || "—"})`,
        "",
        `Клиент: ${clientName}`,
        `Телефон клиента: ${client?.phone || "—"}`,
        `Почта клиента: ${client?.mail || "—"}`,
    ].join("\n");
}

export async function sendCarWashRedemptionTelegram(params) {
    const token = process.env.TELEGRAM_BOT_TOKEN_SUPPORT;
    const chatId = process.env.TELEGRAM_CAR_WASH_CHAT_ID;

    if (!token || !chatId) {
        return { ok: false, error: "TELEGRAM_NOT_CONFIGURED: задайте TELEGRAM_BOT_TOKEN_SUPPORT и TELEGRAM_CAR_WASH_CHAT_ID" };
    }

    try {
        const { data } = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: buildCarWashRedemptionMessage(params),
        });
        return data.ok ? { ok: true } : { ok: false, error: data.description || "telegram_api_error" };
    } catch (err) {
        return { ok: false, error: err.response?.data?.description || err.message || "unknown_error" };
    }
}
