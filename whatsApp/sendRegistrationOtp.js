import { normalizePhoneForWhatsApp } from "./normalizePhone.js";
import { sendWhatsAppText } from "./waWebClient.js";

export { normalizePhoneForWhatsApp, phonesMatch } from "./normalizePhone.js";

/**
 * Отправка кода регистрации через WhatsApp (whatsapp-web.js + сессия в браузере).
 *
 * На сервере один раз при старте поднимается клиент; в консоли показывается QR для входа.
 * Сессия хранится в .wwebjs_auth (или WWEBJS_AUTH_PATH).
 *
 * Переменные окружения:
 * - WWEBJS_AUTH_PATH — папка для LocalAuth (по умолчанию ./.wwebjs_auth от cwd)
 * - WWEBJS_CLIENT_ID — идентификатор сессии, если несколько инстансов
 * - WHATSAPP_READY_TIMEOUT_MS — сколько ждать готовности перед ошибкой OTP (по умолчанию 300000)
 * - WHATSAPP_SKIP_SEND=true — не слать в WhatsApp, только лог (для разработки без браузера)
 */
export async function sendRegistrationOtpWhatsApp(rawPhone, otpCode) {
    const to = normalizePhoneForWhatsApp(rawPhone);
    if (!to || to.length < 11) {
        return { ok: false, error: "INVALID_PHONE" };
    }

    if (process.env.WHATSAPP_SKIP_SEND === "true") {
        console.log(`[WhatsApp DEV] OTP для ${to}: ${otpCode}`);
        return { ok: true };
    }

    const text = `Код подтверждения Tibetskaya: ${otpCode}`;

    try {
        await sendWhatsAppText(to, text);
        return { ok: true };
    } catch (err) {
        const msg = err?.message || String(err);
        console.error("[WhatsApp Web] Ошибка отправки OTP:", msg);
        return { ok: false, error: msg };
    }
}
