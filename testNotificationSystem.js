import mongoose from 'mongoose';
import { NotificationManager } from './notificationManager.js';

/**
 * 🧪 ТЕСТИРОВАНИЕ СИСТЕМЫ УВЕДОМЛЕНИЙ
 * Этот скрипт позволяет протестировать отправку уведомлений курьерам
 */

async function testNotificationSystem() {
    try {
        console.log("🧪 ТЕСТИРОВАНИЕ СИСТЕМЫ УВЕДОМЛЕНИЙ");
        console.log("=".repeat(60));

        // Подключение к MongoDB
        console.log("🔌 Подключение к MongoDB...");
        await mongoose.connect('mongodb://127.0.0.1:27017/crm');
        console.log("✅ Подключение к MongoDB установлено");

        // Создаем экземпляр менеджера уведомлений
        const notificationManager = new NotificationManager();

        // Запускаем процесс отправки уведомлений
        console.log("📱 Запуск тестирования уведомлений...");
        await notificationManager.startNotificationProcess();

        console.log("✅ Тестирование завершено");

    } catch (error) {
        console.error("❌ Ошибка при тестировании:", error);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Подключение к MongoDB закрыто");
        process.exit(0);
    }
}

// Запуск тестирования
testNotificationSystem(); 