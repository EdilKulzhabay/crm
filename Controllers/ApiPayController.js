/**
 * ApiPay.kz (Kaspi Pay через QR) — контроллер
 * Документация: https://apipay.kz/docs
 *
 * Endpoints:
 *  - POST /api/apipay/qr/create     — создать QR-счёт
 *  - GET  /api/apipay/qr/:id        — получить локальную инфу о счёте + опц. синк с ApiPay
 *  - POST /api/apipay/qr/:id/cancel — отменить счёт
 *  - POST /api/apipay/qr/check      — пакетно проверить статусы по нашим записям
 *  - POST /api/apipay/webhook       — приём webhook-ов от ApiPay (HMAC-SHA256)
 */

import "dotenv/config";
import ApiPayInvoice from "../Models/ApiPayInvoice.js";
import Client from "../Models/Client.js";
import ClientPayment from "../Models/ClientPayment.js";
import Order from "../Models/Order.js";
import { createClientOrderCore } from "./MobileController.js";
import {
    createQrInvoice as apipayCreateQrInvoice,
    getInvoice as apipayGetInvoice,
    cancelInvoice as apipayCancelInvoice,
    checkInvoicesStatus as apipayCheckInvoicesStatus,
    verifyApiPayWebhook,
    APIPAY_WEBHOOK_SECRET,
} from "../utils/apipay.js";

function collectClientFcmTokens(client) {
    const list = [...(client?.notificationPushTokens || [])];
    const legacy = client?.notificationPushToken;
    if (legacy && typeof legacy === "string" && legacy.trim()) {
        list.push(legacy.trim());
    }
    return [...new Set(list.filter(Boolean))];
}

/** Унифицированная проверка sandbox / ошибок API */
function isOk(status) {
    return status >= 200 && status < 300;
}

/** Минимальная валидация черновика заказа, который нужно создать после пополнения. */
function isValidPendingOrderDraft(draft) {
    return (
        draft &&
        typeof draft === "object" &&
        typeof draft.mail === "string" &&
        draft.mail.trim().length > 0 &&
        draft.address &&
        typeof draft.address === "object" &&
        draft.products &&
        typeof draft.products === "object" &&
        (draft.opForm === "credit" || draft.opForm === "coupon")
    );
}

/**
 * POST /api/apipay/qr/create
 * Body:
 *  - amount:   number   — сумма в KZT (обязательно).
 *  - clientId: ObjectId — id клиента CRM, которому при оплате пополнится balance (обязательно).
 *  - pendingOrderDraft: object (опционально) — черновик заказа мобильного приложения
 *    (тот же формат, что и тело addOrderClientMobile), который нужно создать сразу
 *    после зачисления баланса — даже если клиент не вернётся в приложение.
 */
export const createQrInvoice = async (req, res) => {
    try {
        const { amount, clientId, pendingOrderDraft } = req.body || {};

        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Укажите amount (> 0)",
            });
        }
        if (!clientId) {
            return res.status(400).json({
                success: false,
                message: "Укажите clientId",
            });
        }

        const payload = { amount: Number(amount) };

        console.log("[ApiPay] createQrInvoice REQUEST:", {
            amount: payload.amount,
            clientId,
            hasPendingOrderDraft: isValidPendingOrderDraft(pendingOrderDraft),
        });

        const { status, data } = await apipayCreateQrInvoice(payload);

        if (!isOk(status)) {
            console.error("[ApiPay] createQrInvoice FAIL:", status, data);
            return res.status(status >= 400 && status < 600 ? status : 502).json({
                success: false,
                message: data?.message || "Ошибка ApiPay при создании QR-счёта",
                errors: data?.errors || null,
            });
        }

        const localDoc = await ApiPayInvoice.create({
            apipayInvoiceId: data.id,
            client: clientId,
            amount: Number(data.amount ?? amount ?? 0),
            status: data.status || "pending",
            kaspiInvoiceId: data.kaspi_invoice_id || null,
            qrImageUrl: data.qr_image_url || null,
            qrTokenUrl: data.qr_token_url || null,
            qrExpiresAt: data.qr_expires_at ? new Date(data.qr_expires_at) : null,
            isSandbox: !!data.is_sandbox,
            lastResponse: data,
            pendingOrderDraft: isValidPendingOrderDraft(pendingOrderDraft) ? pendingOrderDraft : null,
        });

        console.log("[ApiPay] createQrInvoice SUCCESS:", {
            apipayInvoiceId: data.id,
            status: data.status,
            clientId,
        });

        return res.status(201).json({
            success: true,
            invoice: {
                id: localDoc._id,
                apipayInvoiceId: localDoc.apipayInvoiceId,
                amount: localDoc.amount,
                status: localDoc.status,
                qrImageUrl: localDoc.qrImageUrl,
                qrTokenUrl: localDoc.qrTokenUrl,
                qrExpiresAt: localDoc.qrExpiresAt,
                isSandbox: localDoc.isSandbox,
            },
        });
    } catch (err) {
        console.error("[ApiPay] createQrInvoice ERROR:", err?.message);
        return res.status(500).json({
            success: false,
            message: "Внутренняя ошибка при создании QR-счёта",
        });
    }
};

