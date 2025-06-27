#!/usr/bin/env node

import mongoose from 'mongoose';
import CourierAggregator from './Models/CourierAggregator.js';
import Order from './Models/Order.js';
import { sendPushNotification } from './notificationManager.js';

/**
 * 📱 УВЕДОМЛЕНИЯ КУРЬЕРАМ БЕЗ ЗАКАЗОВ
 * Ищет активных курьеров без заказов и отправляет им уведомления о первом доступном заказе
 */

async function findEmptyCouriers() {
    console.log("🔍 ПОИСК КУРЬЕРОВ БЕЗ ЗАКАЗОВ");
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

        // Фильтруем курьеров без заказов
        const emptyCouriers = activeCouriers.filter(courier => {
            const hasOrders = courier.orders && courier.orders.length > 0;
            console.log(`   👤 ${courier.fullName}: ${hasOrders ? `${courier.orders.length} заказов` : 'БЕЗ ЗАКАЗОВ'}`);
            return !hasOrders;
        });

        console.log(`📦 Курьеров без заказов: ${emptyCouriers.length}`);

        if (emptyCouriers.length === 0) {
            console.log("✅ Все курьеры имеют заказы");
            return;
        }

        // Ищем первый доступный заказ
        const availableOrder = await Order.findOne({
            forAggregator: true,
            status: { $nin: ["onTheWay", "delivered", "cancelled"] },
            courier: { $exists: false }
        }).sort({ createdAt: 1 });

        if (!availableOrder) {
            console.log("❌ Нет доступных заказов для назначения");
            return;
        }

        console.log(`📍 Найден заказ: ${availableOrder.address?.actual || 'Адрес не указан'}`);
        console.log("=".repeat(50));

        // Отправляем уведомления курьерам без заказов
        for (const courier of emptyCouriers) {
            await sendNotificationToEmptyCourier(courier, availableOrder);
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
 * 📨 ОТПРАВКА УВЕДОМЛЕНИЯ КУРЬЕРУ
 */
async function sendNotificationToEmptyCourier(courier, order) {
    try {
        console.log(`📱 Отправка уведомления: ${courier.fullName}`);

        // Проверяем наличие токена
        if (!courier.notificationToken) {
            console.log(`   ⚠️ У курьера ${courier.fullName} нет токена уведомлений`);
            return;
        }

        // Формируем данные уведомления
        const notificationData = {
            title: "🚀 Новый заказ доступен!",
            body: `Заказ по адресу: ${order.address?.actual || 'Адрес не указан'}`,
            data: {
                type: "new_order_available",
                orderId: order._id.toString(),
                address: order.address?.actual || '',
                customerPhone: order.customerPhone || '',
                orderTime: order.createdAt.toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })
            }
        };

        // Отправляем уведомление
        const result = await sendPushNotification(courier.notificationToken, notificationData);

        if (result.success) {
            console.log(`   ✅ Уведомление отправлено: ${courier.fullName}`);
        } else {
            console.log(`   ❌ Ошибка отправки: ${courier.fullName} - ${result.error}`);
        }

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

        if (emptyCouriers.length > 0) {
            console.log("\n🆓 КУРЬЕРЫ БЕЗ ЗАКАЗОВ:");
            emptyCouriers.forEach(courier => {
                console.log(`   • ${courier.fullName} (${courier.notificationToken ? '📱' : '❌'})`);
            });
        }

    } catch (error) {
        console.error("❌ Ошибка получения статистики:", error.message);
    }
}

// Запуск скрипта
console.log("🚀 ЗАПУСК СИСТЕМЫ УВЕДОМЛЕНИЙ ДЛЯ ПУСТЫХ КУРЬЕРОВ");
console.log("📅 Время:", new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }));

findEmptyCouriers(); 