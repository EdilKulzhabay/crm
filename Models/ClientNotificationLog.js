import mongoose from "mongoose";

/**
 * Журнал push-уведомлений клиентам (мобильное приложение).
 * sentAt — момент в UTC; sentAtLocalPlus5 — строка даты/времени в смещении UTC+5 (как в ТЗ).
 */
const ClientNotificationLogSchema = new mongoose.Schema(
    {
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            default: null,
            index: true,
        },
        /** Логическая категория для фильтров и отчётов */
        notificationType: {
            type: String,
            required: true,
            enum: ["orderStatus", "support", "courierNearby", "other"],
            index: true,
        },
        title: { type: String, required: true },
        messageBody: { type: String, required: true },
        /** Момент отправки (BSON Date, UTC) */
        sentAt: { type: Date, required: true, default: Date.now, index: true },
        /** Дата/время в смещении UTC+5 (строка, например 2026-04-12T18:30:45+05:00) */
        sentAtLocalPlus5: { type: String, required: true },
        /** Значение newStatus из FCM data (onTheWay, delivered, courierNearby, …) */
        pushChannel: { type: String, default: "" },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null,
            index: true,
        },
        successCount: { type: Number, default: 0 },
        errorCount: { type: Number, default: 0 },
        tokenCount: { type: Number, default: 0 },
    },
    { timestamps: false }
);

export default mongoose.model("ClientNotificationLog", ClientNotificationLogSchema);
