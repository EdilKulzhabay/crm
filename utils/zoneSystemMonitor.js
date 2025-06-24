import Order from "../Models/Order.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import { getTodayAlmaty } from "./dateUtils.js";

/**
 * Система мониторинга эффективности зональной системы
 */
class ZoneSystemMonitor {
    constructor() {
        this.metrics = {
            totalDistributions: 0,
            successfulDistributions: 0,
            avgDistributionTime: 0,
            avgDeliveryTime: 0,
            courierEfficiency: {},
            zonePerformance: {},
            lastUpdate: new Date()
        };
    }

    /**
     * Получение общей статистики системы
     */
    async getSystemStats(date = null) {
        try {
            const today = getTodayAlmaty();
            
            // Статистика заказов
            const totalOrders = await Order.countDocuments({ "date.d": today });
            const assignedOrders = await Order.countDocuments({ 
                "date.d": today,
                courier: { $exists: true, $ne: null }
            });
            
            // Статистика курьеров
            const totalCouriers = await CourierAggregator.countDocuments({ online: true });
            const activeCouriers = await CourierAggregator.countDocuments({ 
                online: true,
                status: "active"
            });
            
            return {
                date: today,
                orders: {
                    total: totalOrders,
                    assigned: assignedOrders,
                    assignmentRate: totalOrders > 0 ? (assignedOrders / totalOrders * 100).toFixed(2) : 0
                },
                couriers: {
                    total: totalCouriers,
                    active: activeCouriers,
                    utilizationRate: totalCouriers > 0 ? (activeCouriers / totalCouriers * 100).toFixed(2) : 0
                }
            };
        } catch (error) {
            console.error('Ошибка получения системной статистики:', error);
            return null;
        }
    }

