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
    paymentSuccessPage,
    paymentErrorPage,
} from "./Controllers/PaymentController.js";

const router = Router();

router.post("/create", createPayment);
router.post("/payplus-callback", payplusCallback);
router.get("/payplus-callback", payplusCallback);
router.post("/widget-config", getWidgetConfig);
router.get("/widget-page", getWidgetPage);
router.get("/success", paymentSuccessPage);
router.get("/error", paymentErrorPage);

export default router;
