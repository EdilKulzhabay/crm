import jwt from "jsonwebtoken";
import User from "../Models/User.js";
import Courier from "../Models/Courier.js";
import Client from "../Models/Client.js";

export default async (req, res, next) => {
    const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.SecretKey);
            
            let userId, userType;

            if (decoded.client) {
                userId = decoded.client._id;
                userType = "client";
            } else {
                userId = decoded._id;
            }

            const user =
            (await User.findById(userId)) ||
            (await Courier.findById(userId)) ||
            (await Client.findById(userId));

            if (!user) {
                return res.status(403).json({ message: "Нет доступа" });
            }
            
            if (!userType) {
                if (user instanceof User) userType = "user";
                else if (user instanceof Courier) userType = "courier";
                else if (user instanceof Client) userType = "client";
            }
    
            req.userId = userId;
            req.userType = userType; // Передаем роль пользователя в req
            next();
        } catch (e) {
            return res.status(403).json({
                message: "Нет доступа",
            });
        }
    } else {
        return res.status(403).json({
            message: "Нет доступа",
        });
    }
};
