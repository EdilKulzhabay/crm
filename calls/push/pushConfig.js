import fs from "fs";

/** Сколько устройств одного участника получают пуши о звонке (старые токены вытесняются) */
export const MAX_PUSH_TOKENS_PER_PARTICIPANT = 5;

/**
 * Конфигурация APNs (VoIP-пуши iOS). Ключ — .p8 из developer.apple.com → Keys
 * (тип «Apple Push Notifications service»), один на Team для обоих приложений.
 * @returns {{ keyPem: string, keyId: string, teamId: string, topics: { client: string, courier: string } } | null}
 */
export const readApnsConfig = (env = process.env, readFile = fs.readFileSync) => {
    const { APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID_CLIENT, APNS_BUNDLE_ID_COURIER } = env;
    if (!APNS_KEY_PATH || !APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID_CLIENT || !APNS_BUNDLE_ID_COURIER) {
        return null;
    }
    return {
        keyPem: readFile(APNS_KEY_PATH, "utf8"),
        keyId: APNS_KEY_ID,
        teamId: APNS_TEAM_ID,
        // Для VoIP-пушей topic = bundle id + ".voip"
        topics: {
            client: `${APNS_BUNDLE_ID_CLIENT}.voip`,
            courier: `${APNS_BUNDLE_ID_COURIER}.voip`,
        },
    };
};

/**
 * Service account'ы Firebase. Приложения в разных проектах: клиент — tibetskayaclientapp-88b45,
 * курьер — courier-74d57 (не путать с tibetskaya-1bb8d, через который CRM шлёт курьерам обычные пуши).
 */
export const readFirebaseConfig = (env = process.env) => ({
    clientServiceAccountPath: env.CLIENT_FIREBASE_SERVICE_ACCOUNT_PATH || null,
    courierServiceAccountPath: env.COURIER_FIREBASE_SERVICE_ACCOUNT_PATH || null,
});
