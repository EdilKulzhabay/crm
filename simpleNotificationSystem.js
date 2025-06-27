#!/usr/bin/env node

import mongoose from 'mongoose';
import { autoTriggerManager } from './notificationManager.js';
import Order from './Models/Order.js';
import CourierAggregator from './Models/CourierAggregator.js';

/**
 * 🚀 УПРОЩЕННАЯ СИСТЕМА УВЕДОМЛЕНИЙ
 * С проверкой событий: новые заказы, курьеры на линии, завершение заказов
 */

class EventMonitor {
    constructor() {
        this.lastCheck = new Date();
        this.knownOrders = new Set();
        this.knownCouriers = new Map(); // courierID -> {onTheLine, ordersCount}
    }

    /**
     * 🔍 ПРОВЕРКА НОВЫХ ЗАКАЗОВ С forAggregator = true
     */
    async checkNewOrders() {
        try {
            // Проверяем соединение
            if (mongoose.connection.readyState !== 1) {
                console.log("⚠️ MongoDB не подключен, пропускаем проверку заказов");
                return false;
            }

            const newOrders = await Order.find({
                forAggregator: true,
                createdAt: { $gt: this.lastCheck },
                status: { $nin: ["onTheWay", "delivered", "cancelled"] }
            }).maxTimeMS(5000); // Таймаут 5 секунд

            if (newOrders.length > 0) {
                console.log(`📦 Найдено ${newOrders.length} новых заказов для агрегатора`);
                newOrders.forEach(order => {
                    console.log(`   📦 ${order.address?.actual || 'Адрес не указан'}`);
                    this.knownOrders.add(order._id.toString());
                });
                
                await autoTriggerManager.triggerOptimizationAndNotifications("new_orders_detected");
                return true;
            }
        } catch (error) {
            console.error("❌ Ошибка проверки новых заказов:", error.message);
        }
        return false;
    }

    /**
     * 👥 ПРОВЕРКА КУРЬЕРОВ, ВЫШЕДШИХ НА ЛИНИЮ
     */
    async checkCouriersOnline() {
        try {
            // Проверяем соединение
            if (mongoose.connection.readyState !== 1) {
                console.log("⚠️ MongoDB не подключен, пропускаем проверку курьеров");
                return false;
            }

            const currentCouriers = await CourierAggregator.find({
                status: "active"
            }).maxTimeMS(5000); // Таймаут 5 секунд

            let hasChanges = false;

            for (const courier of currentCouriers) {
                const courierId = courier._id.toString();
                const currentState = {
                    onTheLine: courier.onTheLine,
                    ordersCount: courier.orders?.length || 0
                };

                const previousState = this.knownCouriers.get(courierId);

                if (!previousState) {
                    // Новый курьер
                    this.knownCouriers.set(courierId, currentState);
                    if (currentState.onTheLine) {
                        console.log(`👤 Курьер ${courier.fullName} вышел на линию`);
                        hasChanges = true;
                    }
                } else {
                    // Проверяем изменения
                    if (!previousState.onTheLine && currentState.onTheLine) {
                        console.log(`👤 Курьер ${courier.fullName} вышел на линию`);
                        hasChanges = true;
                    }

                    // Проверяем завершение заказов (уменьшение количества)
                    if (previousState.ordersCount > currentState.ordersCount) {
                        const completedOrders = previousState.ordersCount - currentState.ordersCount;
                        console.log(`✅ Курьер ${courier.fullName} завершил ${completedOrders} заказов`);
                        hasChanges = true;
                    }

                    // Обновляем состояние
                    this.knownCouriers.set(courierId, currentState);
                }
            }

            if (hasChanges) {
                await autoTriggerManager.triggerOptimizationAndNotifications("courier_status_changed");
                return true;
            }
        } catch (error) {
            console.error("❌ Ошибка проверки курьеров:", error.message);
        }
        return false;
    }

    /**
     * 🔄 ПОЛНАЯ ПРОВЕРКА ВСЕХ СОБЫТИЙ
     */
    async checkAllEvents() {
        console.log(`🔍 Проверка событий: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })} (MongoDB: ${mongoose.connection.readyState === 1 ? '✅' : '❌'})`);
        
        const newOrdersFound = await this.checkNewOrders();
        const courierChanges = await this.checkCouriersOnline();

        if (!newOrdersFound && !courierChanges) {
            console.log("   ✅ Изменений не обнаружено");
        }

        // Обновляем время последней проверки
        this.lastCheck = new Date();
    }

