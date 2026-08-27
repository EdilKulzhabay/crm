/**
 * Meta (Facebook) Conversions API — серверная отправка событий CompleteRegistration и Purchase.
 * Документация: https://developers.facebook.com/documentation/ads-commerce/conversions-api
 *
 * У нас нет сайта / Meta Pixel в браузере — только мобильное приложение и этот backend,
 * поэтому action_source = "app" (конверсия сделана в мобильном приложении — отдельное
 * документированное значение, а не "website"/"system_generated").
 *
 * fbc (клик по рекламе Facebook/Instagram) на чистом мобильном приложении без
 * Universal/App Links берём из deferred app link FBSDK на стороне клиента
 * (tibetskaya_client/src/utils/metaAttribution.ts) — оттуда приходит сырой fbclid,
 * здесь он оборачивается в формат fb.<subdomainIndex>.<creationTime>.<fbclid>, см. buildFbc().
 *
 * Переменные окружения:
 * - META_PIXEL_ID           — обязателен, ID пикселя/датасета
 * - META_CAPI_ACCESS_TOKEN  — обязателен, токен доступа к CAPI
 * - META_API_VERSION        — версия Graph API (по умолчанию v21.0)
 * - META_TEST_EVENT_CODE    — код для Test Events в Events Manager (необязателен)
 * - META_DEFAULT_CURRENCY   — валюта для Purchase (по умолчанию KZT)
 */

import axios from "axios";
import crypto from "crypto";
import "dotenv/config";
import Client from "../Models/Client.js";
import Order from "../Models/Order.js";
import { normalizePhoneForWhatsApp } from "../whatsApp/normalizePhone.js";

const META_PIXEL_ID = process.env.META_PIXEL_ID || "";
const META_CAPI_ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || "";
const META_API_VERSION = process.env.META_API_VERSION || "v21.0";
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || "";
const META_DEFAULT_CURRENCY = process.env.META_DEFAULT_CURRENCY || "KZT";

function isConfigured() {
    return Boolean(META_PIXEL_ID && META_CAPI_ACCESS_TOKEN);
}

