import admin from "firebase-admin"
import fs from 'fs';

// Чтение JSON-файла
const serviceAccount = JSON.parse(fs.readFileSync('./FireBase/tibetskayaclientapp-88b45-firebase-adminsdk-fbsvc-b11b56d42a.json', 'utf8'));
// import serviceAccount from "./FireBase/tibetskaya-1bb8d-firebase-adminsdk-wjdpl-9f5b35bda3.json" assert { type: "json" };

// Инициализируем Firebase для клиентского приложения с уникальным именем
if (!admin.apps.find(app => app.name === 'client-app')) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    }, 'client-app');
}

// Система отслеживания отправленных уведомлений для предотвращения дублирования
const sentNotifications = new Map();
const NOTIFICATION_DEDUP_WINDOW = 30000; // 30 секунд для дедупликации

// Валидация входных данных
function validateNotificationData(messageTitle, messageBody, notificationTokens, newStatus, order) {
    if (!messageTitle || typeof messageTitle !== 'string') {
        throw new Error('Неверный заголовок уведомления');
    }
    if (!messageBody || typeof messageBody !== 'string') {
        throw new Error('Неверное тело уведомления');
    }
    if (!Array.isArray(notificationTokens) || notificationTokens.length === 0) {
        throw new Error('Неверный массив токенов');
    }
    if (!newStatus || typeof newStatus !== 'string') {
        throw new Error('Неверный статус уведомления');
    }
    if (newStatus === "newOrder" && !order) {
        throw new Error('Отсутствуют данные заказа');
    }
}

// Функция для создания уникального ключа уведомления
function createNotificationKey(messageTitle, messageBody, notificationTokens, newStatus, order) {
    const orderId = order?.orderId || order?._id || 'no-order';
    const tokensHash = notificationTokens.sort().join('|');
    return `${messageTitle}_${messageBody}_${tokensHash}_${newStatus}_${orderId}`;
}

export const pushNotificationClient = async (messageTitle, messageBody, notificationTokens, newStatus, order) => {
    try {
        // Валидация входных данных
        // validateNotificationData(messageTitle, messageBody, notificationTokens, newStatus, order);

        console.log("notificationTokens = ", notificationTokens);
        console.log("messageTitle = ", messageTitle);
        console.log("messageBody = ", messageBody);
        console.log("newStatus = ", newStatus);
        console.log("order = ", order);

        // Фильтрация невалидных токенов
        const validTokens = notificationTokens.filter(token => token && typeof token === 'string');
        if (validTokens.length === 0) {
            throw new Error('Нет валидных токенов для отправки');
        }

        // ПРОВЕРКА НА ДУБЛИКАТЫ: Создаем уникальный ключ для уведомления
        const notificationKey = createNotificationKey(messageTitle, messageBody, validTokens, newStatus, order);
        const now = Date.now();
        
        // Проверяем, не было ли уже отправлено такое же уведомление недавно
        const lastSent = sentNotifications.get(notificationKey);
        if (lastSent && (now - lastSent) < NOTIFICATION_DEDUP_WINDOW) {
            const remainingTime = Math.ceil((NOTIFICATION_DEDUP_WINDOW - (now - lastSent)) / 1000);
            console.log(`⚠️  ДУБЛИКАТ: пропускаем (${remainingTime} сек назад)`);
            return;
        }

        console.log(`Отправка уведомления "${messageTitle}" на ${validTokens.length} устройств`);

        let successCount = 0;
        let errorCount = 0;

        for (const token of validTokens) {
            try {
                // Подготавливаем данные с гарантией строкового типа
                const messageData = {
                    newStatus: newStatus.toString(),
                    order: order ? JSON.stringify(order) : '{}',
                    orderId: (order?._id || order?.orderId || 'unknown').toString(),
                    orderStatus: (order?.status || newStatus || 'unknown').toString(),
                };

                // Проверяем, что все значения являются строками
                for (const [key, value] of Object.entries(messageData)) {
                    if (typeof value !== 'string') {
                        console.error(`Поле ${key} не является строкой:`, typeof value, value);
                        messageData[key] = String(value);
                    }
                }

                console.log("Отправляемые данные:", messageData);

                const message = {
                    token,
                    notification: {
                        title: messageTitle,
                        body: messageBody,
                    },
                    data: messageData,
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

                const response = await admin.app('client-app').messaging().send(message);
                console.log("Firebase message sent successfully:", response);
                successCount++;
            } catch (tokenError) {
                console.error(`Ошибка при отправке уведомления на токен ${token}:`, tokenError);
                errorCount++;
                // Продолжаем отправку на другие токены
            }
        }

        // Отмечаем уведомление как отправленное только если была хотя бы одна успешная отправка
        if (successCount > 0) {
            sentNotifications.set(notificationKey, now);
            console.log(`✅ Уведомление успешно отправлено: ${successCount} успешно, ${errorCount} ошибок`);
            
            // Очищаем старые записи (старше 5 минут)
            const cleanupTime = now - (5 * 60 * 1000);
            for (const [key, timestamp] of sentNotifications.entries()) {
                if (timestamp < cleanupTime) {
                    sentNotifications.delete(key);
                }
            }
        } else {
            console.log(`❌ Не удалось отправить уведомление ни на одно устройство`);
        }

    } catch (error) {
        console.error("Критическая ошибка при отправке уведомлений:", error);
        throw error;
    }
}