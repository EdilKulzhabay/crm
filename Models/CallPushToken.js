import mongoose from "mongoose";
import { PARTICIPANT_TYPES } from "../calls/callConstants.js";

export const PUSH_PLATFORMS = Object.freeze({ IOS: "ios", ANDROID: "android" });
export const APNS_ENVIRONMENTS = Object.freeze({ SANDBOX: "sandbox", PRODUCTION: "production" });

/**
 * Токены для пушей о входящих звонках: VoIP-токен PushKit (iOS) или FCM-токен (Android).
 * Хранятся отдельно от notificationPushToken(s) клиентов/курьеров: у VoIP-токена другой
 * жизненный цикл, и на iOS он не совпадает с обычным APNs/FCM-токеном.
 */
const CallPushTokenSchema = new mongoose.Schema(
    {
        participantType: {
            type: String,
            enum: Object.values(PARTICIPANT_TYPES),
            required: true,
        },
        participantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        platform: {
            type: String,
            enum: Object.values(PUSH_PLATFORMS),
            required: true,
        },
        token: {
            type: String,
            required: true,
        },
        /** Только для iOS: debug-сборки получают токены песочницы APNs */
        apnsEnvironment: {
            type: String,
            enum: [...Object.values(APNS_ENVIRONMENTS), null],
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Токен принадлежит одному устройству: при входе под другим аккаунтом он переезжает
CallPushTokenSchema.index({ token: 1 }, { unique: true });
CallPushTokenSchema.index({ participantType: 1, participantId: 1, updatedAt: -1 });

export default mongoose.model("CallPushToken", CallPushTokenSchema);
