import { APNS_ENVIRONMENTS, PUSH_PLATFORMS } from "../../Models/CallPushToken.js";
import { CALL_ERROR_CODES, CallError } from "../callErrors.js";
import { parseDeviceId } from "../callPolicy.js";

/** VoIP-токен PushKit — hex (сейчас 64 символа, Apple не гарантирует длину) */
const IOS_TOKEN_PATTERN = /^[0-9a-f]{64,200}$/i;
/** FCM-токен — base64url с «:», длина ~150–200 символов */
const ANDROID_TOKEN_PATTERN = /^[\w:-]{20,4096}$/;

const invalid = (message) => new CallError(CALL_ERROR_CODES.VALIDATION, message);

/**
 * @param {unknown} body
 * @returns {{ platform: "ios" | "android", token: string, apnsEnvironment: string | null, deviceId: string | null }}
 */
export const parsePushTokenInput = (body) => {
    const { platform, token, apnsEnvironment } = body ?? {};
    // Старые версии приложения не передают deviceId — токен считается «на весь аккаунт»
    const deviceId = parseDeviceId(body?.deviceId);

    if (platform === PUSH_PLATFORMS.IOS) {
        if (typeof token !== "string" || !IOS_TOKEN_PATTERN.test(token)) throw invalid("Некорректный VoIP-токен");
        if (!Object.values(APNS_ENVIRONMENTS).includes(apnsEnvironment)) throw invalid("Некорректное окружение APNs");
        return { platform, token: token.toLowerCase(), apnsEnvironment, deviceId };
    }

    if (platform === PUSH_PLATFORMS.ANDROID) {
        if (typeof token !== "string" || !ANDROID_TOKEN_PATTERN.test(token)) throw invalid("Некорректный FCM-токен");
        return { platform, token, apnsEnvironment: null, deviceId };
    }

    throw invalid("Некорректная платформа");
};

/** @param {unknown} body */
export const parseTokenOnly = (body) => {
    const token = body?.token;
    if (typeof token !== "string" || token.length === 0 || token.length > 4096) throw invalid("Некорректный токен");
    return token;
};