/**
 * GET /api/apipay/qr/:id?sync=1
 * :id — наш _id (локальный) ИЛИ apipayInvoiceId.
 * Если ?sync=1 — дополнительно сходит в ApiPay и обновит статус локально.
 */
export const getQrInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const sync = req.query?.sync === "1" || req.query?.sync === "true";

        let doc = null;
        if (/^[0-9]+$/.test(id)) {
            doc = await ApiPayInvoice.findOne({ apipayInvoiceId: Number(id) });
        }
        if (!doc) doc = await ApiPayInvoice.findById(id).catch(() => null);

        if (!doc) {
            return res
                .status(404)
                .json({ success: false, message: "Счёт не найден" });
        }

        if (sync) {
            const { status, data } = await apipayGetInvoice(doc.apipayInvoiceId);
            if (isOk(status)) {
                doc.status = data.status || doc.status;
                doc.kaspiInvoiceId = data.kaspi_invoice_id || doc.kaspiInvoiceId;
                doc.paidAt = data.paid_at ? new Date(data.paid_at) : doc.paidAt;
                doc.totalRefunded = Number(data.total_refunded ?? doc.totalRefunded);
                doc.isFullyRefunded = !!data.is_fully_refunded;
                doc.errorMessage = data.error_message || null;
                doc.lastResponse = data;
                await doc.save();
            } else {
                console.warn("[ApiPay] getInvoice sync FAIL:", status, data);
            }
        }

        return res.json({ success: true, invoice: doc });
    } catch (err) {
        console.error("[ApiPay] getQrInvoice ERROR:", err?.message);
        return res.status(500).json({
            success: false,
            message: "Внутренняя ошибка",
        });
    }
};

/**
 * POST /api/apipay/qr/:id/cancel
 * :id — наш _id или apipayInvoiceId.
 */
export const cancelQrInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        let doc = null;
        if (/^[0-9]+$/.test(id)) {
            doc = await ApiPayInvoice.findOne({ apipayInvoiceId: Number(id) });
        }
        if (!doc) doc = await ApiPayInvoice.findById(id).catch(() => null);

        if (!doc) {
            return res
                .status(404)
                .json({ success: false, message: "Счёт не найден" });
        }

        const { status, data } = await apipayCancelInvoice(doc.apipayInvoiceId);
        if (!isOk(status)) {
            return res.status(status).json({
                success: false,
                message: data?.message || "Ошибка отмены счёта",
            });
        }

        doc.status = data?.invoice?.status || "cancelling";
        doc.lastResponse = data;
        await doc.save();

        return res.json({ success: true, invoice: doc });
    } catch (err) {
        console.error("[ApiPay] cancelQrInvoice ERROR:", err?.message);
        return res.status(500).json({
            success: false,
            message: "Внутренняя ошибка",
        });
    }
};

/**
 * POST /api/apipay/qr/check
 * Body: { ids?: number[], onlyPending?: boolean }
 * Пакетно диспатчит проверку статусов по нашим ApiPay-id.
 */
export const checkQrInvoicesStatus = async (req, res) => {
    try {
        let { ids, onlyPending } = req.body || {};

        if (!Array.isArray(ids) || ids.length === 0) {
            const filter = onlyPending
                ? { status: { $in: ["pending", "processing"] } }
                : {};
            const docs = await ApiPayInvoice.find(filter)
                .select("apipayInvoiceId")
                .limit(100)
                .lean();
            ids = docs.map((d) => d.apipayInvoiceId);
        }

        if (ids.length === 0) {
            return res.json({ success: true, invoices: [] });
        }

        const { status, data } = await apipayCheckInvoicesStatus(ids);
        if (!isOk(status)) {
            return res.status(status).json({
                success: false,
                message: data?.message || "Ошибка проверки статусов",
                errors: data?.errors || null,
            });
        }

        return res.json({ success: true, invoices: data?.invoices || [] });
    } catch (err) {
        console.error("[ApiPay] checkQrInvoicesStatus ERROR:", err?.message);
        return res.status(500).json({
            success: false,
            message: "Внутренняя ошибка",
        });
    }
};

