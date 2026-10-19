import axios from "axios";

/**
 * Запрос партнёра на вывод средств — в ту же Telegram-группу, что и запросы курьеров.
 * Env: TELEGRAM_BOT_TOKEN_SUPPORT; TELEGRAM_PARTNER_WITHDRAW_CHAT_ID (необязательно,
 * отдельная группа для партнёров), иначе TELEGRAM_WITHDRAW_CHAT_ID.
 */
export function buildPartnerWithdrawMessage({ partner, amount, fee, payoutAmount, transactionId, balanceAfter }) {
    const { cardData = {} } = partner;
    const feeLines = fee != null ? [`Комиссия: ${fee} ₸`, `К переводу: ${payoutAmount} ₸`] : [];
    return [
        `Запрос на вывод средств — партнёр ${partner.userName}`,
        "",
        `Партнёр ${partner.userName} хочет вывести деньги на карту.\n\nСумма: ${amount} ₸`,
        ...feeLines,
        `Сумма уже списана с баланса партнёра. Остаток: ${balanceAfter} ₸`,
        "",
        `Телефон партнёра: ${partner.phone || "—"}`,
        `Номер счета (IBAN): ${cardData.accountNumber || "—"}`,
        `ИИН получателя: ${cardData.IIN || "—"}`,
        `ФИО получателя: ${cardData.fullName || "—"}`,
        "",
        `Заявка: ${transactionId}`,
    ].join("\n");
}

export async function sendPartnerWithdrawTelegram(params) {
    const token = process.env.TELEGRAM_BOT_TOKEN_SUPPORT;
    const chatId = process.env.TELEGRAM_PARTNER_WITHDRAW_CHAT_ID || process.env.TELEGRAM_WITHDRAW_CHAT_ID;

    if (!token || !chatId) {
        console.error(
            "[telegram] Задайте TELEGRAM_BOT_TOKEN_SUPPORT и TELEGRAM_WITHDRAW_CHAT_ID (или TELEGRAM_PARTNER_WITHDRAW_CHAT_ID) для запросов партнёров на вывод"
        );
        return { ok: false, error: "TELEGRAM_NOT_CONFIGURED" };
    }

    try {
        const { data } = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: buildPartnerWithdrawMessage(params),
        });
        return data.ok ? { ok: true } : { ok: false, error: data.description || "telegram_api_error" };
    } catch (err) {
        const errMsg = err.response?.data?.description || err.message || "unknown_error";
        console.error("[telegram] sendPartnerWithdrawTelegram:", errMsg);
        return { ok: false, error: errMsg };
    }
}
