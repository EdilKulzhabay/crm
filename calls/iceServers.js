import crypto from "crypto";
import { participantKey } from "./callPolicy.js";

/**
 * Учётка TURN должна жить дольше самого длинного звонка: coturn проверяет её
 * и при продлении allocation, так что истёкшая учётка оборвёт звонок.
 */
export const TURN_CREDENTIAL_TTL_SEC = 4 * 60 * 60;

const splitUrls = (value) =>
    (value || "")
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean);

/**
 * @returns {{ secret: string, turnUrls: string[], stunUrls: string[] } | null} null, если TURN не настроен
 */
export const readTurnConfig = (env = process.env) => {
    const secret = env.TURN_SECRET;
    const turnUrls = splitUrls(env.TURN_URLS);
    if (!secret || turnUrls.length === 0) return null;
    return { secret, turnUrls, stunUrls: splitUrls(env.STUN_URLS) };
};

/**
 * Временные учётные данные по схеме TURN REST API (coturn `use-auth-secret`):
 * username = "<expiry>:<id>", credential = base64(HMAC-SHA1(secret, username)).
 * Постоянный пароль TURN при этом никогда не попадает в приложение.
 *
 * @param {import("./callPolicy.js").Participant} participant
 * @param {{ secret: string, turnUrls: string[], stunUrls: string[] }} config
 * @param {number} nowMs
 */
export const buildIceServers = (participant, config, nowMs = Date.now()) => {
    const expiry = Math.floor(nowMs / 1000) + TURN_CREDENTIAL_TTL_SEC;
    const username = `${expiry}:${participantKey(participant)}`;
    const credential = crypto.createHmac("sha1", config.secret).update(username).digest("base64");

    const iceServers = [{ urls: config.turnUrls, username, credential }];
    if (config.stunUrls.length > 0) {
        iceServers.unshift({ urls: config.stunUrls });
    }
    return { iceServers, ttlSec: TURN_CREDENTIAL_TTL_SEC };
};
