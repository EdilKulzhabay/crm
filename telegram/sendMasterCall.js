import axios from "axios";

/**
 * Уведомление в Telegram о заявке «Вызвать мастера».
 * Нужны переменные окружения: TELEGRAM_BOT_TOKEN, TELEGRAM_MASTER_CALL_CHAT_ID (id группы или супергруппы).
 */
export async function sendMasterCallTelegram({ fullName, phone, mail }) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_MASTER_CALL_CHAT_ID;

    if (!token || !chatId) {
        console.error(
            "[telegram] Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_MASTER_CALL_CHAT_ID"
        );
        return { ok: false, error: "TELEGRAM_NOT_CONFIGURED" };
    }

    const lines = [
        "🔧 Заявка: вызов мастера (ремонт техники)",
        "",
        `Имя: ${fullName || "—"}`,
        `Телефон: ${phone || "—"}`,
    ];
    if (mail) {
        lines.push(`Email: ${mail}`);
    }
    const text = lines.join("\n");

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const { data } = await axios.post(url, {
            chat_id: chatId,
            text,
        });
        if (data.ok) {
            return { ok: true };
        }
        return {
            ok: false,
            error: data.description || "telegram_api_error",
        };
    } catch (err) {
        const msg =
            err.response?.data?.description || err.message || "unknown_error";
        console.error("[telegram] sendMasterCallTelegram:", msg);
        return { ok: false, error: msg };
    }
}
