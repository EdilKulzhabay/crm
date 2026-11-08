import mongoose from "mongoose";

/**
 * blocked — автомойка отключена: её сотрудники не могут войти и гасить купоны.
 * Документ не удаляется, чтобы история погашений сохраняла ссылку на точку.
 */
export const CAR_WASH_STATUSES = Object.freeze(["active", "blocked"]);

/**
 * Автомойка-партнёр (купон −20% на мойку после доставки).
 *
 * Создаёт и редактирует только администратор CRM. Одна запись — одна точка:
 * купон гасится в конкретной точке, и в истории нужно видеть, где именно.
 * Сотрудники точки — отдельная коллекция CarWashUser.
 */
const CarWashSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        address: {
            type: String,
            required: true,
            trim: true,
            maxlength: 300,
        },
        city: {
            type: String,
            trim: true,
            default: "Алматы",
            maxlength: 100,
        },
        /** Контактный номер точки для отображения клиенту («Где можно использовать») */
        phone: {
            type: String,
            trim: true,
            default: "",
        },
        /** Ссылка на точку в 2ГИС: в приложении адрес мойки открывает её. Проверка — utils/twoGisUrl.js */
        mapUrl: {
            type: String,
            trim: true,
            default: "",
        },
        status: {
            type: String,
            enum: CAR_WASH_STATUSES,
            default: "active",
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

CarWashSchema.index({ status: 1, name: 1 });

export default mongoose.model("CarWash", CarWashSchema);
