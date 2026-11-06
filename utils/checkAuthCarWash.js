import mongoose from "mongoose";
import CarWash from "../Models/CarWash.js";
import CarWashUser from "../Models/CarWashUser.js";
import { verifyCarWashToken } from "./carWashToken.js";

/**
 * Middleware кабинета мойки. Сотрудник и его точка — только из токена.
 * 401 — нет действующей сессии; 403 — сотрудник или мойка заблокированы.
 */
export function createCheckAuthCarWash({
    verifyToken = verifyCarWashToken,
    findUserById = (id) => CarWashUser.findById(id).lean(),
    findCarWashById = (id) => CarWash.findById(id).lean(),
} = {}) {
    return async (req, res, next) => {
        const token = (req.headers.authorization || "").replace(/^Bearer\s?/, "");
        const userId = verifyToken(token);
        if (!userId || !mongoose.isValidObjectId(userId)) {
            return res.status(401).json({ success: false, message: "Требуется вход" });
        }

        try {
            const user = await findUserById(userId);
            if (!user) return res.status(401).json({ success: false, message: "Требуется вход" });
            const carWash = await findCarWashById(user.carWash);
            if (user.status !== "active" || carWash?.status !== "active") {
                return res.status(403).json({ success: false, message: "Доступ к кабинету закрыт. Обратитесь к администратору." });
            }
            req.carWashUser = user;
            req.carWash = carWash;
            return next();
        } catch (error) {
            console.error("[CarWash auth] checkAuthCarWash:", error?.message || error);
            return res.status(500).json({ success: false, message: "Внутренняя ошибка сервера" });
        }
    };
}

export default createCheckAuthCarWash();
