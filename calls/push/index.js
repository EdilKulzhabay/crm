import { createApnsSender } from "./apnsSender.js";
import { createCallPushNotifier } from "./callPushNotifier.js";
import { createFcmSender, getFirebaseMessaging } from "./fcmSender.js";
import { readApnsConfig, readFirebaseConfig } from "./pushConfig.js";
import { mongoPushTokenRepository } from "./pushTokenRepository.js";

const createFcmFor = (options, missingWarning) => {
    const messaging = getFirebaseMessaging(options);
    if (!messaging) {
        console.warn(missingWarning);
        return null;
    }
    return createFcmSender(messaging);
};

/**
 * Собирает отправку пушей о звонках из env. Не настроенный канал отключается с предупреждением,
 * а не роняет CRM: звонки при открытом приложении продолжают работать через сокет.
 */
export const createCallPushNotifierFromEnv = () => {
    const apnsConfig = readApnsConfig();
    if (!apnsConfig) {
        console.warn("[calls] APNS_* не заданы — VoIP-пуши на iOS отключены");
    }
    const firebase = readFirebaseConfig();

    return createCallPushNotifier({
        tokenRepository: mongoPushTokenRepository,
        apns: apnsConfig ? createApnsSender(apnsConfig) : null,
        apnsTopics: apnsConfig?.topics ?? null,
        fcmByType: {
            client: createFcmFor(
                {
                    appName: "client-app", // уже создан в pushNotificationClient.js
                    fallbackAppName: "client-calls",
                    serviceAccountPath: firebase.clientServiceAccountPath,
                },
                "[calls] Firebase клиентского приложения не настроен — пуши о звонках клиентам на Android отключены"
            ),
            courier: createFcmFor(
                {
                    appName: "courier-calls",
                    fallbackAppName: "courier-calls",
                    serviceAccountPath: firebase.courierServiceAccountPath,
                },
                "[calls] COURIER_FIREBASE_SERVICE_ACCOUNT_PATH не задан — пуши о звонках курьерам на Android отключены"
            ),
        },
    });
};

export { mongoPushTokenRepository };