/**
 * POST /api/apipay/webhook
 * Принимает события от ApiPay. Подключается с express.raw() — body будет Buffer.
 *
 * Обрабатываемые события:
 *  - invoice.status_changed
 *  - invoice.refunded
 *  - subscription.payment_succeeded
 *  - subscription.payment_failed
 *  - subscription.grace_period_started
 *  - subscription.expired
 *  - webhook.test
 *
 * Должны ответить 2xx в течение 10 секунд (Invoice webhook без ретраев).
 */
export const apipayWebhook = async (req, res) => {
    try {
        const signature =
            req.headers["x-webhook-signature"] ||
            req.headers["X-Webhook-Signature"];

        const rawBody = Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(
                  typeof req.body === "string"
                      ? req.body
                      : JSON.stringify(req.body || {}),
                  "utf8"
              );

        if (!APIPAY_WEBHOOK_SECRET) {
            console.error("[ApiPay] webhook: APIPAY_WEBHOOK_SECRET не задан");
            return res
                .status(500)
                .send("Webhook secret not configured on server");
        }

        if (!verifyApiPayWebhook(rawBody, signature, APIPAY_WEBHOOK_SECRET)) {
            console.error("[ApiPay] webhook INVALID SIGNATURE", {
                signature: signature || null,
                bodyLength: rawBody?.length,
            });
            return res.status(401).send("Invalid signature");
        }

        let payload;
        try {
            payload = JSON.parse(rawBody.toString("utf8"));
        } catch (e) {
            console.error("[ApiPay] webhook JSON parse error:", e?.message);
            return res.status(400).send("Invalid JSON");
        }

        const event = payload?.event;
        console.log("[ApiPay] webhook RECEIVED:", {
            event,
            invoiceId: payload?.invoice?.id,
            subscriptionId: payload?.subscription?.id,
            source: payload?.source,
            timestamp: payload?.timestamp,
        });

        switch (event) {
            case "webhook.test": {
                console.log("[ApiPay] webhook.test OK");
                break;
            }

            case "invoice.status_changed":
                await handleInvoiceStatusChanged(payload);
                break;

            case "invoice.refunded":
                await handleInvoiceRefunded(payload);
                break;

            case "subscription.payment_succeeded":
            case "subscription.payment_failed":
            case "subscription.grace_period_started":
            case "subscription.expired":
                console.log(
                    "[ApiPay] subscription event:",
                    event,
                    "id:",
                    payload?.subscription?.id
                );
                break;

            default:
                console.warn("[ApiPay] webhook: неизвестный event:", event);
        }

        return res.status(200).send("OK");
    } catch (err) {
        console.error("[ApiPay] webhook ERROR:", err?.message);
        return res.status(500).send("Internal error");
    }
};

/* ----------------------- Внутренние обработчики ----------------------- */

