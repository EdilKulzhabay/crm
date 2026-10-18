import crypto from "crypto";
import jwt from "jsonwebtoken";

const TOKEN_TTL = "30d"; // как у клиентского приложения
const KEY_DERIVATION_LABEL = "tibetskaya-partner-jwt-v1";

/**
 * Партнёрские токены подписываются ключом, производным от SecretKey, а не самим SecretKey.
 *
 * Почему: checkAuthAggregator принимает ЛЮБОЙ токен, подписанный SecretKey, не проверяя
 * его тип. Общий ключ означал бы, что партнёрский токен проходит в эндпоинты агрегаторов.
 * Производный ключ исключает это без новой переменной окружения: токен партнёра
 * не верифицируется ни checkAuth, ни checkAuthAggregator, и наоборот.
 */
function partnerSigningKey(secret = process.env.SecretKey) {
    if (!secret) {
        throw new Error("SecretKey не задан: невозможно подписать токен партнёра");
    }
    return crypto.createHmac("sha256", secret).update(KEY_DERIVATION_LABEL).digest();
}

export function signPartnerToken(partnerId, secret) {
    return jwt.sign({ partner: String(partnerId) }, partnerSigningKey(secret), {
        expiresIn: TOKEN_TTL,
    });
}

/** Возвращает id партнёра или null, если токен невалиден, просрочен или не партнёрский. */
export function verifyPartnerToken(token, secret) {
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, partnerSigningKey(secret));
        return typeof decoded?.partner === "string" ? decoded.partner : null;
    } catch {
        return null;
    }
}
