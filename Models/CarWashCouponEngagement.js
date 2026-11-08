import mongoose from "mongoose";

/**
 * Статистика купона на мойку по клиенту (одна запись на клиента — коллекция не растёт от нажатий).
 * buttonClicks — нажатия кнопки «Подарок от партнера» на главной приложения,
 * screenViews — открытия экрана с кодом. Пишется через POST /trackCarWashCouponEvent.
 */
const CarWashCouponEngagementSchema = new mongoose.Schema(
    {
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            required: true,
            unique: true,
        },
        buttonClicks: { type: Number, default: 0, min: 0 },
        screenViews: { type: Number, default: 0, min: 0 },
        lastButtonClickAt: { type: Date, default: null },
        lastScreenViewAt: { type: Date, default: null },
    },
    { timestamps: true }
);

export default mongoose.model("CarWashCouponEngagement", CarWashCouponEngagementSchema);
