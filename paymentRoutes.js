/**
 * Роуты для Payplus
 * Подключение в основном приложении:
 *   import paymentRoutes from "./server/routes/paymentRoutes.js";
 *   app.use("/api/payment", paymentRoutes);
 */

import { Router } from "express";
import {
    createPayment,
    payplusCallback,
    getWidgetConfig,
    getWidgetPage,
    getPaymentSessionStatus,
    paymentSuccessPage,
    paymentErrorPage,
} from "./Controllers/PaymentController.js";

const router = Router();

// Тест доступности: GET /api/payment/health
router.get("/health", (req, res) => res.json({ ok: true, service: "payplus" }));

router.post("/create", createPayment);
router.post("/payplus-callback", payplusCallback);
router.get("/payplus-callback", payplusCallback);
router.post("/widget-config", getWidgetConfig);
router.get("/widget-page", getWidgetPage);
router.get("/session-status", getPaymentSessionStatus);
router.get("/success", paymentSuccessPage);
router.get("/error", paymentErrorPage);

export default router;
