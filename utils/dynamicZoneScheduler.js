import cron from "node-cron";
import { runDynamicZoneDistribution } from "./dynamicZoneSystem.js";
import { periodicZoneOptimization, shouldTriggerZoneSystem } from "./smartDistributionTrigger.js";
import zoneSystemMonitor from "./zoneSystemMonitor.js";
import Order from "../Models/Order.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import { getTodayAlmaty } from "./dateUtils.js";

/**
 * Планировщик для автоматического управления зональной системой
 */
class DynamicZoneScheduler {
    constructor() {
        this.isRunning = false;
        this.tasks = [];
        this.stats = {
            totalDistributions: 0,
            successfulDistributions: 0,
            lastDistribution: null,
            avgProcessingTime: 0
        };
    }

    /**
     * Запуск планировщика
     */
    start() {
        if (this.isRunning) {
            console.log("⚠️ Планировщик уже запущен");
            return;
        }

        console.log("🚀 Запуск планировщика динамической зональной системы");
        this.isRunning = true;

        // Основное распределение - каждые 2 минуты
        this.tasks.push(
            cron.schedule("* * * * *", async () => {
                await this.executeMainDistribution();
            }, {
                scheduled: true,
                timezone: "Asia/Almaty"
            })
        );

        // Быстрая проверка неназначенных заказов - каждую минуту
        this.tasks.push(
            cron.schedule("*/30 * * * *", async () => {
                await this.quickCheck();
            }, {
                scheduled: true,
                timezone: "Asia/Almaty"
            })
        );

        // Оптимизация зон - каждые 15 минут
        this.tasks.push(
            cron.schedule("*/15 * * * *", async () => {
                await this.executeZoneOptimization();
            }, {
                scheduled: true,
                timezone: "Asia/Almaty"
            })
        );

        // Сброс статистики курьеров - каждый час
        this.tasks.push(
            cron.schedule("0 * * * *", async () => {
                await this.resetCourierStats();
            }, {
                scheduled: true,
                timezone: "Asia/Almaty"
            })
        );

        // Очистка старых данных - каждый день в 2:00
        this.tasks.push(
            cron.schedule("0 2 * * *", async () => {
                await this.cleanupOldData();
            }, {
                scheduled: true,
                timezone: "Asia/Almaty"
            })
        );

        // Генерация отчетов - каждый день в 6:00
        this.tasks.push(
            cron.schedule("0 6 * * *", async () => {
                await this.generateDailyReport();
            }, {
                scheduled: true,
                timezone: "Asia/Almaty"
            })
        );

        console.log(`✅ Планировщик запущен с ${this.tasks.length} задачами`);
    }

    /**
     * Остановка планировщика
     */
    stop() {
        if (!this.isRunning) {
            console.log("⚠️ Планировщик уже остановлен");
            return;
        }

        console.log("🛑 Остановка планировщика");
        this.tasks.forEach(task => task.destroy());
        this.tasks = [];
        this.isRunning = false;
        console.log("✅ Планировщик остановлен");
    }

    /**
     * Основное распределение заказов
     */
    async executeMainDistribution() {
        try {
            const startTime = Date.now();
            console.log("🔄 Запуск основного распределения заказов");

            const check = await shouldTriggerZoneSystem();
            
            if (check.shouldTrigger) {
                this.stats.totalDistributions++;
                const result = await runDynamicZoneDistribution();
                
                if (result && result.success) {
                    this.stats.successfulDistributions++;
                    this.stats.lastDistribution = new Date();
                    
                    const processingTime = Date.now() - startTime;
                    this.stats.avgProcessingTime = 
                        (this.stats.avgProcessingTime + processingTime) / 2;
                    
                    console.log(`✅ Распределение завершено за ${processingTime}мс`);
                    console.log(`📊 Обработано: ${result.processedOrders} заказов, ${result.assignedCouriers} курьеров`);
                } else {
                    console.log("❌ Ошибка при распределении заказов");
                }
            } else {
                console.log(`ℹ️ Распределение пропущено: ${check.reason}`);
                console.log(`📊 Неназначенных заказов: ${check.unassignedOrders}, активных курьеров: ${check.activeCouriers}`);
            }

        } catch (error) {
            console.error("❌ Ошибка в основном распределении:", error);
        }
    }

