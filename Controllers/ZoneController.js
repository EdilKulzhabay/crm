import { runDynamicZoneDistribution } from "../utils/dynamicZoneSystem.js";
import dynamicZoneScheduler from "../utils/dynamicZoneScheduler.js";
import zoneSystemMonitor from "../utils/zoneSystemMonitor.js";

// ... existing code ...

/**
 * Получение статистики системы
 */
export const getZoneSystemStats = async (req, res) => {
    try {
        const stats = await zoneSystemMonitor.getSystemStats();
        
        if (!stats) {
            return res.status(500).json({
                success: false,
                message: "Ошибка при получении статистики"
            });
        }

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error("Ошибка в getZoneSystemStats:", error);
        res.status(500).json({
            success: false,
            message: "Внутренняя ошибка сервера"
        });
    }
};

/**
 * Получение производительности курьеров
 */
export const getCourierPerformance = async (req, res) => {
    try {
        const performance = await zoneSystemMonitor.getCourierPerformance();
        
        res.json({
            success: true,
            data: performance
        });

    } catch (error) {
        console.error("Ошибка в getCourierPerformance:", error);
        res.status(500).json({
            success: false,
            message: "Внутренняя ошибка сервера"
        });
    }
};

/**
 * Получение временной аналитики
 */
export const getTimeAnalytics = async (req, res) => {
    try {
        const analytics = await zoneSystemMonitor.getTimeAnalytics();
        
        if (!analytics) {
            return res.status(500).json({
                success: false,
                message: "Ошибка при получении аналитики"
            });
        }

        res.json({
            success: true,
            data: analytics
        });

    } catch (error) {
        console.error("Ошибка в getTimeAnalytics:", error);
        res.status(500).json({
            success: false,
            message: "Внутренняя ошибка сервера"
        });
    }
};

/**
 * Получение проблем системы
 */
export const getSystemIssues = async (req, res) => {
    try {
        const issues = await zoneSystemMonitor.getSystemIssues();
        
        res.json({
            success: true,
            data: issues
        });

    } catch (error) {
        console.error("Ошибка в getSystemIssues:", error);
        res.status(500).json({
            success: false,
            message: "Внутренняя ошибка сервера"
        });
    }
};

/**
 * Генерация подробного отчета
 */
export const generateDetailedReport = async (req, res) => {
    try {
        const report = await zoneSystemMonitor.generateDetailedReport();
        
        if (!report) {
            return res.status(500).json({
                success: false,
                message: "Ошибка при генерации отчета"
            });
        }

        res.json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error("Ошибка в generateDetailedReport:", error);
        res.status(500).json({
            success: false,
            message: "Внутренняя ошибка сервера"
        });
    }
};

/**
 * Получение статистики планировщика
 */
export const getSchedulerStats = async (req, res) => {
    try {
        const stats = dynamicZoneScheduler.getStats();
        
        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error("Ошибка в getSchedulerStats:", error);
        res.status(500).json({
            success: false,
            message: "Внутренняя ошибка сервера"
        });
    }
};

/**
 * Ручной запуск распределения
 */
export const manualDistribution = async (req, res) => {
    try {
        console.log("🔧 Ручной запуск распределения через API");
        
        const result = await dynamicZoneScheduler.manualDistribution();
        
        res.json({
            success: true,
            message: "Распределение запущено",
            data: result
        });

    } catch (error) {
        console.error("Ошибка в manualDistribution:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при запуске распределения"
        });
    }
};

/**
 * Управление планировщиком
 */
export const controlScheduler = async (req, res) => {
    try {
        const { action } = req.body;
        
        if (!action || !['start', 'stop', 'restart'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Неверное действие. Доступны: start, stop, restart"
            });
        }

        let result;
        switch (action) {
            case 'start':
                dynamicZoneScheduler.start();
                result = "Планировщик запущен";
                break;
            case 'stop':
                dynamicZoneScheduler.stop();
                result = "Планировщик остановлен";
                break;
            case 'restart':
                dynamicZoneScheduler.stop();
                setTimeout(() => {
                    dynamicZoneScheduler.start();
                }, 1000);
                result = "Планировщик перезапущен";
                break;
        }

        res.json({
            success: true,
            message: result,
            data: dynamicZoneScheduler.getStats()
        });

    } catch (error) {
        console.error("Ошибка в controlScheduler:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при управлении планировщиком"
        });
    }
};

// Базовые функции для зональной системы (заглушки)
export const getAllZones = async (req, res) => {
    try {
        res.json({
            success: true,
            message: "Получение всех зон",
            data: []
        });
    } catch (error) {
        console.error("Ошибка в getAllZones:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при получении зон"
        });
    }
};

export const createZone = async (req, res) => {
    try {
        res.json({
            success: true,
            message: "Зона создана",
            data: {}
        });
    } catch (error) {
        console.error("Ошибка в createZone:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при создании зоны"
        });
    }
};

export const updateZone = async (req, res) => {
    try {
        res.json({
            success: true,
            message: "Зона обновлена",
            data: {}
        });
    } catch (error) {
        console.error("Ошибка в updateZone:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при обновлении зоны"
        });
    }
};

export const deleteZone = async (req, res) => {
    try {
        res.json({
            success: true,
            message: "Зона удалена"
        });
    } catch (error) {
        console.error("Ошибка в deleteZone:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при удалении зоны"
        });
    }
};

export const getZoneStats = async (req, res) => {
    try {
        res.json({
            success: true,
            message: "Статистика зон",
            data: {}
        });
    } catch (error) {
        console.error("Ошибка в getZoneStats:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при получении статистики"
        });
    }
};

export const autoCreateZones = async (req, res) => {
    try {
        res.json({
            success: true,
            message: "Автоматическое создание зон",
            data: {}
        });
    } catch (error) {
        console.error("Ошибка в autoCreateZones:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при автоматическом создании зон"
        });
    }
};

export const assignCouriersToZones = async (req, res) => {
    try {
        res.json({
            success: true,
            message: "Курьеры назначены зонам",
            data: {}
        });
    } catch (error) {
        console.error("Ошибка в assignCouriersToZones:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при назначении курьеров"
        });
    }
};

export const startZoneDistribution = async (req, res) => {
    try {
        res.json({
            success: true,
            message: "Распределение в зонах запущено",
            data: {}
        });
    } catch (error) {
        console.error("Ошибка в startZoneDistribution:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка при запуске распределения"
        });
    }
}; 