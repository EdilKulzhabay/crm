import { 
    runDynamicZoneDistribution, 
    createDynamicZones, 
    analyzeZoneEfficiency,
    assignCouriersToZones,
    getZoneDetails,
    printZoneInfo
} from "../utils/dynamicZoneSystem.js";
import Order from "../Models/Order.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import { getTodayAlmaty } from "../utils/dateUtils.js";

/**
 * Запускает автоматическое создание зон и распределение заказов
 */
export const startDynamicDistribution = async (req, res) => {
    try {
        const { date } = req.body;
        
        console.log("🎯 Запуск динамического зонального распределения");
        
        const result = await runDynamicZoneDistribution(date);
        
        if (result.success) {
            res.json({
                success: true,
                message: `Успешно создано ${result.zonesCreated} зон и распределено ${result.ordersDistributed} заказов`,
                data: result
            });
        } else {
            res.json({
                success: false,
                message: result.message || "Не удалось выполнить распределение",
                error: result.error
            });
        }
        
    } catch (error) {
        console.error("Ошибка в startDynamicDistribution:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка сервера при запуске распределения"
        });
    }
};

/**
 * Анализирует текущие заказы и показывает потенциальные зоны
 */
export const analyzeOrderDensity = async (req, res) => {
    try {
        const { date, maxDistance = 3000, minOrdersInZone = 3 } = req.body;
        
        const zones = await createDynamicZones(date, maxDistance, minOrdersInZone);
        
        if (zones.length === 0) {
            return res.json({
                success: false,
                message: "Нет заказов для анализа или недостаточно данных для создания зон"
            });
        }

        // Подготавливаем данные для фронтенда
        const analysisResult = {
            totalOrders: zones.reduce((sum, zone) => sum + zone.orders.length, 0),
            zonesCount: zones.length,
            zones: zones.map(zone => ({
                id: zone.id,
                center: {
                    lat: zone.center.lat,
                    lon: zone.center.lon
                },
                radius: Math.round(zone.radius),
                ordersCount: zone.orders.length,
                orders: zone.orders.map(order => ({
                    id: order._id,
                    address: order.address.actual,
                    coordinates: {
                        lat: order.address.point.lat,
                        lon: order.address.point.lon
                    },
                    products: order.products,
                    clientName: order.client?.fullName || "Не указано"
                }))
            })),
            settings: {
                maxDistance,
                minOrdersInZone
            }
        };

        res.json({
            success: true,
            message: `Проанализировано ${analysisResult.totalOrders} заказов, найдено ${zones.length} потенциальных зон`,
            data: analysisResult
        });
        
    } catch (error) {
        console.error("Ошибка в analyzeOrderDensity:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при анализе плотности заказов"
        });
    }
};

/**
 * Получает статистику эффективности зональной системы
 */
export const getZoneEfficiencyStats = async (req, res) => {
    try {
        const today = getTodayAlmaty();
        
        console.log(`📊 Получение статистики эффективности зон для ${today}`);
        
        const stats = await analyzeZoneEfficiency(today);
        
        if (Object.keys(stats).length === 0) {
            return res.json({
                success: false,
                message: "Нет данных для анализа эффективности"
            });
        }

        // Вычисляем общую статистику
        let totalOrders = 0;
        let totalDistance = 0;
        let totalCouriers = 0;

        const courierStats = Object.values(stats).map(stat => {
            totalOrders += stat.orders.length;
            totalDistance += stat.totalDistance;
            totalCouriers++;
            
            return {
                courierName: stat.courierName,
                ordersCount: stat.orders.length,
                totalDistance: stat.totalDistance,
                averageDistance: stat.averageDistance,
                efficiency: stat.orders.length > 1 ? Math.round(stat.totalDistance / stat.orders.length) : 0
            };
        });

        const overallStats = {
            totalCouriers,
            totalOrders,
            totalDistance: Math.round(totalDistance),
            averageOrdersPerCourier: Math.round(totalOrders / totalCouriers),
            averageDistancePerCourier: Math.round(totalDistance / totalCouriers),
            courierStats: courierStats.sort((a, b) => b.ordersCount - a.ordersCount)
        };

        res.json({
            success: true,
            message: `Статистика по ${totalCouriers} курьерам и ${totalOrders} заказам`,
            data: overallStats
        });
        
    } catch (error) {
        console.error("Ошибка в getZoneEfficiencyStats:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при получении статистики эффективности"
        });
    }
};