async function handleInvoiceStatusChanged(payload) {
    const inv = payload?.invoice;
    if (!inv?.id) return;

    const newStatus = inv.status;
    const amount = Number(inv.amount || 0);

    // Если статус paid — атомарно «забираем» счёт на обработку (идемпотентность).
    // Условие paymentApplied: { $ne: true } гарантирует ровно один зачёт, даже при
    // повторной доставке webhook-а или гонке между обработчиками.
    if (newStatus === "paid") {
        const claimedDoc = await ApiPayInvoice.findOneAndUpdate(
            { apipayInvoiceId: inv.id, paymentApplied: { $ne: true } },
            {
                $set: {
                    status: newStatus,
                    kaspiInvoiceId: inv.kaspi_invoice_id || null,
                    paidAt: inv.paid_at ? new Date(inv.paid_at) : new Date(),
                    paymentApplied: true,
                    lastResponse: inv,
                },
                $push: {
                    webhookEvents: {
                        event: payload.event,
                        receivedAt: new Date(),
                        payload,
                    },
                },
            },
            { new: true }
        );

        if (claimedDoc) {
            console.log("[ApiPay] invoice.paid CLAIMED:", {
                apipayInvoiceId: claimedDoc.apipayInvoiceId,
                externalOrderId: claimedDoc.externalOrderId,
                clientId: claimedDoc.client?.toString() || null,
                amount,
            });

            if (claimedDoc.order || claimedDoc.externalOrderId) {
                // Счёт создан курьером под конкретный заказ (createOrderKaspiQrCourierAggregator) —
                // это оплата ЭТОГО заказа, а не пополнение баланса клиента.
                await markOrderPaidByKaspi(claimedDoc, inv);
                return;
            }

            await topUpClientBalance(claimedDoc, inv);

            if (claimedDoc.pendingOrderDraft) {
                await completePendingOrderAfterTopUp(claimedDoc);
            }
            return;
        }

        // Сюда попадаем если: a) записи нет, или b) уже зачислено ранее
        const existing = await ApiPayInvoice.findOne({ apipayInvoiceId: inv.id });
        if (!existing) {
            console.warn(
                "[ApiPay] invoice.status_changed paid: локальной записи нет, apipayInvoiceId=",
                inv.id
            );
        } else {
            console.log(
                "[ApiPay] invoice.status_changed paid: уже обработано ранее, skip top-up. apipayInvoiceId=",
                inv.id
            );
            // Всё равно сохраним факт повторной доставки webhook-а
            existing.webhookEvents.push({
                event: payload.event,
                receivedAt: new Date(),
                payload,
            });
            existing.lastResponse = inv;
            await existing.save();
        }
        return;
    }

    // Прочие статусы (pending, cancelled, expired, partially_refunded, refunded, error)
    const doc = await ApiPayInvoice.findOneAndUpdate(
        { apipayInvoiceId: inv.id },
        {
            $set: {
                status: newStatus,
                kaspiInvoiceId: inv.kaspi_invoice_id || null,
                paidAt: inv.paid_at ? new Date(inv.paid_at) : null,
                errorMessage: inv.error_message || null,
                lastResponse: inv,
            },
            $push: {
                webhookEvents: {
                    event: payload.event,
                    receivedAt: new Date(),
                    payload,
                },
            },
        },
        { new: true }
    );

    if (!doc) {
        console.warn(
            "[ApiPay] invoice.status_changed: локальной записи нет, apipayInvoiceId=",
            inv.id
        );
        return;
    }

    console.log("[ApiPay] invoice.status_changed APPLIED:", {
        apipayInvoiceId: doc.apipayInvoiceId,
        externalOrderId: doc.externalOrderId,
        status: doc.status,
    });
}

/**
 * Пополняет баланс клиента, пишет ClientPayment и отправляет push.
 * Вызывается ТОЛЬКО после успешного атомарного claim в handleInvoiceStatusChanged.
 */
async function topUpClientBalance(doc, inv) {
    const amount = Number(inv.amount || doc.amount || 0);
    if (!(amount > 0)) {
        console.error(
            "[ApiPay] topUpClientBalance: некорректная сумма",
            { apipayInvoiceId: doc.apipayInvoiceId, amount }
        );
        return;
    }
    if (!doc.client) {
        console.warn(
            "[ApiPay] topUpClientBalance: у счёта нет привязки к клиенту (client=null), пропуск. apipayInvoiceId=",
            doc.apipayInvoiceId
        );
        return;
    }

    let client;
    try {
        client = await Client.findById(doc.client);
    } catch (e) {
        console.error("[ApiPay] topUpClientBalance: Client.findById error:", e?.message);
        return;
    }

    if (!client) {
        console.error(
            "[ApiPay] topUpClientBalance: клиент не найден",
            { clientId: doc.client?.toString(), apipayInvoiceId: doc.apipayInvoiceId }
        );
        return;
    }

    const prevBalance = Number(client.balance) || 0;
    client.balance = prevBalance + amount;
    try {
        await client.save();
    } catch (e) {
        console.error("[ApiPay] topUpClientBalance: client.save error:", e?.message);
        return;
    }

    console.log("[ApiPay] balance top-up SUCCESS:", {
        clientId: client._id.toString(),
        apipayInvoiceId: doc.apipayInvoiceId,
        amount,
        balanceBefore: prevBalance,
        balanceAfter: client.balance,
    });

    try {
        await ClientPayment.create({
            client: client._id,
            paidAt: doc.paidAt || new Date(),
            amount,
            currency: "KZT",
            status: "success",
            cardLast4: null,
            sessionOrderId: doc.externalOrderId || `apipay-${doc.apipayInvoiceId}`,
            providerInvoiceId: String(doc.apipayInvoiceId),
            rawProviderStatus: inv.status || "paid",
        });
    } catch (e) {
        console.error("[ApiPay] ClientPayment.create (не критично):", e?.message);
    }

    const fcmTokens = collectClientFcmTokens(client);
    if (fcmTokens.length > 0) {
        try {
            const { pushClientBalanceTopUpData } = await import(
                "../pushNotificationClient.js"
            );
            await pushClientBalanceTopUpData(
                fcmTokens,
                {
                    orderId: doc.externalOrderId || `apipay-${doc.apipayInvoiceId}`,
                    amount,
                    balanceAfter: client.balance,
                },
                { clientId: client._id }
            );
        } catch (pushErr) {
            console.error(
                "[ApiPay] push balance refresh:",
                pushErr?.message
            );
        }
    } else {
        console.log(
            "[ApiPay] нет FCM-токенов у клиента, пропуск служебного пуша обновления баланса"
        );
    }
}

