/**
 * Payplus.kz — контроллер платежей
 * Документация: https://payplus.kz/docs/en/
 *
 * Endpoints:
 * - POST /api/payment/create — создание платежа, возврат URL формы Payplus
 * - POST /api/payment/payplus-callback — callback от Payplus (process_url)
 * - GET  /api/payment/widget-page?sessionId=xxx — HTML-страница для WebView
 * - POST /api/payment/widget-config — конфиг для мобильного приложения (sessionId, widgetPageUrl)
 */

import "dotenv/config";
import Client from "../Models/Client.js";
import PaymentSession from "../PaymentSession.js";
import { buildPaymentFormSign, verifyCallbackSign } from "../utils/payplusUtils.js";

const PAYPLUS_BASE_URL = process.env.PAYPLUS_BASE_URL || "https://payplus.kz";
const PAYPLUS_MERCHANT = process.env.PAYPLUS_MERCHANT || "";
const PAYPLUS_SECRET = process.env.PAYPLUS_SECRET || "";
const API_BASE_URL = process.env.API_BASE_URL || "https://api.tibetskayacrm.kz";

function generateOrderId() {
    return `PP${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * POST /api/payment/create
 * Body: { sum, email?, phone?, clientId? }
 * Создаёт сессию и возвращает URL формы Payplus
 */
export const createPayment = async (req, res) => {
    try {
        const { sum, email, phone, clientId } = req.body;

        if (!sum || Number(sum) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Укажите корректную сумму",
            });
        }

        let client = null;
        if (clientId) {
            client = await Client.findById(clientId);
        }
        const mail = client?.mail || email;
        if (!mail) {
            return res.status(400).json({
                success: false,
                message: "Укажите email или clientId",
            });
        }

        if (!client) {
            client = await Client.findOne({ mail: mail.toLowerCase() });
        }
        if (!client) {
            return res.status(404).json({
                success: false,
                message: "Клиент не найден",
            });
        }

        const orderId = generateOrderId();
        const amount = Number(sum).toFixed(2);
        const currency = "KZT";

        await PaymentSession.create({
            orderId,
            clientId: client._id,
            amount: Number(sum),
            currency,
        });

        const params = {
            merchant: PAYPLUS_MERCHANT,
            order: orderId,
            amount,
            currency,
            item_name: "Пополнение баланса Тибетская",
            first_name: (client.fullName || "Client").split(" ")[0].replace(/[^a-zA-Z]/g, "A") || "Client",
            last_name: (client.fullName || "User").split(" ")[1]?.replace(/[^a-zA-Z]/g, "U") || "User",
            user_id: String(client._id),
            payment_url: API_BASE_URL,
            country: "KZ",
            ip: req.ip || req.connection?.remoteAddress || "127.0.0.1",
            custom: "",
            email: client.mail || email || "",
            phone: (client.phone || phone || "").replace(/\D/g, "").slice(0, 15),
            lang: "ru",
        };

        const sign = buildPaymentFormSign(params, PAYPLUS_SECRET);
        params.sign = sign;

        const query = new URLSearchParams(params).toString();
        const paymentUrl = `${PAYPLUS_BASE_URL}/payment/form?${query}`;

        return res.json({
            success: true,
            paymentUrl,
            orderId,
        });
    } catch (err) {
        console.error("[createPayment]", err);
        return res.status(500).json({
            success: false,
            message: "Ошибка создания платежа",
        });
    }
};

/**
 * POST /api/payment/payplus-callback
 * Callback от Payplus при успехе/ошибке платежа
 * Должен вернуть "OK"
 */
export const payplusCallback = async (req, res) => {
    try {
        const data = req.body && Object.keys(req.body).length ? req.body : req.query;

        if (!verifyCallbackSign(data, PAYPLUS_SECRET)) {
            console.error("[payplusCallback] Invalid sign");
            return res.status(400).send("Sign error");
        }

        const orderNo = data.co_order_no;
        const status = (data.co_inv_st || "").toLowerCase();
        const amount = parseFloat(data.co_amount || 0);

        const session = await PaymentSession.findOne({ orderId: orderNo });
        if (!session) {
            console.error("[payplusCallback] Session not found:", orderNo);
            return res.send("OK");
        }

        if (session.status !== "pending") {
            return res.send("OK");
        }

        if (status === "success") {
            session.status = "success";
            session.coInvId = data.co_inv_id;
            await session.save();

            const client = await Client.findById(session.clientId);
            if (client) {
                client.balance = (client.balance || 0) + amount;
                await client.save();
            }
        } else {
            session.status = "fail";
            await session.save();
        }

        return res.send("OK");
    } catch (err) {
        console.error("[payplusCallback]", err);
        return res.send("OK");
    }
};

/**
 * POST /api/payment/widget-config
 * Для мобильного приложения: создаёт сессию и возвращает URL страницы виджета
 * Body: { userId, amount, email?, phone? }
 */
export const getWidgetConfig = async (req, res) => {
    try {
        const { userId, amount, email, phone } = req.body;

        if (!userId || !amount || Number(amount) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Укажите userId и сумму",
            });
        }

        const client = await Client.findById(userId);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: "Клиент не найден",
            });
        }

        const orderId = generateOrderId();
        const amountNum = Number(amount).toFixed(2);
        const currency = "KZT";

        await PaymentSession.create({
            orderId,
            clientId: client._id,
            amount: Number(amount),
            currency,
        });

        const params = {
            merchant: PAYPLUS_MERCHANT,
            order: orderId,
            amount: amountNum,
            currency,
            item_name: "Popolnenie balansa Tibetskaya",
            first_name: (client.fullName || "Client").split(" ")[0].replace(/[^a-zA-Z]/g, "A") || "Client",
            last_name: (client.fullName || "User").split(" ")[1]?.replace(/[^a-zA-Z]/g, "U") || "User",
            user_id: String(client._id),
            payment_url: API_BASE_URL,
            country: "KZ",
            ip: req.ip || "127.0.0.1",
            custom: "",
            email: client.mail || email || "",
            phone: (client.phone || phone || "").replace(/\D/g, "").slice(0, 15),
            lang: "ru",
        };

        const sign = buildPaymentFormSign(params, PAYPLUS_SECRET);
        params.sign = sign;

        const query = new URLSearchParams(params).toString();
        const paymentUrl = `${PAYPLUS_BASE_URL}/payment/form?${query}`;

        const widgetPageUrl = `${API_BASE_URL}/api/payment/widget-page?sessionId=${orderId}`;

        return res.json({
            success: true,
            widgetPageUrl,
            paymentUrl,
            orderId,
        });
    } catch (err) {
        console.error("[getWidgetConfig]", err);
        return res.status(500).json({
            success: false,
            message: "Ошибка получения конфигурации",
        });
    }
};

/**
 * GET /api/payment/widget-page?sessionId=xxx
 * HTML-страница для WebView: редирект на Payplus или iframe
 */
export const getWidgetPage = async (req, res) => {
    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).send("Missing sessionId");
    }

    const session = await PaymentSession.findOne({ orderId: sessionId });
    if (!session) {
        return res.status(404).send("Session not found");
    }

    const params = {
        merchant: PAYPLUS_MERCHANT,
        order: session.orderId,
        amount: session.amount.toFixed(2),
        currency: session.currency || "KZT",
        item_name: "Popolnenie balansa Tibetskaya",
        first_name: "Client",
        last_name: "User",
        user_id: String(session.clientId),
        payment_url: API_BASE_URL,
        country: "KZ",
        ip: "127.0.0.1",
        custom: "",
        email: "",
        phone: "",
        lang: "ru",
    };

    const client = await Client.findById(session.clientId);
    if (client) {
        params.first_name = (client.fullName || "Client").split(" ")[0].replace(/[^a-zA-Z]/g, "A") || "Client";
        params.last_name = (client.fullName || "User").split(" ")[1]?.replace(/[^a-zA-Z]/g, "U") || "User";
        params.email = client.mail || "";
        params.phone = (client.phone || "").replace(/\D/g, "").slice(0, 15);
    }

    const sign = buildPaymentFormSign(params, PAYPLUS_SECRET);
    params.sign = sign;

    const query = new URLSearchParams(params).toString();
    const paymentUrl = `${PAYPLUS_BASE_URL}/payment/form?${query}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Оплата</title>
  <script>
    window.addEventListener('load', function() {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'widget-loaded' }));
      }
      window.location.href = ${JSON.stringify(paymentUrl)};
    });
  </script>
