import crypto from "crypto";
import jwt from "jsonwebtoken";

const TOKEN_TTL = "7d";
const KEY_DERIVATION_LABEL = "tibetskaya-delivery-partner-jwt-v1";

/**
 * Токен партнёра по доставке подписан ключом, производным от SecretKey (как utils/carWashToken.js):
 * checkAuth и checkAuthAggregator принимают любой токен на SecretKey, а партнёр не должен
 * попасть в эндпоинты CRM и приложения курьера.
 */
function deliveryPartnerSigningKey(secret = process.env.SecretKey) {
    if (!secret) {
        throw new Error("SecretKey не задан: невозможно подписать токен партнёра по доставке");
    }
    return crypto.createHmac("sha256", secret).update(KEY_DERIVATION_LABEL).digest();
}

export function signDeliveryPartnerToken(deliveryPartnerId, secret) {
    return jwt.sign({ deliveryPartner: String(deliveryPartnerId) }, deliveryPartnerSigningKey(secret), {
        expiresIn: TOKEN_TTL,
    });
}

/** Возвращает id партнёра или null, если токен невалиден, просрочен или чужой. */
export function verifyDeliveryPartnerToken(token, secret) {
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, deliveryPartnerSigningKey(secret));
        return typeof decoded?.deliveryPartner === "string" ? decoded.deliveryPartner : null;
    } catch {
        return null;
    }
}
