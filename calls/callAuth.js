import jwt from "jsonwebtoken";
import Client from "../Models/Client.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import { PARTICIPANT_TYPES } from "./callConstants.js";

/** @typedef {import("./callPolicy.js").Participant} Participant */

const INACTIVE_COURIER_STATUSES = ["inActive", "deleted"];

/**
 * Определяет участника звонка по access-токену мобильного приложения.
 * Форматы токенов: клиент — `{ client }` (MobileController), курьер — `{ _id, role: "courier" }`
 * (CourierAggregatorController). Остальные токены (CRM-пользователи и т.п.) звонить не могут.
 *
 * @param {unknown} token
 * @returns {Promise<Participant | null>}
 */
export const resolveCallParticipant = async (token) => {
    if (typeof token !== "string" || token.length === 0) return null;

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.SecretKey);
    } catch {
        return null;
    }

    if (decoded?.client) {
        const clientId = String(decoded.client._id || decoded.client);
        const exists = await Client.exists({ _id: clientId });
        return exists ? { type: PARTICIPANT_TYPES.CLIENT, id: clientId } : null;
    }

    if (decoded?.role === "courier" && decoded._id) {
        const courier = await CourierAggregator.findById(decoded._id).select("status").lean();
        if (!courier || INACTIVE_COURIER_STATUSES.includes(courier.status)) return null;
        return { type: PARTICIPANT_TYPES.COURIER, id: String(decoded._id) };
    }

    return null;
};

/** Express-middleware для REST-эндпоинтов звонков. */
export const checkCallAuth = async (req, res, next) => {
    try {
        const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");
        const participant = await resolveCallParticipant(token);
        if (!participant) {
            return res.status(403).json({ success: false, message: "Нет доступа" });
        }
        req.callParticipant = participant;
        next();
    } catch (error) {
        console.error("[calls] ошибка авторизации:", error);
        res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};
