import fs from "fs";
import admin from "firebase-admin";

const INVALID_TOKEN_CODES = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
]);

/**
 * Берёт уже инициализированное приложение firebase-admin по имени (например, "client-app"
 * из pushNotificationClient.js) или создаёт новое из service account.
 * @returns {import("firebase-admin").messaging.Messaging | null}
 */
export const getFirebaseMessaging = ({ appName, fallbackAppName, serviceAccountPath }) => {
    const existing = admin.apps.find((app) => app?.name === appName || app?.name === fallbackAppName);
    if (existing) return admin.messaging(existing);
    if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) return null;

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }, fallbackAppName);
    return admin.messaging(app);
};

/**
 * Data-only сообщения с высоким приоритетом: только они будят убитое приложение на Android
 * и попадают в фоновый обработчик, который показывает экран входящего звонка.
 * @param {{ send: (message: object) => Promise<string> }} messaging
 */
export const createFcmSender = (messaging) => {
    /**
     * @param {{ token: string, data: Record<string, string>, ttlMs: number }} message
     * @returns {Promise<{ ok: true } | { ok: false, isInvalidToken: boolean, reason: string }>}
     */
    const send = async ({ token, data, ttlMs }) => {
        try {
            await messaging.send({ token, data, android: { priority: "high", ttl: ttlMs } });
            return { ok: true };
        } catch (error) {
            const code = error?.code || error?.errorInfo?.code || "unknown";
            return { ok: false, isInvalidToken: INVALID_TOKEN_CODES.has(code), reason: code };
        }
    };
    return Object.freeze({ send });
};
