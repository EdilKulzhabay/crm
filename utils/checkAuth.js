import jwt from "jsonwebtoken";
import User from "../Models/User.js";
import Courier from "../Models/Courier.js";
import Client from "../Models/Client.js";
import Department from "../Models/Department.js";

/**
 * Ошибки авторизации отдаём 403, как раньше: CRM (client/src/api.js) по 403 уводит на вход.
 * `code` говорит клиентскому приложению, что токен можно обновить через /refreshToken
 * (TOKEN_EXPIRED / TOKEN_INVALID / TOKEN_MISSING) или аккаунта больше нет (USER_NOT_FOUND).
 * Сбой базы — 500, а не «Нет доступа»: иначе временная ошибка выкидывала бы из аккаунта.
 */
export const AUTH_ERROR_CODES = Object.freeze({
    missing: "TOKEN_MISSING",
    expired: "TOKEN_EXPIRED",
    invalid: "TOKEN_INVALID",
    userNotFound: "USER_NOT_FOUND",
});

const denyAccess = (res, code) => res.status(403).json({ message: "Нет доступа", code });

function verifyToken(token) {
    try {
        return { decoded: jwt.verify(token, process.env.SecretKey) };
    } catch (error) {
        return { code: error.name === "TokenExpiredError" ? AUTH_ERROR_CODES.expired : AUTH_ERROR_CODES.invalid };
    }
}

function resolveUserType(user) {
    if (user instanceof User) return "user";
    if (user instanceof Courier) return "courier";
    if (user instanceof Client) return "client";
    if (user instanceof Department) return "department";
    return undefined;
}

export default async (req, res, next) => {
    const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");
    if (!token) {
        return denyAccess(res, AUTH_ERROR_CODES.missing);
    }

    const { decoded, code } = verifyToken(token);
    if (!decoded) {
        console.warn(`checkAuth: ${code} ${req.method} ${req.path}`);
        return denyAccess(res, code);
    }

    let userId;
    let userType;
    if (decoded.client) {
        userId = decoded.client._id || decoded.client;
        userType = "client";
    } else {
        userId = decoded._id;
    }

    let user;
    try {
        user =
            (await User.findById(userId)) ||
            (await Courier.findById(userId)) ||
            (await Client.findById(userId)) ||
            (await Department.findById(userId));
    } catch (error) {
        console.error(`checkAuth: ошибка поиска пользователя ${req.method} ${req.path}:`, error);
        return res.status(500).json({ message: "Сервис временно недоступен, попробуйте позже" });
    }

    if (!user) {
        console.warn(`checkAuth: ${AUTH_ERROR_CODES.userNotFound} ${req.method} ${req.path}`);
        return denyAccess(res, AUTH_ERROR_CODES.userNotFound);
    }

    req.userId = userId;
    req.userType = userType || resolveUserType(user); // Передаем роль пользователя в req
    next();
};
