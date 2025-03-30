import {Expo} from "expo-server-sdk";
import admin from "firebase-admin"
import fs from 'fs';

// Чтение JSON-файла
const serviceAccount = JSON.parse(fs.readFileSync('./FireBase/tibetskaya-1bb8d-firebase-adminsdk-wjdpl-9f5b35bda3.json', 'utf8'));
// import serviceAccount from "./FireBase/tibetskaya-1bb8d-firebase-adminsdk-wjdpl-9f5b35bda3.json" assert { type: "json" };

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

let expo = new Expo({ useFcmV1: true });

export const pushNotification = async (messageTitle, messageBody, expoTokens, newStatus, orderId = null) => {
    for (const token of expoTokens) {
        if (Expo.isExpoPushToken(token)) {
            const message = {
                to: token,
                sound: "default",
                title: messageTitle,
                body: messageBody,
                priority: "high",
                data: {
                    newStatus,
                    ...(newStatus === "new Order" && orderId ? { orderId } : {}) // Добавляем orderId, если newStatus = "new Order"
                },
                _displayInForeground: true,
                contentAvailable: true,
            };

            try {
                const ticket = await expo.sendPushNotificationsAsync([message]);
                console.log("Push notification ticket:", ticket);
            } catch (error) {
                console.error("Error sending Expo push notification:", error);
            }
        } else {
            const message = {
                token, // Используем "token" вместо "to"
                notification: {
                    title: messageTitle,
                    body: messageBody,
                },
                data: {
                    newStatus: newStatus.toString(), // Убеждаемся, что newStatus строка
                    ...(newStatus === "new Order" && orderId ? { orderId: orderId.toString() } : {}) // Добавляем orderId как строку
                },
                android: {
                    priority: "high",
                },
                apns: {
                    headers: {
                        "apns-priority": "10",
                    },
                    payload: {
                        aps: {
                            sound: "default",
                            contentAvailable: true,
                        },
                    },
                },
            };

            // Отправляем уведомление через Firebase
            try {
                const response = await admin.messaging().send(message);
                console.log("Successfully sent message:", response);
            } catch (error) {
                console.error("Error sending Firebase message:", error);
            }
        }
    }
}