    /**
     * Быстрая проверка критических ситуаций
     */
    async quickCheck() {
        try {
            const today = getTodayAlmaty();
            
            // Проверяем заказы, которые долго ждут назначения
            const oldUnassignedOrders = await Order.find({
                "date.d": today,
                status: { $nin: ["delivered", "cancelled", "onTheWay"] },
                courierAggregator: { $exists: false },
                createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } // старше 10 минут
            });

            if (oldUnassignedOrders.length > 0) {
                console.log(`⚠️ Найдено ${oldUnassignedOrders.length} заказов, ожидающих более 10 минут`);
                
                // Запускаем экстренное распределение
                const result = await runDynamicZoneDistribution();
                if (result && result.success) {
                    console.log("🚨 Экстренное распределение выполнено");
                }
            }

            // Проверяем курьеров без заказов
            const idleCouriers = await CourierAggregator.countDocuments({
                onTheLine: true,
                status: "active",
                orders: { $size: 0 }
            });

            if (idleCouriers > 3) {
                console.log(`👥 ${idleCouriers} курьеров без заказов - проверяем возможность распределения`);
            }

        } catch (error) {
            console.error("❌ Ошибка в быстрой проверке:", error);
        }
    }

    /**
     * Оптимизация зон
     */
    async executeZoneOptimization() {
        try {
            console.log("🔧 Запуск оптимизации зон");
            await periodicZoneOptimization();
        } catch (error) {
            console.error("❌ Ошибка в оптимизации зон:", error);
        }
    }

    /**
     * Сброс статистики курьеров
     */
    async resetCourierStats() {
        try {
            console.log("🔄 Сброс статистики курьеров");
            
            const result = await CourierAggregator.updateMany(
                {},
                {
                    $set: {
                        "stats.dailyOrders": 0,
                        "stats.dailyEarnings": 0,
                        "stats.lastResetTime": new Date()
                    }
                }
            );

            console.log(`✅ Обновлена статистика для ${result.modifiedCount} курьеров`);
        } catch (error) {
            console.error("❌ Ошибка при сбросе статистики:", error);
        }
    }

    /**
     * Очистка старых данных
     */
    async cleanupOldData() {
        try {
            console.log("🧹 Очистка старых данных");
            
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            // Удаляем старые заказы со статусом "delivered" или "cancelled"
            const cleanupResult = await Order.deleteMany({
                status: { $in: ["delivered", "cancelled"] },
                updatedAt: { $lt: weekAgo }
            });

            console.log(`🗑️ Удалено ${cleanupResult.deletedCount} старых заказов`);

            // Очищаем логи старше месяца (если есть коллекция логов)
            const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            console.log("✅ Очистка завершена");
        } catch (error) {
            console.error("❌ Ошибка при очистке данных:", error);
        }
    }

    /**
     * Генерация ежедневного отчета
     */
    async generateDailyReport() {
        try {
            console.log("📊 Генерация ежедневного отчета");
            
            // Используем систему мониторинга для подробного отчета
            const detailedReport = await zoneSystemMonitor.generateDetailedReport();
            
            if (detailedReport) {
                // Дополнительная информация о планировщике
                console.log(`🔄 Статистика планировщика:`);
                console.log(`   Всего распределений: ${this.stats.totalDistributions}`);
                console.log(`   Успешных распределений: ${this.stats.successfulDistributions}`);
                console.log(`   Эффективность планировщика: ${this.stats.totalDistributions > 0 ? 
                    ((this.stats.successfulDistributions / this.stats.totalDistributions) * 100).toFixed(1) : 0}%`);
                console.log(`   Среднее время обработки: ${this.stats.avgProcessingTime.toFixed(0)}мс`);
                
                return detailedReport;
            } else {
                // Fallback к старому методу если мониторинг не работает
                const today = getTodayAlmaty();
                const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000 + (6 * 60 * 60 * 1000)).toISOString().split('T')[0]; // Вчера по Алматы

                const todayOrders = await Order.countDocuments({ "date.d": today });
                const yesterdayOrders = await Order.countDocuments({ "date.d": yesterday });
                
                const deliveredToday = await Order.countDocuments({
                    "date.d": today,
                    status: "delivered"
                });

                const cancelledToday = await Order.countDocuments({
                    "date.d": today,
                    status: "cancelled"
                });

                const activeCouriers = await CourierAggregator.countDocuments({
                    onTheLine: true,
                    status: "active"
                });

                const totalCouriers = await CourierAggregator.countDocuments({
                    status: "active"
                });

                const successRate = todayOrders > 0 ? (deliveredToday / todayOrders) * 100 : 0;
                const distributionEfficiency = this.stats.totalDistributions > 0 ? 
                    (this.stats.successfulDistributions / this.stats.totalDistributions) * 100 : 0;

                console.log("\n📈 ЕЖЕДНЕВНЫЙ ОТЧЕТ");
                console.log("=".repeat(50));
                console.log(`📦 Заказы сегодня: ${todayOrders} (вчера: ${yesterdayOrders})`);
                console.log(`✅ Доставлено: ${deliveredToday} (${successRate.toFixed(1)}%)`);
                console.log(`❌ Отменено: ${cancelledToday}`);
                console.log(`👥 Активных курьеров: ${activeCouriers}/${totalCouriers}`);
                console.log(`🎯 Эффективность распределения: ${distributionEfficiency.toFixed(1)}%`);
                console.log(`⏱️ Среднее время обработки: ${this.stats.avgProcessingTime.toFixed(0)}мс`);
                console.log(`🔄 Всего распределений: ${this.stats.totalDistributions}`);
                console.log("=".repeat(50));
            }

        } catch (error) {
            console.error("❌ Ошибка при генерации отчета:", error);
        }
    }

    /**
     * Получение статистики планировщика
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            activeTasks: this.tasks.length,
            uptime: this.isRunning ? Date.now() - this.stats.lastDistribution : 0
        };
    }

    /**
     * Ручной запуск распределения
     */
    async manualDistribution() {
        console.log("🔧 Ручной запуск распределения");
        return await this.executeMainDistribution();
    }
}

// Создаем единственный экземпляр планировщика
const dynamicZoneScheduler = new DynamicZoneScheduler();

export default dynamicZoneScheduler; 