/**
 * Получает текущее состояние распределения заказов
 */
export const getCurrentDistributionStatus = async (req, res) => {
    try {
        const today = getTodayAlmaty();
        
        console.log(`🔍 Получение текущего статуса распределения для ${today}`);
        
        // Получаем все заказы за сегодня
        const totalOrders = await Order.countDocuments({
            "date.d": today,
            status: { $nin: ["delivered", "cancelled"] }
        });

        // Заказы назначенные курьерам-агрегаторам
        const assignedOrders = await Order.countDocuments({
            "date.d": today,
            courierAggregator: { $exists: true, $ne: null },
            status: { $nin: ["delivered", "cancelled"] }
        });

        // Заказы в работе
        const inProgressOrders = await Order.countDocuments({
            "date.d": today,
            status: "onTheWay"
        });

        // Доставленные заказы
        const deliveredOrders = await Order.countDocuments({
            "date.d": today,
            status: "delivered"
        });

        // Активные курьеры
        const activeCouriers = await CourierAggregator.countDocuments({
            onTheLine: true,
            status: "active"
        });

        // Курьеры с заказами
        const busyCouriers = await CourierAggregator.countDocuments({
            onTheLine: true,
            status: "active",
            "orders.0": { $exists: true }
        });

        const status = {
            ordersStats: {
                total: totalOrders,
                assigned: assignedOrders,
                inProgress: inProgressOrders,
                delivered: deliveredOrders,
                unassigned: totalOrders - assignedOrders,
                assignmentRate: totalOrders > 0 ? Math.round((assignedOrders / totalOrders) * 100) : 0
            },
            couriersStats: {
                active: activeCouriers,
                busy: busyCouriers,
                free: activeCouriers - busyCouriers,
                utilizationRate: activeCouriers > 0 ? Math.round((busyCouriers / activeCouriers) * 100) : 0
            },
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            message: "Текущее состояние системы распределения",
            data: status
        });
        
    } catch (error) {
        console.error("Ошибка в getCurrentDistributionStatus:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при получении статуса распределения"
        });
    }
};

/**
 * Перераспределяет заказы при изменениях
 */
export const redistributeOrders = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        
        console.log(`🔄 Перераспределение заказа ${orderId}, причина: ${reason}`);
        
        if (orderId) {
            // Перераспределяем конкретный заказ
            const order = await Order.findById(orderId);
            if (!order) {
                return res.json({
                    success: false,
                    message: "Заказ не найден"
                });
            }

            // Убираем заказ у текущего курьера если есть
            if (order.courierAggregator) {
                await CourierAggregator.updateOne(
                    { _id: order.courierAggregator },
                    { $pull: { orders: { orderId: orderId } } }
                );
            }

            // Сбрасываем назначение заказа
            await Order.updateOne(
                { _id: orderId },
                { 
                    $unset: { courierAggregator: "" },
                    $set: { status: "awaitingOrder" }
                }
            );

            // Запускаем перераспределение
            const result = await runDynamicZoneDistribution();
            
            res.json({
                success: true,
                message: `Заказ ${orderId} перераспределен`,
                data: result
            });
        } else {
            // Полное перераспределение всех заказов
            const result = await runDynamicZoneDistribution();
            
            res.json({
                success: result.success,
                message: result.success ? 
                    `Перераспределено ${result.ordersDistributed} заказов в ${result.zonesCreated} зонах` :
                    result.message,
                data: result
            });
        }
        
    } catch (error) {
        console.error("Ошибка в redistributeOrders:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при перераспределении заказов"
        });
    }
};

/**
 * Настройки зональной системы
 */