    /**
     * 🚀 ИНИЦИАЛИЗАЦИЯ МОНИТОРИНГА
     */
    async initialize() {
        console.log("🔧 Инициализация мониторинга событий...");
        
        try {
            // Загружаем текущие заказы
            const existingOrders = await Order.find({
                forAggregator: true,
                status: { $nin: ["delivered", "cancelled"] }
            });
            
            existingOrders.forEach(order => {
                this.knownOrders.add(order._id.toString());
            });
            
            console.log(`   📦 Загружено ${existingOrders.length} существующих заказов`);

            // Загружаем текущих курьеров
            const existingCouriers = await CourierAggregator.find({
                status: "active"
            });

            existingCouriers.forEach(courier => {
                this.knownCouriers.set(courier._id.toString(), {
                    onTheLine: courier.onTheLine,
                    ordersCount: courier.orders?.length || 0
                });
            });

            console.log(`   👥 Загружено ${existingCouriers.length} курьеров`);
            console.log("✅ Мониторинг инициализирован");

        } catch (error) {
            console.error("❌ Ошибка инициализации мониторинга:", error.message);
        }
    }
}

/**
 * 🔌 НАСТРОЙКА ПОДКЛЮЧЕНИЯ К MONGODB
 */
async function connectToMongoDB() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/crm', {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 5,
            maxIdleTimeMS: 30000,
            bufferCommands: false,
            bufferMaxEntries: 0
        });
        console.log("✅ Подключение к MongoDB установлено");
        return true;
    } catch (error) {
        console.error("❌ Ошибка подключения к MongoDB:", error.message);
        return false;
    }
}

/**
 * 🔄 ПЕРЕПОДКЛЮЧЕНИЕ К MONGODB
 */
async function ensureMongoConnection() {
    if (mongoose.connection.readyState !== 1) {
        console.log("🔄 Переподключение к MongoDB...");
        await connectToMongoDB();
    }
}

async function startSimpleSystem() {
    try {
        console.log("🚀 ЗАПУСК УПРОЩЕННОЙ СИСТЕМЫ УВЕДОМЛЕНИЙ");
        console.log("=".repeat(60));
        console.log("📅 Время запуска:", new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }));
        console.log("=".repeat(60));

        // Подключение к MongoDB
        console.log("🔌 Подключение к MongoDB...");
        const connected = await connectToMongoDB();
        
        if (!connected) {
            console.log("❌ Не удалось подключиться к MongoDB. Выход...");
            process.exit(1);
        }

        // Обработка событий подключения
        mongoose.connection.on('disconnected', () => {
            console.log("⚠️ MongoDB отключен");
        });

        mongoose.connection.on('reconnected', () => {
            console.log("✅ MongoDB переподключен");
        });

        mongoose.connection.on('error', (err) => {
            console.error("❌ Ошибка MongoDB:", err.message);
        });

        // Создаем монитор событий
        const eventMonitor = new EventMonitor();
        await eventMonitor.initialize();

        // Запуск первоначальной оптимизации
        console.log("🗺️ Запуск первоначальной оптимизации...");
        await autoTriggerManager.triggerOptimizationAndNotifications("system_startup");

        console.log("=".repeat(60));
        console.log("✅ СИСТЕМА ЗАПУЩЕНА");
        console.log("=".repeat(60));
        console.log("🔍 Мониторинг событий:");
        console.log("   📦 Новые заказы с forAggregator: true");
        console.log("   👤 Курьеры выходят на линию (onTheLine: true)");
        console.log("   ✅ Завершение заказов курьерами");
        console.log("⏰ Проверка каждые 30 секунд");
        console.log("   Для остановки нажмите Ctrl+C");
        console.log("=".repeat(60));

        // Запускаем периодическую проверку каждые 30 секунд
        const intervalId = setInterval(async () => {
            await ensureMongoConnection();
            await eventMonitor.checkAllEvents();
        }, 30 * 1000); // 30 секунд

        // Обработка сигналов завершения
        const cleanup = async () => {
            console.log("\n🛑 Получен сигнал остановки...");
            clearInterval(intervalId);
            console.log("🔌 Закрытие подключения к MongoDB...");
            
            try {
                await mongoose.disconnect();
                console.log("✅ Подключение к MongoDB закрыто");
                console.log("👋 Система остановлена");
                process.exit(0);
            } catch (error) {
                console.error("❌ Ошибка при закрытии:", error.message);
                process.exit(1);
            }
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

    } catch (error) {
        console.error("❌ Ошибка запуска системы:", error.message);
        process.exit(1);
    }
}

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Необработанная ошибка Promise:', reason?.message || reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Необработанное исключение:', error.message);
    process.exit(1);
});

// Запуск системы
startSimpleSystem(); 