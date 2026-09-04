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
        /** Актуальная версия мобильного клиента — сравнивается с версией установленного
         * приложения, чтобы показать модалку «Доступна новая версия» */
        latestAppVersion: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

export default mongoose.model("MobileAppSettings", MobileAppSettingsSchema);
