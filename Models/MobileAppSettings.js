import mongoose from "mongoose";

export const DEFAULT_MAINTENANCE_MESSAGE = "Ведутся технические работы, попробуйте через 15 мин";
export const MAINTENANCE_MESSAGE_MAX_LENGTH = 300;

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
        /** Актуальная версия приложения курьера — аналогично latestAppVersion, но для courier */
        latestCourierAppVersion: {
            type: String,
            default: "",
        },
        /** Технические работы: клиентское приложение показывает модалку поверх всех экранов */
        maintenanceEnabled: {
            type: Boolean,
            default: false,
        },
        /** Текст модалки технических работ */
        maintenanceMessage: {
            type: String,
            default: DEFAULT_MAINTENANCE_MESSAGE,
            maxlength: MAINTENANCE_MESSAGE_MAX_LENGTH,
        },
    },
    { timestamps: true }
);

export default mongoose.model("MobileAppSettings", MobileAppSettingsSchema);
