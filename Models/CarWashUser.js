import mongoose from "mongoose";

/**
 * blocked — сотрудник не может войти в кабинет. Аккаунт не удаляется:
 * погашенные им купоны ссылаются на него.
 */
export const CAR_WASH_USER_STATUSES = Object.freeze(["active", "blocked"]);

/**
 * Сотрудник автомойки — пользователь кабинета автомойки в CRM.
 *
 * Отдельная коллекция, а не роль в User: у сотрудника мойки одно право —
 * проверить и погасить купон в своей точке. Если сделать его ролью User,
 * он прошёл бы checkAuth во все эндпоинты CRM.
 *
 * Создаёт только администратор CRM; вход по телефону и паролю.
 */
const CarWashUserSchema = new mongoose.Schema(
    {
        carWash: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CarWash",
            required: true,
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        /** Номер в том виде, в каком его ввёл администратор (для отображения) */
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        /** Нормализованный номер 7XXXXXXXXXX — логин, уникален */
        phoneNormalized: {
            type: String,
            required: true,
            unique: true,
            match: /^7\d{10}$/,
        },
        /** bcrypt-хэш. Не попадает в выборки по умолчанию — при входе запрашивать через .select("+password") */
        password: {
            type: String,
            required: true,
            select: false,
        },
        status: {
            type: String,
            enum: CAR_WASH_USER_STATUSES,
            default: "active",
        },
        lastLoginAt: {
            type: Date,
            default: null,
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

CarWashUserSchema.index({ carWash: 1, status: 1 });

export default mongoose.model("CarWashUser", CarWashUserSchema);
