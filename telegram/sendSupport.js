import axios from "axios";

/**
 * Уведомление в Telegram о новом сообщении в техподдержку из приложения.
 * Переменные окружения: TELEGRAM_BOT_TOKEN, TELEGRAM_SUPPORT_CHAT_ID (id группы или супергруппы).
 */
export async function sendSupportTelegram({ fullName, mail, text }) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID;

    if (!token || !chatId) {
        console.error(
            "[telegram] Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_SUPPORT_CHAT_ID для уведомлений о чате поддержки"
        );
        return { ok: false, error: "TELEGRAM_NOT_CONFIGURED" };
    }

    const body = String(text || "").trim() || "(пустое сообщение)";
    const msg = [
        "📩 Новое сообщение из приложения (поддержка)",
        "",
        `Клиент: ${fullName || "—"}`,
        `Email: ${mail || "—"}`,
        "",
        body,
    ].join("\n");

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const { data } = await axios.post(url, {
            chat_id: chatId,
            text: msg,
        });
        if (data.ok) {
            return { ok: true };
        }
        return {
            ok: false,
            error: data.description || "telegram_api_error",
        };
    } catch (err) {
        const errMsg =
            err.response?.data?.description || err.message || "unknown_error";
        console.error("[telegram] sendSupportTelegram:", errMsg);
        return { ok: false, error: errMsg };
    }
}