</head>
<body>
  <p>Загрузка...</p>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
};

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CLIENT_URL || "https://tibetskayacrm.kz";

/**
 * GET /api/payment/success
 * Страница успешной оплаты (success_url в настройках мерчанта Payplus)
 * Редирект на фронтенд или postMessage для WebView
 */
export const paymentSuccessPage = (req, res) => {
    const redirectUrl = `${FRONTEND_URL}/payment/success`;
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Оплата успешна</title>
  <script>
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment-success' }));
      setTimeout(function() { window.close(); }, 500);
    } else if (window.opener) {
      window.opener.postMessage({ type: 'payment-success' }, '*');
      setTimeout(function() { window.close(); }, 500);
    } else {
      window.location.href = ${JSON.stringify(redirectUrl)};
    }
  </script>
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;">
  <h2>Оплата успешна</h2>
  <p>Спасибо за пополнение баланса. Перенаправление...</p>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
};

/**
 * GET /api/payment/error
 * Страница ошибки оплаты (fail_url в настройках мерчанта Payplus)
 */
export const paymentErrorPage = (req, res) => {
    const redirectUrl = `${FRONTEND_URL}/payment/error`;
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ошибка оплаты</title>
  <script>
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment-error', message: 'Payment failed' }));
    } else if (window.opener) {
      window.opener.postMessage({ type: 'payment-error', message: 'Payment failed' }, '*');
    }
    setTimeout(function() {
      if (window.opener) window.close();
      else window.location.href = ${JSON.stringify(redirectUrl)};
    }, 1500);
  </script>
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;">
  <h2>Ошибка оплаты</h2>
  <p>Платёж не прошёл. Попробуйте снова.</p>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
};
