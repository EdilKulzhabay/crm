import mongoose from "mongoose";
import DeliveryPartner from "../Models/DeliveryPartner.js";
import { verifyDeliveryPartnerToken } from "./deliveryPartnerToken.js";

/**
 * Middleware кабинета партнёра по доставке. Партнёр — только из токена.
 * 401 — нет действующей сессии; 403 — партнёр заблокирован.
 */
export function createCheckAuthDeliveryPartner({
    verifyToken = verifyDeliveryPartnerToken,
    findPartnerById = (id) => DeliveryPartner.findById(id).lean(),
} = {}) {
    return async (req, res, next) => {
        const token = (req.headers.authorization || "").replace(/^Bearer\s?/, "");
        const partnerId = verifyToken(token);
        if (!partnerId || !mongoose.isValidObjectId(partnerId)) {
            return res.status(401).json({ success: false, message: "Требуется вход" });
        }

        try {
            const partner = await findPartnerById(partnerId);
            if (!partner) return res.status(401).json({ success: false, message: "Требуется вход" });
            if (partner.status !== "active") {
                return res.status(403).json({ success: false, message: "Доступ к кабинету закрыт. Обратитесь к администратору." });
            }
            req.deliveryPartner = partner;
            return next();
        } catch (error) {
            console.error("[DeliveryPartner auth] checkAuthDeliveryPartner:", error?.message || error);
            return res.status(500).json({ success: false, message: "Внутренняя ошибка сервера" });
        }
    };
}

export default createCheckAuthDeliveryPartner();
