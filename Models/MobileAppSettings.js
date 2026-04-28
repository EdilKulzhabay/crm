import mongoose from "mongoose";

/** Глобальные настройки мобильного приложения (один документ в коллекции) */
const MobileAppSettingsSchema = new mongoose.Schema(
    {
        /** До какого часа (времени Алматы) принимаются заказы на сегодня; после — только со следующего дня */
        orderSameDayUntilHour: {
            type: Number,
            default: 19,
            min: 0,
            max: 23,
        },
    },
    { timestamps: true }
);

export default mongoose.model("MobileAppSettings", MobileAppSettingsSchema);
