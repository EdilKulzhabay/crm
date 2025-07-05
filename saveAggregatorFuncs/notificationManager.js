import mongoose from 'mongoose';
import Order from '../Models/Order.js';
import CourierAggregator from '../Models/CourierAggregator.js';
import { pushNotification } from '../pushNotification.js';
import { zoneBasedDistribution } from './optimizeRoutes.js';

/**
 * 📱 МЕНЕДЖЕР УВЕДОМЛЕНИЙ ДЛЯ КУРЬЕРОВ
 * Автоматически отправляет уведомления курьерам после оптимизации маршрутов
 */
class NotificationManager {
    constructor() {
        this.processingCouriers = new Set(); // Курьеры, которые сейчас обрабатываются
        this.waitingTime = 20000; // 20 секунд ожидания
    }

    /**
     * 🚀 ЗАПУСК ПРОЦЕССА ОТПРАВКИ УВЕДОМЛЕНИЙ
     */
    async startNotificationProcess() {
        console.log("🚀 ЗАПУСК АВТОМАТИЧЕСКОЙ ОТПРАВКИ УВЕДОМЛЕНИЙ");
        console.log("=".repeat(60));

        try {
            // Получаем всех активных курьеров с заказами
            const couriers = await CourierAggregator.find({
                onTheLine: true,
                status: "active",
                "orders.0": { $exists: true } // У курьера есть хотя бы один заказ
            });

            if (couriers.length === 0) {
                console.log("📭 Нет курьеров с заказами для отправки уведомлений");
                return;
            }

            console.log(`👥 Найдено курьеров с заказами: ${couriers.length}`);

            // Обрабатываем каждого курьера параллельно
            const processingPromises = couriers.map(courier => 
                this.processCourierNotifications(courier)
            );

            await Promise.all(processingPromises);

            console.log("✅ Процесс отправки уведомлений завершен");

        } catch (error) {
            console.error("❌ Ошибка в процессе отправки уведомлений:", error);
        }
    }

    /**
     * 👤 ОБРАБОТКА УВЕДОМЛЕНИЙ ДЛЯ ОДНОГО КУРЬЕРА
     */
    async processCourierNotifications(courier) {
        const courierId = courier._id.toString();
        
        // Проверяем, не обрабатывается ли уже этот курьер
        if (this.processingCouriers.has(courierId)) {
            console.log(`⏳ Курьер ${courier.fullName} уже обрабатывается`);
            return;
        }

        this.processingCouriers.add(courierId);

        try {
            console.log(`\n👤 ОБРАБОТКА КУРЬЕРА: ${courier.fullName}`);
            console.log(`📦 Заказов в очереди: ${courier.orders.length}`);

            // Отправляем уведомления по порядку
            for (let orderIndex = 0; orderIndex < courier.orders.length; orderIndex++) {
                const order = courier.orders[orderIndex];
                
                // Проверяем статус заказа - если уже принят, пропускаем
                if (order.status === "onTheWay") {
                    console.log(`   ✅ Заказ ${orderIndex + 1} уже принят, пропускаем`);
                    continue;
                }

                console.log(`   📱 Отправляем уведомление о заказе ${orderIndex + 1}:`);
                console.log(`      📍 ${order.clientAddress}`);
                console.log(`      📦 ${this.formatProductsMessage(order.products)}`);

                // Отправляем уведомление
                const notificationSent = await this.sendOrderNotification(courier, order);
                
                if (!notificationSent) {
                    console.log(`   ❌ Не удалось отправить уведомление`);
                    continue;
                }

                // Ждем 20 секунд
                console.log(`   ⏱️ Ожидаем ${this.waitingTime / 1000} секунд...`);
                await this.sleep(this.waitingTime);

                // Проверяем статус заказа
                const orderAccepted = await this.checkOrderAcceptance(order.orderId);
                
                if (orderAccepted) {
                    console.log(`   ✅ Заказ ${orderIndex + 1} принят курьером!`);
                    break; // Курьер принял заказ, останавливаем отправку
                } else {
                    console.log(`   ❌ Заказ ${orderIndex + 1} не принят`);
                    // Продолжаем со следующим заказом
                }
            }

            // Проверяем, принял ли курьер хотя бы один заказ
            const courierHasActiveOrders = await this.checkCourierHasActiveOrders(courierId);
            
            if (!courierHasActiveOrders) {
                console.log(`   ⚠️ Курьер ${courier.fullName} не принял ни одного заказа`);
                await this.deactivateCourier(courierId);
            }

        } catch (error) {
            console.error(`❌ Ошибка при обработке курьера ${courier.fullName}:`, error);
        } finally {
            this.processingCouriers.delete(courierId);
        }
    }

