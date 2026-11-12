import mongoose from "mongoose";

/** blocked — партнёр не может войти. Аккаунт не удаляется: к нему привязаны курьеры */
export const DELIVERY_PARTNER_STATUSES = Object.freeze(["active", "blocked"]);

/**
 * Партнёр по доставке — компания/человек, чьи курьеры (CourierAggregator.deliveryPartner)
 * возят заказы «Тибетской». Видит в кабинете CRM только заказы своих курьеров, без данных клиента.
 *
 * Отдельная коллекция, а не роль User (как CarWashUser): роль User прошла бы checkAuth
 * во все эндпоинты CRM. Не путать с Partner — реферальными партнёрами клиентского приложения.
 *
 * Создаёт только суперадмин; вход по телефону и паролю.
 */
const DeliveryPartnerSchema = new mongoose.Schema(
    {
        name: {
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
            enum: DELIVERY_PARTNER_STATUSES,
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

export default mongoose.model("DeliveryPartner", DeliveryPartnerSchema);