/** Meta требует SHA-256 для email/телефона/внешнего ID (customer information parameters). */
function hashSha256(rawValue) {
    const value = String(rawValue ?? "").trim().toLowerCase();
    if (!value) return null;
    return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Собрать fbc из сырого fbclid (пришедшего от мобильного клиента) по формату Meta:
 * fb.<subdomainIndex>.<creationTimeMs>.<fbclid>. Значение регистрозависимое — не менять.
 * Документация: https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameter-builder-library
 * subdomainIndex=1 — как рекомендовано при генерации без сохранённой браузерной _fbc cookie.
 */
function buildFbc(fbclid) {
    const value = String(fbclid ?? "").trim();
    if (!value) return null;
    return `fb.1.${Date.now()}.${value}`;
}

function buildUserData(client, req, fbc) {
    const userData = {
        external_id: [hashSha256(client?._id)].filter(Boolean),
    };

    const emHash = hashSha256(client?.mail);
    if (emHash) userData.em = [emHash];

    const phHash = hashSha256(normalizePhoneForWhatsApp(client?.phone));
    if (phHash) userData.ph = [phHash];

    const ip = req?.ip || req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress;
    if (ip) userData.client_ip_address = String(ip).split(",")[0].trim();

    const ua = req?.headers?.["user-agent"];
    if (ua) userData.client_user_agent = ua;

    // fbc не хэшируется (в отличие от em/ph) — передаётся как есть.
    if (fbc) userData.fbc = fbc;

    return userData;
}

async function sendMetaEvent({ eventName, eventId, userData, customData }) {
    if (!isConfigured()) {
        console.warn(
            `[meta-capi] ${eventName}: META_PIXEL_ID/META_CAPI_ACCESS_TOKEN не заданы, событие не отправлено`
        );
        return { ok: false, error: "NOT_CONFIGURED" };
    }

    const payload = {
        data: [
            {
                event_name: eventName,
                event_time: Math.floor(Date.now() / 1000),
                action_source: "app",
                event_id: eventId,
                user_data: userData,
                custom_data: customData,
            },
        ],
    };
    if (META_TEST_EVENT_CODE) {
        payload.test_event_code = META_TEST_EVENT_CODE;
    }

    try {
        const res = await axios.post(
            `https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events`,
            payload,
            {
                params: { access_token: META_CAPI_ACCESS_TOKEN },
                timeout: 10000,
                validateStatus: () => true,
            }
        );

        if (res.status >= 200 && res.status < 300) {
            console.log(`[meta-capi] ${eventName} event_id=${eventId}: успех`);
            return { ok: true, status: res.status, data: res.data };
        }

        console.error(`[meta-capi] ${eventName} event_id=${eventId}: ошибка HTTP ${res.status}`, res.data);
        return { ok: false, status: res.status, data: res.data };
    } catch (error) {
        const msg = error?.response?.data || error?.message || String(error);
        console.error(`[meta-capi] ${eventName} event_id=${eventId}: исключение`, msg);
        return { ok: false, error: msg };
    }
}

/**
 * Отправить CompleteRegistration сразу после фактического создания аккаунта
 * (не на клик по кнопке, не на открытие формы).
 * Идемпотентно по флагу client.metaRegistrationSent.
 *
 * @param {string|null} [fbclid] — сырой fbclid, захваченный мобильным клиентом при
 * первом запуске (deferred app link). Сохраняется на клиенте как готовый fbc, чтобы
 * его же переиспользовать позже для Purchase — см. sendFirstPurchaseIfApplicable.
 */
export async function sendCompleteRegistration(client, req, fbclid) {
    try {
        if (!client) {
            return { ok: false, skipped: true };
        }

        const fbc = buildFbc(fbclid);

        // Атомарно "застолбить" отправку до вызова Meta, чтобы параллельный/повторный
        // вызов не отправил событие дважды (findOneAndUpdate с $ne — одна БД-операция).
        const eventId = `reg_${crypto.randomUUID()}`;
        const claimed = await Client.findOneAndUpdate(
            { _id: client._id, metaRegistrationSent: { $ne: true } },
            {
                $set: {
                    metaRegistrationSent: true,
                    metaRegistrationEventId: eventId,
                    ...(fbc ? { metaFbc: fbc } : {}),
                },
            }
        );
        if (!claimed) {
            return { ok: false, skipped: true };
        }

        const result = await sendMetaEvent({
            eventName: "CompleteRegistration",
            eventId,
            userData: buildUserData(client, req, fbc),
            customData: { content_name: "app_registration", status: "completed" },
        });

        if (!result.ok) {
            // Отправка не удалась — снимаем флаг, чтобы событие можно было отправить повторно.
            await Client.updateOne(
                { _id: client._id, metaRegistrationEventId: eventId },
                { $set: { metaRegistrationSent: false }, $unset: { metaRegistrationEventId: "" } }
            );
        }

        return result;
    } catch (error) {
        console.error("[meta-capi] sendCompleteRegistration:", error);
        return { ok: false, error };
    }
}

/**
 * Отправить Purchase, только если переданный доставленный заказ — первая completed-сделка
 * клиента. Решение "первая ли это сделка" принимается строго по БД (count заказов со
 * статусом delivered), а не на клиенте. Идемпотентно по флагу client.metaFirstPurchaseSent.
 */
export async function sendFirstPurchaseIfApplicable(order) {
    try {
        // order.client бывает как «голым» ObjectId, так и populate-нутым документом клиента
        // (например, в CourierAggregatorController.completeOrderCourierAggregator) — в обоих
        // случаях нужен именно _id, а не toString() всего документа.
        const clientRef = order?.client?._id || order?.client;
        const clientId = clientRef?.toString?.() || clientRef;
        if (!clientId) {
            return { ok: false, skipped: true };
        }

        const deliveredCount = await Order.countDocuments({
            client: clientId,
            status: "delivered",
        });
        if (deliveredCount !== 1) {
            return { ok: false, skipped: true };
        }

        // Атомарно "застолбить" отправку до вызова Meta (см. комментарий в sendCompleteRegistration).
        const eventId = `purchase_${crypto.randomUUID()}`;
        const claimed = await Client.findOneAndUpdate(
            { _id: clientId, metaFirstPurchaseSent: { $ne: true } },
            { $set: { metaFirstPurchaseSent: true, metaFirstPurchaseEventId: eventId } }
        ).select("mail phone metaFbc");
        if (!claimed) {
            return { ok: false, skipped: true };
        }

        const result = await sendMetaEvent({
            eventName: "Purchase",
            eventId,
            userData: buildUserData(claimed, null, claimed.metaFbc || null),
            customData: {
                currency: META_DEFAULT_CURRENCY,
                value: Number(order.sum || 0),
                order_id: order._id.toString(),
                content_name: "first_order",
            },
        });

        if (!result.ok) {
            await Client.updateOne(
                { _id: clientId, metaFirstPurchaseEventId: eventId },
                { $set: { metaFirstPurchaseSent: false }, $unset: { metaFirstPurchaseEventId: "" } }
            );
        }

        return result;
    } catch (error) {
        console.error("[meta-capi] sendFirstPurchaseIfApplicable:", error);
        return { ok: false, error };
    }
}
