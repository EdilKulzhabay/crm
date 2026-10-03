import http2 from "http2";
import jwt from "jsonwebtoken";

const APNS_HOSTS = Object.freeze({
    production: "https://api.push.apple.com",
    sandbox: "https://api.sandbox.push.apple.com",
});

/** Apple принимает provider token не старше часа и не чаще раза в 20 минут — обновляем раз в 40 */
const PROVIDER_TOKEN_TTL_MS = 40 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;

/** Причины, по которым токен больше не годится — его нужно удалить */
const INVALID_TOKEN_REASONS = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);
const HTTP_OK = 200;
const HTTP_GONE = 410;
const HTTP_FORBIDDEN = 403;

/**
 * Отправка VoIP-пушей через APNs HTTP/2 (без сторонних библиотек).
 * Сессия HTTP/2 на окружение переиспользуется: Apple просит не открывать соединение на каждый пуш.
 *
 * @param {{
 *   keyPem: string, keyId: string, teamId: string,
 *   now?: () => number,
 *   connect?: typeof http2.connect,
 *   signJwt?: typeof jwt.sign,
 * }} deps
 */
export const createApnsSender = ({ keyPem, keyId, teamId, now = Date.now, connect = http2.connect, signJwt = jwt.sign }) => {
    /** @type {Map<string, import("http2").ClientHttp2Session>} */
    const sessions = new Map();
    let providerToken = null;
    let providerTokenIssuedAt = 0;

    const getProviderToken = () => {
        if (!providerToken || now() - providerTokenIssuedAt > PROVIDER_TOKEN_TTL_MS) {
            providerTokenIssuedAt = now();
            providerToken = signJwt({ iss: teamId, iat: Math.floor(providerTokenIssuedAt / 1000) }, keyPem, {
                algorithm: "ES256",
                header: { alg: "ES256", kid: keyId },
            });
        }
        return providerToken;
    };

    const getSession = (environment) => {
        const existing = sessions.get(environment);
        if (existing && !existing.closed && !existing.destroyed) return existing;

        const session = connect(APNS_HOSTS[environment]);
        const drop = () => {
            if (sessions.get(environment) === session) sessions.delete(environment);
        };
        session.on("error", drop);
        session.on("goaway", drop);
        session.on("close", drop);
        sessions.set(environment, session);
        return session;
    };

    const toResult = (status, body) => {
        if (status === HTTP_OK) return { ok: true };
        let reason = `HTTP ${status || "no response"}`;
        try {
            reason = JSON.parse(body).reason || reason;
        } catch {
            // тело не JSON — оставляем статус
        }
        if (status === HTTP_FORBIDDEN) providerToken = null; // ExpiredProviderToken и т.п. — перевыпустить
        return { ok: false, isInvalidToken: status === HTTP_GONE || INVALID_TOKEN_REASONS.has(reason), reason };
    };

    /**
     * @param {{ token: string, environment: "sandbox" | "production", topic: string, payload: object }} message
     * @returns {Promise<{ ok: true } | { ok: false, isInvalidToken: boolean, reason: string }>}
     */
    const send = ({ token, environment, topic, payload }) =>
        new Promise((resolve) => {
            let request;
            try {
                request = getSession(environment).request({
                    ":method": "POST",
                    ":path": `/3/device/${token}`,
                    authorization: `bearer ${getProviderToken()}`,
                    "apns-topic": topic,
                    "apns-push-type": "voip",
                    "apns-priority": "10",
                    // 0 = доставить сейчас или никогда: звонок через минуту уже никому не нужен
                    "apns-expiration": "0",
                });
            } catch (error) {
                resolve({ ok: false, isInvalidToken: false, reason: error.message });
                return;
            }

            let status = 0;
            let body = "";
            request.setEncoding("utf8");
            request.setTimeout(REQUEST_TIMEOUT_MS, () => request.close(http2.constants.NGHTTP2_CANCEL));
            request.on("response", (headers) => {
                status = Number(headers[":status"]);
            });
            request.on("data", (chunk) => {
                body += chunk;
            });
            request.on("error", (error) => resolve({ ok: false, isInvalidToken: false, reason: error.message }));
            request.on("close", () => resolve(toResult(status, body)));
            request.end(JSON.stringify(payload));
        });

    const close = () => {
        sessions.forEach((session) => session.close());
        sessions.clear();
    };

    return Object.freeze({ send, close });
};
