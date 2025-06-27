#!/usr/bin/env node

import mongoose from 'mongoose';
import CourierAggregator from './Models/CourierAggregator.js';
import Order from './Models/Order.js';
import { pushNotification } from "./pushNotification.js";

/**
 * 📱 УВЕДОМЛЕНИЯ КУРЬЕРАМ С ЗАКАЗАМИ
 * Ищет активных курьеров с заказами и отправляет им уведомления о первом заказе
 */

async function findCouriersWithOrders() {
    console.log("🔍 ПОИСК КУРЬЕРОВ С ЗАКАЗАМИ");
    console.log("=".repeat(50));
    
    try {
        // Подключение к MongoDB
        console.log("🔌 Подключение к MongoDB...");
        await mongoose.connect('mongodb://127.0.0.1:27017/crm');
        console.log("✅ Подключение установлено");

        // Ищем активных курьеров
        const activeCouriers = await CourierAggregator.find({
            status: "active",
            onTheLine: true
        });

        console.log(`👥 Найдено ${activeCouriers.length} активных курьеров на линии`);

        // Фильтруем курьеров С заказами
        const couriersWithOrders = activeCouriers.filter(courier => {
            const hasOrders = courier.orders && courier.orders.length > 0;
            console.log(`   👤 ${courier.fullName}: ${hasOrders ? `${courier.orders.length} заказов` : 'БЕЗ ЗАКАЗОВ'}`);
            return hasOrders;
        });

        console.log(`📦 Курьеров с заказами: ${couriersWithOrders.length}`);

        if (couriersWithOrders.length === 0) {
            console.log("❌ Нет курьеров с заказами");
            return;
        }

        console.log("=".repeat(50));

        // Отправляем уведомления курьерам с заказами о их первом заказе
        for (const courier of couriersWithOrders) {
            await sendNotificationAboutFirstOrder(courier);
        }

        console.log("=".repeat(50));
        console.log("✅ Уведомления отправлены");

    } catch (error) {
        console.error("❌ Ошибка:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Подключение к MongoDB закрыто");
    }
}

/**
 * 📨 ОТПРАВКА УВЕДОМЛЕНИЯ О ПЕРВОМ ЗАКАЗЕ
 */
async function sendNotificationAboutFirstOrder(courier) {
    try {
        console.log(`📱 Отправка уведомления: ${courier.fullName} (${courier.orders.length} заказов)`);

        // Проверяем наличие заказов
        if (!courier.orders || courier.orders.length === 0) {
            console.log(`   ⚠️ У курьера ${courier.fullName} нет заказов`);
            return;
        }

        // Получаем первый заказ (он уже содержит полные данные)
        const firstOrder = courier.orders[0];
        
        console.log(`   📍 Первый заказ: ${firstOrder.clientAddress || 'Адрес не указан'}`);
        console.log(`   📞 Клиент: ${firstOrder.clientTitle || 'Имя не указано'} (${firstOrder.clientPhone || 'Телефон не указан'})`);

        // Отправляем уведомление используя существующую функцию pushNotification
        await pushNotification(
            "newOrder",
            `Ваш первый заказ: ${firstOrder.clientAddress || 'Адрес не указан'}`,
            [courier.notificationPushToken || courier.notificationToken],
            "newOrder",
            firstOrder
        );

        console.log(`   ✅ Уведомление отправлено: ${courier.fullName}`);

    } catch (error) {
        console.error(`   ❌ Ошибка отправки уведомления ${courier.fullName}:`, error.message);
    }
}

/**
 * 📊 СТАТИСТИКА КУРЬЕРОВ
 */
async function showCourierStats() {
    try {
        const allCouriers = await CourierAggregator.find({});
        const activeCouriers = allCouriers.filter(c => c.status === "active");
        const onLineCouriers = activeCouriers.filter(c => c.onTheLine);
        const couriersWithOrders = onLineCouriers.filter(c => c.orders && c.orders.length > 0);
        const emptyCouriers = onLineCouriers.filter(c => !c.orders || c.orders.length === 0);

        console.log("\n📊 СТАТИСТИКА КУРЬЕРОВ:");
        console.log(`   👥 Всего курьеров: ${allCouriers.length}`);
        console.log(`   ✅ Активных: ${activeCouriers.length}`);
        console.log(`   🟢 На линии: ${onLineCouriers.length}`);
        console.log(`   📦 С заказами: ${couriersWithOrders.length}`);
        console.log(`   🆓 Без заказов: ${emptyCouriers.length}`);

        if (couriersWithOrders.length > 0) {
            console.log("\n📦 КУРЬЕРЫ С ЗАКАЗАМИ:");
            couriersWithOrders.forEach(courier => {
                console.log(`   • ${courier.fullName}: ${courier.orders.length} заказов (${courier.notificationPushToken || courier.notificationToken ? '📱' : '❌'})`);
            });
        }

    } catch (error) {
        console.error("❌ Ошибка получения статистики:", error.message);
    }
}

// Запуск скрипта
console.log("🚀 ЗАПУСК СИСТЕМЫ УВЕДОМЛЕНИЙ ДЛЯ КУРЬЕРОВ С ЗАКАЗАМИ");
console.log("📅 Время:", new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }));

findCouriersWithOrders(); 