/**
 * Счёт был создан курьером под конкретный заказ (createOrderKaspiQrCourierAggregator).
 * Оплата — это оплата ЗАКАЗА, а не пополнение баланса клиента: баланс здесь не трогаем,
 * только помечаем сам заказ оплаченным, чтобы курьер видел актуальный статус сразу,
 * не дожидаясь ручного опроса (checkOrderKaspiQrCourierAggregator).
 */
async function markOrderPaidByKaspi(doc, inv) {
    const orderId = doc.order || doc.externalOrderId;
    if (!orderId) return;

    try {
        await Order.updateOne(
            { _id: orderId },
            {
                $set: {
                    "qrCodeData.status": "paid",
                },
            }
        );
        console.log("[ApiPay] order marked as paid by Kaspi QR:", {
            orderId: String(orderId),
            apipayInvoiceId: doc.apipayInvoiceId,
            amount: Number(inv.amount || doc.amount || 0),
        });
    } catch (e) {
        console.error("[ApiPay] markOrderPaidByKaspi error:", e?.message);
    }
}

/**
 * Создаёт заказ из pendingOrderDraft сразу после зачисления баланса — работает,
 * даже если клиент не вернулся в приложение (например, оплатил Kaspi QR и закрыл его).
 * Идемпотентно: claim через pendingOrderApplied гарантирует ровно одну попытку создания
 * на счёт. Если клиент всё же вернулся в приложение и заказ уже был создан "живьём" —
 * createClientOrderCore вернёт "Заказ на эту дату уже существует", что тут не является ошибкой.
 */
async function completePendingOrderAfterTopUp(doc) {
    const claimed = await ApiPayInvoice.findOneAndUpdate(
        { _id: doc._id, pendingOrderApplied: { $ne: true } },
        { $set: { pendingOrderApplied: true } },
        { new: false }
    );
    if (!claimed) return;

    try {
        const result = await createClientOrderCore(doc.pendingOrderDraft);
        if (result.success) {
            console.log("[ApiPay] pending order auto-created after top-up:", {
                apipayInvoiceId: doc.apipayInvoiceId,
                orderId: result.order?._id?.toString(),
            });
        } else if (result.message === "Заказ на эту дату уже существует") {
            console.log("[ApiPay] pending order already existed (client returned to app in time):", {
                apipayInvoiceId: doc.apipayInvoiceId,
            });
        } else {
            console.warn("[ApiPay] pending order auto-create FAILED:", {
                apipayInvoiceId: doc.apipayInvoiceId,
                message: result.message,
            });
        }
    } catch (e) {
        console.error("[ApiPay] completePendingOrderAfterTopUp error:", e?.message);
    }
}

async function handleInvoiceRefunded(payload) {
    const inv = payload?.invoice;
    const refund = payload?.refund;
    if (!inv?.id) return;

    const doc = await ApiPayInvoice.findOneAndUpdate(
        { apipayInvoiceId: inv.id },
        {
            status: inv.status,
            totalRefunded: Number(inv.total_refunded || 0),
            isFullyRefunded: !!inv.is_fully_refunded,
            lastResponse: inv,
            $push: {
                webhookEvents: {
                    event: payload.event,
                    receivedAt: new Date(),
                    payload,
                },
            },
        },
        { new: true }
    );

    if (!doc) {
        console.warn(
            "[ApiPay] invoice.refunded: локальной записи нет, apipayInvoiceId=",
            inv.id
        );
        return;
    }

    console.log("[ApiPay] invoice.refunded APPLIED:", {
        apipayInvoiceId: doc.apipayInvoiceId,
        externalOrderId: doc.externalOrderId,
        totalRefunded: doc.totalRefunded,
        refundId: refund?.id,
    });
}
