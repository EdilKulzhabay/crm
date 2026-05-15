/**
 * ApiPay.kz (Kaspi Pay) — утилиты
 * Документация: https://apipay.kz/docs
 *
 * Base URL: https://bpapi.bazarbay.site/api/v1
 * Auth: X-API-Key
 * Webhook signature: HMAC-SHA256 над сырым телом, заголовок X-Webhook-Signature: sha256=<hex>
 */

import axios from "axios";
import crypto from "crypto";
import "dotenv/config";

export const APIPAY_BASE_URL =
    process.env.APIPAY_BASE_URL || "https://bpapi.bazarbay.site/api/v1";
export const APIPAY_API_KEY = process.env.APIPAY_API_KEY || "";
export const APIPAY_WEBHOOK_SECRET = process.env.APIPAY_WEBHOOK_SECRET || "";

/**
 * HTTP-клиент к ApiPay с предустановленными заголовками.
 * Используем lazy-инициализацию, чтобы не падать при пустом ключе на старте.
 */
export function getApiPayClient() {
    if (!APIPAY_API_KEY) {
        throw new Error(
            "[ApiPay] APIPAY_API_KEY не задан в .env — невозможно сделать запрос"
        );
    }
    return axios.create({
        baseURL: APIPAY_BASE_URL,
        timeout: 15000,
        headers: {
            "X-API-Key": APIPAY_API_KEY,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        validateStatus: () => true,
    });
}

/**
 * Проверка подписи webhook-а от ApiPay.
 * @param {Buffer|string} rawPayload — сырое тело запроса (Buffer лучше всего).
 * @param {string} signature        — значение заголовка X-Webhook-Signature (вида "sha256=...").
 * @param {string} secret           — webhook secret из дашборда ApiPay.
 * @returns {boolean}
 */
export function verifyApiPayWebhook(rawPayload, signature, secret) {
    if (!signature || !secret) return false;

    const payloadBuf = Buffer.isBuffer(rawPayload)
        ? rawPayload
        : Buffer.from(String(rawPayload ?? ""), "utf8");

    const expected =
        "sha256=" +
        crypto.createHmac("sha256", secret).update(payloadBuf).digest("hex");

    try {
        const a = Buffer.from(expected);
        const b = Buffer.from(String(signature));
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

/**
 * Создать QR-счёт.
 * Доступные поля (см. /invoices/qr):
 *  - amount?: number              — сумма (KZT). Обязательна без cart_items.
 *  - description?: string         — описание счёта.
 *  - external_order_id?: string   — наш внешний ID заказа.
 *  - cart_items?: array           — для организаций с каталогом.
 *  - discount_percentage?: number — 1..99 (только с cart_items).
 *  - simulate?: "paid"|"cancelled"|"expired" — только sandbox.
 */
export async function createQrInvoice(payload) {
    const client = getApiPayClient();
    const res = await client.post("/invoices/qr", payload);
    return { status: res.status, data: res.data };
}

/** Получить детали счёта по ApiPay-ID */
export async function getInvoice(apipayInvoiceId) {
    const client = getApiPayClient();
    const res = await client.get(`/invoices/${apipayInvoiceId}`);
    return { status: res.status, data: res.data };
}

/** Отменить счёт в статусе pending/processing */
export async function cancelInvoice(apipayInvoiceId) {
    const client = getApiPayClient();
    const res = await client.post(`/invoices/${apipayInvoiceId}/cancel`);
    return { status: res.status, data: res.data };
}

/** Пакетная проверка статусов */
export async function checkInvoicesStatus(apipayInvoiceIds) {
    const client = getApiPayClient();
    const res = await client.post("/invoices/status/check", {
        invoice_ids: apipayInvoiceIds,
    });
    return { status: res.status, data: res.data };
}
