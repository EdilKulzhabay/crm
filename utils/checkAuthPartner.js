import mongoose from "mongoose";
import Partner from "../Models/Partner.js";
import { verifyPartnerToken } from "./partnerToken.js";

/**
 * Middleware авторизации партнёра. Партнёр определяется только по токену —
 * id из тела запроса не принимается (в отличие от клиентских /get…Mobile эндпоинтов).
 *
 * 401 — нет действующей сессии или аккаунт удалён (приложение очищает токен и открывает вход),
 * 403 — партнёр заблокирован.
 */
export function createCheckAuthPartner({
    verifyToken = verifyPartnerToken,
    findPartnerById = (id) => Partner.findById(id).lean(),
} = {}) {
    return async (req, res, next) => {
        const token = (req.headers.authorization || "").replace(/^Bearer\s?/, "");
        const partnerId = verifyToken(token);

        if (!partnerId || !mongoose.isValidObjectId(partnerId)) {
            return res.status(401).json({ success: false, message: "Требуется вход" });
        }

        try {
            const partner = await findPartnerById(partnerId);
            // Удалённый аккаунт — как отсутствующая сессия: приложение выходит на всех устройствах
            if (!partner || partner.status === "deleted") {
                return res.status(401).json({ success: false, message: "Требуется вход" });
            }
            if (partner.status !== "active") {
                return res.status(403).json({
                    success: false,
                    message: "Аккаунт партнёра заблокирован. Свяжитесь с поддержкой.",
                });
            }
            req.partnerId = String(partner._id);
            req.partner = partner;
            return next();
        } catch (error) {
            console.error("[Partner auth] checkAuthPartner:", error?.message || error);
            return res.status(500).json({ success: false, message: "Внутренняя ошибка сервера" });
        }
    };
}

export default createCheckAuthPartner();
