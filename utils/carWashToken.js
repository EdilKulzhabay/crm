import crypto from "crypto";
import jwt from "jsonwebtoken";

const TOKEN_TTL = "7d";
const KEY_DERIVATION_LABEL = "tibetskaya-carwash-jwt-v1";

/**
 * Токен сотрудника мойки подписан ключом, производным от SecretKey, — по той же причине,
 * что и партнёрский (utils/partnerToken.js): checkAuth и checkAuthAggregator принимают любой
 * токен на SecretKey, а сотрудник мойки не должен попасть в эндпоинты CRM.
 */
function carWashSigningKey(secret = process.env.SecretKey) {
    if (!secret) {
        throw new Error("SecretKey не задан: невозможно подписать токен сотрудника мойки");
    }
    return crypto.createHmac("sha256", secret).update(KEY_DERIVATION_LABEL).digest();
}

export function signCarWashToken(carWashUserId, secret) {
    return jwt.sign({ carWashUser: String(carWashUserId) }, carWashSigningKey(secret), { expiresIn: TOKEN_TTL });
}

/** Возвращает id сотрудника мойки или null, если токен невалиден, просрочен или чужой. */
export function verifyCarWashToken(token, secret) {
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, carWashSigningKey(secret));
        return typeof decoded?.carWashUser === "string" ? decoded.carWashUser : null;
    } catch {
        return null;
    }
}
