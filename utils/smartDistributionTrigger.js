import { runDynamicZoneDistribution } from "./dynamicZoneSystem.js";
import Order from "../Models/Order.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import { getTodayAlmaty } from "./dateUtils.js";

/**
 * Триггеры для автоматического запуска зональной системы
 */

/**
 * Запускается при добавлении нового заказа
 */
export async function onNewOrderAdded(orderId) {
    try {
        console.log(`📦 Новый заказ добавлен: ${orderId}`);
        
        // Проверяем количество неназначенных заказов
        const unassignedOrders = await Order.countDocuments({
            status: { $nin: ["delivered", "cancelled", "onTheWay"] },
            courierAggregator: { $exists: false },
            forAggregator: true
        });

        // Если накопилось достаточно заказов - запускаем перераспределение
        if (unassignedOrders >= 5) {
            console.log(`🎯 Накопилось ${unassignedOrders} неназначенных заказов - запуск зональной системы`);
            await runDynamicZoneDistribution();
        }
        
    } catch (error) {
        console.error("Ошибка в onNewOrderAdded:", error);
    }
}

/**
 * Запускается при выходе курьера на линию
 */
export async function onCourierGoesOnline(courierId) {
    try {
        console.log(`👨‍💼 Курьер вышел на линию: ${courierId}`);
        
        // Проверяем есть ли неназначенные заказы
        const unassignedOrders = await Order.countDocuments({
            status: { $nin: ["delivered", "cancelled", "onTheWay"] },
            courierAggregator: { $exists: false },
            forAggregator: true
        });

        if (unassignedOrders > 0) {
            console.log(`🔄 Есть ${unassignedOrders} неназначенных заказов - перераспределяем`);
            await runDynamicZoneDistribution();
        }
        
    } catch (error) {
        console.error("Ошибка в onCourierGoesOnline:", error);
    }
}

/**
 * Запускается при завершении заказа курьером
 */
export async function onOrderCompleted(orderId, courierId) {
    try {
        console.log(`✅ Заказ завершен: ${orderId} курьером ${courierId}`);
        
        // Проверяем есть ли у курьера еще заказы
        const courier = await CourierAggregator.findById(courierId);
        
        if (courier && courier.orders.length === 0) {
            // Курьер свободен - проверяем неназначенные заказы
            const unassignedOrders = await Order.countDocuments({
                status: { $nin: ["delivered", "cancelled", "onTheWay"] },
                courierAggregator: { $exists: false },
                forAggregator: true
            });

            if (unassignedOrders > 0) {
                console.log(`🔄 Курьер свободен, есть ${unassignedOrders} неназначенных заказов`);
                await runDynamicZoneDistribution();
            }
        }
        
    } catch (error) {
        console.error("Ошибка в onOrderCompleted:", error);
    }
}

/**
 * Запускается при отклонении заказа курьером
 */
export async function onOrderRejected(orderId, courierId, reason) {
    try {
        console.log(`❌ Заказ отклонен: ${orderId} курьером ${courierId}, причина: ${reason}`);
        
        // Сбрасываем назначение заказа
        await Order.updateOne(
            { _id: orderId },
            { 
                $unset: { courierAggregator: "" },
                $set: { status: "awaitingOrder" }
            }
        );

        // Удаляем заказ из списка курьера
        await CourierAggregator.updateOne(
            { _id: courierId },
            { $pull: { orders: { orderId: orderId } } }
        );

        // Запускаем перераспределение
        console.log("🔄 Запуск перераспределения после отклонения заказа");
        await runDynamicZoneDistribution();
        
    } catch (error) {
        console.error("Ошибка в onOrderRejected:", error);
    }
}

/**
 * Запускается при изменении статуса заказа
 */
export async function onOrderStatusChanged(orderId, newStatus, oldStatus) {
    try {
        console.log(`🔄 Статус заказа изменен: ${orderId} с '${oldStatus}' на '${newStatus}'`);
        
        // Если заказ отменен или доставлен - освобождаем курьера
        if (newStatus === "cancelled" || newStatus === "delivered") {
            const order = await Order.findById(orderId);
            if (order && order.courierAggregator) {
                await CourierAggregator.updateOne(
                    { _id: order.courierAggregator },
                    { $pull: { orders: { orderId: orderId } } }
                );

                // Проверяем есть ли неназначенные заказы для освободившегося курьера
                const unassignedOrders = await Order.countDocuments({
                    status: { $nin: ["delivered", "cancelled", "onTheWay"] },
                    courierAggregator: { $exists: false },
                    forAggregator: true
                });

                if (unassignedOrders > 0) {
                    console.log(`🔄 Курьер освободился, перераспределяем ${unassignedOrders} заказов`);
                    await runDynamicZoneDistribution();
                }
            }
        }
        
    } catch (error) {
        console.error("Ошибка в onOrderStatusChanged:", error);
    }
}

/**
 * Периодическая проверка и оптимизация зон
 */
export async function periodicZoneOptimization() {
    try {
        console.log("🔍 Периодическая оптимизация зон");
        
        const today = getTodayAlmaty();
        
        // Получаем статистику по активным заказам
        const activeOrders = await Order.countDocuments({
            "date.d": today,
            status: { $nin: ["delivered", "cancelled"] },
            forAggregator: true
        });

        const assignedOrders = await Order.countDocuments({
            "date.d": today,
            courierAggregator: { $exists: true, $ne: null },
            status: { $nin: ["delivered", "cancelled"] },
            forAggregator: true
        });

        const assignmentRate = activeOrders > 0 ? (assignedOrders / activeOrders) * 100 : 100;

        console.log(`📊 Статистика: ${activeOrders} активных заказов, ${assignedOrders} назначено (${assignmentRate.toFixed(1)}%)`);

        // Если процент назначения низкий - запускаем оптимизацию
        if (assignmentRate < 80 && activeOrders > 0) {
            console.log("⚡ Низкий процент назначения - запуск оптимизации");
            await runDynamicZoneDistribution();
        }
        
    } catch (error) {
        console.error("Ошибка в periodicZoneOptimization:", error);
    }
}

/**
 * Проверяет нужно ли запустить зональную систему
 */
export async function shouldTriggerZoneSystem() {
    try {
        const today = getTodayAlmaty();

        console.log("today = ", today);
        
        const unassignedOrders = await Order.countDocuments({
            "date.d": today,
            status: { $nin: ["delivered", "cancelled", "onTheWay"] },
            courierAggregator: null,
            forAggregator: true
        });

        const activeCouriers = await CourierAggregator.countDocuments({
            onTheLine: true,
            status: "active",
            forAggregator: true
        });

        return {
            shouldTrigger: unassignedOrders > 0 && activeCouriers > 0,
            unassignedOrders,
            activeCouriers,
            reason: unassignedOrders === 0 ? "Нет неназначенных заказов" :
                   activeCouriers === 0 ? "Нет активных курьеров" : "Условия выполнены"
        };
        
    } catch (error) {
        console.error("Ошибка в shouldTriggerZoneSystem:", error);
        return { shouldTrigger: false, reason: "Ошибка проверки" };
    }
} 