    /**
     * Анализ производительности курьеров
     */
    async getCourierPerformance() {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const courierStats = await Order.aggregate([
                {
                    $match: {
                        "date.d": today,
                        courierAggregator: { $exists: true, $ne: null },
                        status: { $in: ["delivered", "cancelled", "onTheWay"] }
                    }
                },
                {
                    $group: {
                        _id: "$courierAggregator",
                        totalOrders: { $sum: 1 },
                        deliveredOrders: {
                            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
                        },
                        cancelledOrders: {
                            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
                        },
                        onTheWayOrders: {
                            $sum: { $cond: [{ $eq: ["$status", "onTheWay"] }, 1, 0] }
                        },
                        totalIncome: { $sum: "$sum" }
                    }
                },
                {
                    $lookup: {
                        from: "courieraggregators",
                        localField: "_id",
                        foreignField: "_id",
                        as: "courier"
                    }
                },
                {
                    $unwind: "$courier"
                },
                {
                    $project: {
                        courierId: "$_id",
                        courierName: "$courier.fullName",
                        totalOrders: 1,
                        deliveredOrders: 1,
                        cancelledOrders: 1,
                        onTheWayOrders: 1,
                        totalIncome: 1,
                        deliveryRate: {
                            $multiply: [
                                { $divide: ["$deliveredOrders", "$totalOrders"] },
                                100
                            ]
                        },
                        avgIncomePerOrder: {
                            $cond: [
                                { $gt: ["$totalOrders", 0] },
                                { $divide: ["$totalIncome", "$totalOrders"] },
                                0
                            ]
                        }
                    }
                },
                {
                    $sort: { deliveryRate: -1, totalOrders: -1 }
                }
            ]);

            return courierStats;

        } catch (error) {
            console.error("Ошибка при анализе производительности курьеров:", error);
            return [];
        }
    }

    /**
     * Анализ временных показателей
     */
    async getTimeAnalytics(date = null) {
        try {
            const today = getTodayAlmaty();
            
            // Анализ времени назначения заказов
            const assignedOrders = await Order.find({
                "date.d": today,
                courier: { $exists: true, $ne: null },
                assignedAt: { $exists: true }
            });

            const assignmentTimes = assignedOrders
                .filter(order => order.createdAt && order.assignedAt)
                .map(order => {
                    const created = new Date(order.createdAt);
                    const assigned = new Date(order.assignedAt);
                    return (assigned - created) / 1000 / 60; // в минутах
                });

            // Анализ времени доставки
            const deliveredOrders = await Order.find({
                "date.d": today,
                status: "delivered",
                deliveredAt: { $exists: true }
            });

            const deliveryTimes = deliveredOrders
                .filter(order => order.assignedAt && order.deliveredAt)
                .map(order => {
                    const assigned = new Date(order.assignedAt);
                    const delivered = new Date(order.deliveredAt);
                    return (delivered - assigned) / 1000 / 60; // в минутах
                });

            return {
                date: today,
                assignment: {
                    count: assignmentTimes.length,
                    avgTime: assignmentTimes.length > 0 ? 
                        (assignmentTimes.reduce((a, b) => a + b, 0) / assignmentTimes.length).toFixed(2) : 0,
                    minTime: assignmentTimes.length > 0 ? Math.min(...assignmentTimes).toFixed(2) : 0,
                    maxTime: assignmentTimes.length > 0 ? Math.max(...assignmentTimes).toFixed(2) : 0
                },
                delivery: {
                    count: deliveryTimes.length,
                    avgTime: deliveryTimes.length > 0 ? 
                        (deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length).toFixed(2) : 0,
                    minTime: deliveryTimes.length > 0 ? Math.min(...deliveryTimes).toFixed(2) : 0,
                    maxTime: deliveryTimes.length > 0 ? Math.max(...deliveryTimes).toFixed(2) : 0
                }
            };
        } catch (error) {
            console.error('Ошибка анализа времени:', error);
            return null;
        }
    }

    /**
     * Получение проблемных зон и рекомендаций
     */
    async getSystemIssues(date = null) {
        try {
            const today = getTodayAlmaty();
            const issues = [];
            const recommendations = [];

            // Проверка неназначенных заказов
            const unassignedOrders = await Order.countDocuments({
                "date.d": today,
                courier: { $exists: false }
            });

            if (unassignedOrders > 0) {
                issues.push(`${unassignedOrders} неназначенных заказов`);
                recommendations.push("Рассмотрите запуск зональной системы распределения");
            }

            // Проверка неактивных курьеров
            const inactiveCouriers = await CourierAggregator.countDocuments({
                online: true,
                status: { $ne: "active" }
            });

            if (inactiveCouriers > 5) {
                issues.push(`${inactiveCouriers} неактивных курьеров онлайн`);
                recommendations.push("Проверьте статус курьеров и их готовность к работе");
            }

            // Проверка старых неназначенных заказов
            const oldUnassigned = await Order.countDocuments({
                "date.d": today,
                courier: { $exists: false },
                createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } // старше 30 минут
            });

            if (oldUnassigned > 0) {
                issues.push(`${oldUnassigned} заказов не назначены более 30 минут`);
                recommendations.push("Срочно требуется перераспределение заказов");
            }

            return {
                date: today,
                issues,
                recommendations,
                criticalLevel: issues.length > 2 ? "high" : issues.length > 0 ? "medium" : "low"
            };
        } catch (error) {
            console.error('Ошибка анализа проблем системы:', error);
            return null;
        }
    }

    /**
     * Генерация подробного отчета
     */
    async generateDetailedReport() {
        try {
            console.log("📊 Генерация подробного отчета зональной системы...");

            const [systemStats, courierPerformance, timeAnalytics, systemIssues] = await Promise.all([
                this.getSystemStats(),
                this.getCourierPerformance(),
                this.getTimeAnalytics(),
                this.getSystemIssues()
            ]);

            const report = {
                generatedAt: new Date(),
                summary: systemStats,
                courierPerformance,
                timeAnalytics,
                issues: systemIssues,
                recommendations: this.generateRecommendations(systemStats, courierPerformance, systemIssues)
            };

            // Выводим краткий отчет в консоль
            this.printReport(report);

            return report;

        } catch (error) {
            console.error("Ошибка при генерации отчета:", error);
            return null;
        }
    }

    /**
     * Генерация рекомендаций на основе анализа
     */
    generateRecommendations(stats, courierPerf, issues) {
        const recommendations = [];

        if (stats) {
            // Рекомендации по эффективности назначения
            if (stats.efficiency.assignmentRate < 90) {
                recommendations.push({
                    type: "assignment",
                    priority: "high",
                    message: "Улучшить алгоритм назначения заказов - текущий показатель ниже оптимального"
                });
            }

            // Рекомендации по использованию курьеров
            if (stats.efficiency.courierUtilization < 70) {
                recommendations.push({
                    type: "utilization",
                    priority: "medium",
                    message: "Оптимизировать загрузку курьеров - многие курьеры простаивают"
                });
            }
        }

        // Рекомендации по производительности курьеров
        if (courierPerf && courierPerf.length > 0) {
            const lowPerformers = courierPerf.filter(c => c.deliveryRate < 80).length;
            if (lowPerformers > 0) {
                recommendations.push({
                    type: "courier_training",
                    priority: "medium",
                    message: `${lowPerformers} курьеров показывают низкую эффективность - требуется обучение`
                });
            }
        }

        return recommendations;
    }

    /**
     * Вывод отчета в консоль
     */
    printReport(report) {
        console.log("\n" + "=".repeat(60));
        console.log("📈 ОТЧЕТ ЗОНАЛЬНОЙ СИСТЕМЫ ДОСТАВКИ");
        console.log("=".repeat(60));
        
        if (report.summary) {
            const s = report.summary;
            console.log(`📦 ЗАКАЗЫ: ${s.orders.total} всего | ${s.orders.assigned} назначено | ${s.orders.delivered} доставлено`);
            console.log(`👥 КУРЬЕРЫ: ${s.couriers.active}/${s.couriers.total} активно | ${s.couriers.working} работают`);
            console.log(`📊 ЭФФЕКТИВНОСТЬ: ${s.efficiency.assignmentRate}% назначение | ${s.efficiency.deliveryRate}% доставка`);
        }

        if (report.timeAnalytics) {
            const t = report.timeAnalytics;
            console.log(`⏱️ ВРЕМЯ: ${t.assignment.avgTime}мин назначение | ${t.delivery.avgTime}мин доставка`);
        }

        if (report.issues && report.issues.totalIssues > 0) {
            console.log(`⚠️ ПРОБЛЕМЫ: ${report.issues.totalIssues} всего | ${report.issues.criticalIssues} критических`);
            report.issues.issues.forEach(issue => {
                const icon = issue.severity === "critical" ? "🚨" : issue.severity === "high" ? "⚠️" : "ℹ️";
                console.log(`  ${icon} ${issue.message}`);
            });
        }

        console.log("=".repeat(60));
    }
}

// Создаем единственный экземпляр монитора
const zoneSystemMonitor = new ZoneSystemMonitor();

export default zoneSystemMonitor; 