    /**
     * 📨 ОТПРАВКА УВЕДОМЛЕНИЯ О ЗАКАЗЕ
     */
    async sendOrderNotification(courier, order) {
        try {
            if (!courier.notificationPushToken) {
                console.log(`   ❌ У курьера ${courier.fullName} нет токена для уведомлений`);
                return false;
            }

            // Формируем сообщение
            let message = this.formatProductsMessage(order.products);
            message += ` Забрать из аквамаркета: ${order.aquaMarketAddress}`;

            // Отправляем уведомление
            await pushNotification(
                "newOrder",
                message,
                [courier.notificationPushToken],
                "newOrder",
                order
            );

            console.log(`   📱 Уведомление отправлено`);
            return true;

        } catch (error) {
            console.error(`   ❌ Ошибка отправки уведомления:`, error);
            return false;
        }
    }

    /**
     * 🔍 ПРОВЕРКА ПРИНЯТИЯ ЗАКАЗА
     */
    async checkOrderAcceptance(orderId) {
        try {
            const order = await Order.findById(orderId);
            return order && order.status === "onTheWay";
        } catch (error) {
            console.error(`❌ Ошибка проверки статуса заказа ${orderId}:`, error);
            return false;
        }
    }

    /**
     * 👥 ПРОВЕРКА НАЛИЧИЯ АКТИВНЫХ ЗАКАЗОВ У КУРЬЕРА
     */
    async checkCourierHasActiveOrders(courierId) {
        try {
            const courier = await CourierAggregator.findById(courierId);
            if (!courier) return false;

            // Проверяем, есть ли у курьера заказы в статусе "onTheWay"
            const hasActiveOrders = courier.orders.some(order => order.status === "onTheWay");
            return hasActiveOrders;
        } catch (error) {
            console.error(`❌ Ошибка проверки активных заказов курьера ${courierId}:`, error);
            return false;
        }
    }

    /**
     * 🔴 ДЕАКТИВАЦИЯ КУРЬЕРА
     */
    async deactivateCourier(courierId) {
        try {
            await CourierAggregator.updateOne(
                { _id: courierId },
                { 
                    $set: { 
                        status: "inactive",
                        onTheLine: false
                    }
                }
            );

            const courier = await CourierAggregator.findById(courierId);
            console.log(`   🔴 Курьер ${courier.fullName} деактивирован`);

        } catch (error) {
            console.error(`❌ Ошибка деактивации курьера ${courierId}:`, error);
        }
    }

    /**
     * 📝 ФОРМАТИРОВАНИЕ СООБЩЕНИЯ О ПРОДУКТАХ
     */
    formatProductsMessage(products) {
        let message = "";
        
        if (products?.b19 > 0) {
            message += `${products.b19} бутылей 19л. `;
        }
        if (products?.b12 > 0) {
            message += `${products.b12} бутылей 12.5л. `;
        }
        
        return message.trim();
    }

    /**
     * ⏰ ЗАДЕРЖКА
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 🎯 ТРИГГЕРЫ ДЛЯ АВТОМАТИЧЕСКОГО ЗАПУСКА
 */
class AutoTriggerManager {
    constructor() {
        this.notificationManager = new NotificationManager();
        this.isProcessing = false;
    }

