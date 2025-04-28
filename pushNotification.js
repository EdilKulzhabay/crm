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

// Валидация входных данных
function validateNotificationData(messageTitle, messageBody, expoTokens, newStatus, order) {
    if (!messageTitle || typeof messageTitle !== 'string') {
        throw new Error('Неверный заголовок уведомления');
    }
    if (!messageBody || typeof messageBody !== 'string') {
        throw new Error('Неверное тело уведомления');
    }
    if (!Array.isArray(expoTokens) || expoTokens.length === 0) {
        throw new Error('Неверный массив токенов');
    }
    if (!newStatus || typeof newStatus !== 'string') {
        throw new Error('Неверный статус уведомления');
    }
    if (newStatus === "newOrder" && !order) {
        throw new Error('Отсутствуют данные заказа');
    }
}

export const pushNotification = async (messageTitle, messageBody, expoTokens, newStatus, order) => {
    try {
        // Валидация входных данных
        // validateNotificationData(messageTitle, messageBody, expoTokens, newStatus, order);

        console.log("expoTokens = ", expoTokens);
        console.log("messageTitle = ", messageTitle);
        console.log("messageBody = ", messageBody);
        console.log("newStatus = ", newStatus);
        console.log("order = ", order);

        // Фильтрация невалидных токенов
        const validTokens = expoTokens.filter(token => token && typeof token === 'string');
        if (validTokens.length === 0) {
            throw new Error('Нет валидных токенов для отправки');
        }

        console.log(`Отправка уведомления "${messageTitle}" на ${validTokens.length} устройств`);

        for (const token of validTokens) {
            try {
                if (Expo.isExpoPushToken(token)) {
                    // Отправка через Expo
                    const message = {
                        to: token,
                        sound: "default",
                        title: messageTitle,
                        body: messageBody,
                        priority: "high",
                        data: {
                            newStatus,
                            ...(newStatus === "newOrder" && order ? { order } : {})
                        },
                        _displayInForeground: true,
                        contentAvailable: true,
                    };

                    const ticket = await expo.sendPushNotificationsAsync([message]);
                    console.log("Expo push notification ticket:", ticket);
                } else {
                    // Отправка через Firebase
                    const message = {
                        token,
                        notification: {
                            title: messageTitle,
                            body: messageBody,
                        },
                        data: {
                            newStatus: newStatus.toString(),
                            ...(newStatus === "newOrder" && order ? { order: JSON.stringify(order) } : {})
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

                    const response = await admin.messaging().send(message);
                    console.log("Firebase message sent successfully:", response);
                }
            } catch (tokenError) {
                console.error(`Ошибка при отправке уведомления на токен ${token}:`, tokenError);
                // Продолжаем отправку на другие токены
            }
        }
    } catch (error) {
        console.error("Критическая ошибка при отправке уведомлений:", error);
        throw error;
    }
}