export const updateZoneSettings = async (req, res) => {
    try {
        const { 
            maxDistance = 3000, 
            minOrdersInZone = 3, 
            maxOrdersPerCourier = 4,
            autoRedistribute = true 
        } = req.body;

        // В реальном приложении эти настройки можно сохранить в БД
        // Пока просто возвращаем подтверждение
        const settings = {
            maxDistance,
            minOrdersInZone,
            maxOrdersPerCourier,
            autoRedistribute,
            updatedAt: new Date().toISOString()
        };

        res.json({
            success: true,
            message: "Настройки зональной системы обновлены",
            data: settings
        });
        
    } catch (error) {
        console.error("Ошибка в updateZoneSettings:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при обновлении настроек"
        });
    }
};

/**
 * Получает детальную информацию о созданных зонах
 */
export const getZoneDetailsAPI = async (req, res) => {
    try {
        const { date } = req.query;
        
        console.log("🗺️ Получение детальной информации о зонах");
        
        const result = await getZoneDetails(date);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                data: result
            });
        } else {
            res.json({
                success: false,
                message: result.message,
                data: { zones: [] }
            });
        }
        
    } catch (error) {
        console.error("Ошибка в getZoneDetailsAPI:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка сервера при получении деталей зон"
        });
    }
};

/**
 * Получает только центры зон для быстрого просмотра
 */
export const getZoneCenters = async (req, res) => {
    try {
        const { date } = req.query;
        const today = date || getTodayAlmaty();
        
        console.log(`🎯 Получение центров зон для ${today}`);
        
        const result = await getZoneDetails(today);
        
        if (result.success) {
            const centers = result.zones.map(zone => ({
                id: zone.id,
                courierName: zone.courier.name,
                center: zone.center,
                centerAddress: zone.centerAddress,
                radius: zone.radius,
                ordersCount: zone.ordersCount,
                status: zone.courier.status
            }));
            
            res.json({
                success: true,
                message: `Найдено ${centers.length} центров зон`,
                data: {
                    date: today,
                    totalZones: centers.length,
                    centers: centers
                }
            });
        } else {
            res.json({
                success: false,
                message: result.message,
                data: { centers: [] }
            });
        }
        
    } catch (error) {
        console.error("Ошибка в getZoneCenters:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при получении центров зон"
        });
    }
};

export const getDynamicZoneStats = async (req, res) => {
    try {
        const today = getTodayAlmaty();
        
        const totalOrders = await Order.countDocuments({ "date.d": today });
        const assignedOrders = await Order.countDocuments({ 
            "date.d": today,
            courier: { $exists: true, $ne: null }
        });
        
        res.json({
            success: true,
            data: {
                date: today,
                totalOrders,
                assignedOrders,
                assignmentRate: totalOrders > 0 ? (assignedOrders / totalOrders * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error("Ошибка получения статистики зон:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при получении статистики"
        });
    }
};

export const optimizeZones = async (req, res) => {
    try {
        const today = getTodayAlmaty();
        
        console.log(`🔄 Запуск оптимизации зон для ${today}`);
        
        // Запуск оптимизации зон
        const result = await runDynamicZoneDistribution();
        
        res.json({
            success: true,
            message: "Оптимизация зон завершена",
            data: result
        });
    } catch (error) {
        console.error("Ошибка в optimizeZones:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при оптимизации зон"
        });
    }
};

/**
 * Выводит информацию о зонах в консоль сервера (для отладки)
 */
export const printZonesConsole = async (req, res) => {
    try {
        const { date } = req.query;
        
        console.log("🖨️ Запрос на вывод информации о зонах в консоль");
        
        const result = await getZoneDetails(date);
        
        if (result.success) {
            printZoneInfo(result.zones);
            
            res.json({
                success: true,
                message: `Информация о ${result.zones.length} зонах выведена в консоль сервера`,
                data: {
                    zonesCount: result.zones.length,
                    ordersCount: result.summary.totalOrders,
                    date: result.date
                }
            });
        } else {
            console.log("📍 Нет активных зон для отображения");
            res.json({
                success: false,
                message: result.message
            });
        }
        
    } catch (error) {
        console.error("Ошибка в printZonesConsole:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при выводе информации о зонах"
        });
    }
};