    /**
     * 🚀 ЗАПУСК ОПТИМИЗАЦИИ И УВЕДОМЛЕНИЙ
     */
    async triggerOptimizationAndNotifications(reason = "manual") {
        if (this.isProcessing) {
            console.log("⏳ Оптимизация уже выполняется, пропускаем");
            return;
        }

        this.isProcessing = true;

        try {
            console.log(`🎯 ТРИГГЕР: ${reason}`);
            console.log("=".repeat(60));

            // 1. Запускаем оптимизацию маршрутов
            console.log("🗺️ Запуск оптимизации маршрутов...");
            const optimizationResult = await zoneBasedDistribution();

            if (!optimizationResult.success) {
                console.log("❌ Оптимизация не выполнена:", optimizationResult.message);
                return;
            }

            console.log("✅ Оптимизация завершена успешно");

            // 2. Ждем 5 секунд для завершения всех операций
            await this.sleep(5000);

            // 3. Запускаем отправку уведомлений
            console.log("📱 Запуск отправки уведомлений...");
            await this.notificationManager.startNotificationProcess();

        } catch (error) {
            console.error("❌ Ошибка в процессе оптимизации и уведомлений:", error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 📊 МОНИТОРИНГ ИЗМЕНЕНИЙ В БАЗЕ ДАННЫХ
     */
    async startDatabaseMonitoring() {
        console.log("🔍 ЗАПУСК МОНИТОРИНГА ИЗМЕНЕНИЙ В БД");
        
        try {
            // Мониторинг изменений в коллекции Order
            const orderChangeStream = Order.watch([
                {
                    $match: {
                        $or: [
                            { "fullDocument.forAggregator": true },
                            { "updateDescription.updatedFields.forAggregator": true }
                        ]
                    }
                }
            ]);

            orderChangeStream.on('change', async (change) => {
                console.log("📦 Обнаружено изменение в заказах:", change.operationType);
                
                if (change.operationType === 'insert' || 
                    (change.operationType === 'update' && change.updateDescription?.updatedFields?.forAggregator)) {
                    
                    await this.triggerOptimizationAndNotifications("new_order_for_aggregator");
                }
            });

            // Мониторинг изменений в коллекции CourierAggregator
            const courierChangeStream = CourierAggregator.watch([
                {
                    $match: {
                        $or: [
                            { "updateDescription.updatedFields.onTheLine": true },
                            { "fullDocument.orders": { $exists: true } }
                        ]
                    }
                }
            ]);

            courierChangeStream.on('change', async (change) => {
                console.log("👤 Обнаружено изменение у курьеров:", change.operationType);
                
                if (change.operationType === 'update') {
                    const updatedFields = change.updateDescription?.updatedFields || {};
                    
                    // Курьер вышел на линию
                    if (updatedFields.onTheLine === true) {
                        await this.triggerOptimizationAndNotifications("courier_online");
                    }
                    
                    // Курьер завершил заказ (изменился массив orders)
                    if (change.updateDescription?.updatedFields && 
                        Object.keys(updatedFields).some(key => key.startsWith('orders.'))) {
                        
                        await this.triggerOptimizationAndNotifications("order_completed");
                    }
                }
            });

            console.log("✅ Мониторинг базы данных запущен");

        } catch (error) {
            console.error("❌ Ошибка запуска мониторинга:", error);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Создаем экземпляр менеджера
const autoTriggerManager = new AutoTriggerManager();

// Экспортируем функции
export { NotificationManager, AutoTriggerManager, autoTriggerManager };

// Если файл запускается напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    mongoose.connect('mongodb://127.0.0.1:27017/crm');
    
    // Запускаем мониторинг
    autoTriggerManager.startDatabaseMonitoring();
    
    // Запускаем первоначальную оптимизацию
    autoTriggerManager.triggerOptimizationAndNotifications("initial_startup");
} 