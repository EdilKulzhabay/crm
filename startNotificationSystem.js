#!/usr/bin/env node

import mongoose from 'mongoose';
import { autoTriggerManager } from './notificationManager.js';

/**
 * 🚀 ЗАПУСК СИСТЕМЫ АВТОМАТИЧЕСКИХ УВЕДОМЛЕНИЙ
 * 
 * Этот скрипт:
 * 1. Подключается к MongoDB
 * 2. Запускает мониторинг изменений в базе данных
 * 3. Автоматически запускает оптимизацию маршрутов при:
 *    - Появлении новых заказов с forAggregator: true
 *    - Выходе курьера на линию (onTheLine: true)
 *    - Завершении заказа курьером
 * 4. Отправляет уведомления курьерам после оптимизации
 */

async function startSystem() {
    try {
        console.log("🚀 ЗАПУСК СИСТЕМЫ АВТОМАТИЧЕСКИХ УВЕДОМЛЕНИЙ");
        console.log("=".repeat(60));
        console.log("📅 Время запуска:", new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }));
        console.log("=".repeat(60));

        // Подключение к MongoDB
        console.log("🔌 Подключение к MongoDB...");
        await mongoose.connect('mongodb://127.0.0.1:27017/crm');
        console.log("✅ Подключение к MongoDB установлено");

        // Запуск мониторинга базы данных
        console.log("🔍 Запуск мониторинга изменений в базе данных...");
        await autoTriggerManager.startDatabaseMonitoring();

        // Запуск первоначальной оптимизации
        console.log("🗺️ Запуск первоначальной оптимизации...");
        await autoTriggerManager.triggerOptimizationAndNotifications("system_startup");

        console.log("=".repeat(60));
        console.log("✅ СИСТЕМА ЗАПУЩЕНА И ГОТОВА К РАБОТЕ");
        console.log("=".repeat(60));
        console.log("📊 Мониторинг активен для следующих событий:");
        console.log("   📦 Новые заказы с forAggregator: true");
        console.log("   👤 Курьеры выходят на линию (onTheLine: true)");
        console.log("   ✅ Завершение заказов курьерами");
        console.log("=".repeat(60));
        console.log("🔄 Система будет работать до остановки процесса");
        console.log("   Для остановки нажмите Ctrl+C");
        console.log("=".repeat(60));

    } catch (error) {
        console.error("❌ Ошибка запуска системы:", error);
        process.exit(1);
    }
}

// Обработка сигналов завершения
process.on('SIGINT', async () => {
    console.log("\n🛑 Получен сигнал остановки...");
    console.log("🔌 Закрытие подключения к MongoDB...");
    
    try {
        await mongoose.disconnect();
        console.log("✅ Подключение к MongoDB закрыто");
        console.log("👋 Система остановлена");
        process.exit(0);
    } catch (error) {
        console.error("❌ Ошибка при закрытии:", error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log("\n🛑 Получен сигнал завершения...");
    await mongoose.disconnect();
    console.log("✅ Система остановлена");
    process.exit(0);
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Необработанная ошибка Promise:', reason);
    console.error('Promise:', promise);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Необработанное исключение:', error);
    process.exit(1);
});

// Запуск системы
startSystem(); 