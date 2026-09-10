import crypto from "crypto";

/**
 * Отдельная авторизация для внешнего партнёра (рекламное агентство), не связанная
 * с JWT-сессиями CRM/курьеров/клиентов. Ключ передаётся в заголовке x-api-key
 * и сверяется с ADS_API_KEY из .env через timingSafeEqual (защита от timing-атак).
 */
export default (req, res, next) => {
    const expectedKey = process.env.ADS_API_KEY;

    if (!expectedKey) {
        console.log("ADS_API_KEY не задан в .env");
        return res.status(500).json({
            success: false,
            message: "Сервис временно недоступен",
        });
    }

    const providedKey = req.headers["x-api-key"];

    if (!providedKey || typeof providedKey !== "string") {
        return res.status(401).json({
            success: false,
            message: "Нет доступа",
        });
    }

    const provided = Buffer.from(providedKey);
    const expected = Buffer.from(expectedKey);

    const isValid =
        provided.length === expected.length &&
        crypto.timingSafeEqual(provided, expected);

    if (!isValid) {
        return res.status(401).json({
            success: false,
            message: "Нет доступа",
        });
    }

    next();
};
