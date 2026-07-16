import "dotenv/config";
import axios from "axios";
import crypto from "crypto";
import { normalizePhoneForWhatsApp, maskPhoneForLog } from "../whatsApp/normalizePhone.js";

const EDNA_SCHEDULE_URL = "https://app.edna.io/api/cascade/schedule";
const DEFAULT_CASCADE_ID = 3073;
const DEFAULT_MESSAGE_MATCHER_ID = 58286;

/** edna.io ждёт локальный формат KZ-номера с ведущей "8" (пример: "87784260990"). */
function toEdnaAddress(phoneNorm7) {
    return `8${phoneNorm7.slice(1)}`;
}

/**
 * Отправка OTP-кода через WhatsApp (edna.io cascade).
 * Документация: https://app.edna.io/api/cascade/schedule
 *
 * Переменные окружения:
 * - EDNA_API_KEY — обязательный ключ (заголовок x-api-key)
 * - EDNA_CASCADE_ID — id каскада (по умолчанию 3073)
 * - EDNA_MESSAGE_MATCHER_ID — id шаблона WhatsApp AUTHENTICATION (по умолчанию 58286)
 * - EDNA_SKIP_SEND=true — не слать реально, только залогировать (для разработки)
 */
export async function sendWhatsAppOtp(rawPhone, code) {
    const phoneNorm = normalizePhoneForWhatsApp(rawPhone);
    const masked = maskPhoneForLog(phoneNorm || rawPhone);

    if (!phoneNorm || phoneNorm.length !== 11) {
        console.warn(`[edna] sendWhatsAppOtp: INVALID_PHONE phone=${masked}`);
        return { ok: false, error: "INVALID_PHONE" };
    }

    const address = toEdnaAddress(phoneNorm);

    if (process.env.EDNA_SKIP_SEND === "true") {
        console.log(`[edna] EDNA_SKIP_SEND: код не отправляется, phone=${masked}`);
        console.log(`[edna DEV] OTP для ${address}: ${code}`);
        return { ok: true };
    }

    if (!process.env.EDNA_API_KEY) {
        console.error("[edna] sendWhatsAppOtp: EDNA_API_KEY не задан");
        return { ok: false, error: "MISSING_API_KEY" };
    }

    const body = {
        requestId: crypto.randomUUID(),
        cascadeId: Number(process.env.EDNA_CASCADE_ID) || DEFAULT_CASCADE_ID,
        subscriberFilter: {
            address,
            type: "PHONE",
        },
        content: {
            whatsappContent: {
                contentType: "AUTHENTICATION",
                text: code,
                messageMatcherId:
                    Number(process.env.EDNA_MESSAGE_MATCHER_ID) || DEFAULT_MESSAGE_MATCHER_ID,
            },
        },
    };

    try {
        console.log(`[edna] sendWhatsAppOtp: отправка, phone=${masked}`);
        await axios.post(EDNA_SCHEDULE_URL, body, {
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.EDNA_API_KEY,
            },
            timeout: 10000,
        });
        console.log(`[edna] sendWhatsAppOtp: успех, phone=${masked}`);
        return { ok: true };
    } catch (error) {
        const msg = error?.response?.data?.message || error?.message || String(error);
        console.error(`[edna] sendWhatsAppOtp: ошибка, phone=${masked}:`, msg);
        return { ok: false, error: msg };
    }
}
