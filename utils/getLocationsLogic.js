import CourierAggregator from "../Models/CourierAggregator.js";
import Order from "../Models/Order.js";
import { pushNotification } from "../pushNotification.js";

export const getLocationsLogic = async (orderId) => {
    try {
        const order = await Order.findById(orderId)
        const couriers = await CourierAggregator.find({onTheLine: true})

        if (couriers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Нет активных курьеров для отправки уведомлений.",
            });
        }

        const tokens = couriers.map((item) => {
            if (item?.notificationPushTokens) {
                return item?.notificationPushTokens
            }
        })

        if (tokens.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Нет активных курьеров для отправки уведомлений.2",
            });
        }

        await pushNotification("location", "location", tokens, "location");

        const timeout = 30 * 1000; // 30 секунд
        const checkInterval = 5 * 1000; // Проверка каждые 5 секунд
        const startTime = Date.now();

        const allUpdated = await new Promise((resolve) => {
            const interval = setInterval(async () => {
                // Проверяем, обновили ли все курьеры свои координаты
                const updatedCouriers = await CourierAggregator.find({ onTheLine: true });
                const allHaveCoords = updatedCouriers.every(
                    (courier) => courier.point?.lat && courier.point?.lon
                );

                if (allHaveCoords) {
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - startTime >= timeout) {
                    clearInterval(interval);
                    resolve(false);
                }
            }, checkInterval);
        });

        if (allUpdated) {
            console.log("Все курьеры обновили свои координаты.");
            updatedCouriers.forEach((item) => {
                console.log(`Курьер ${item.fullName}: lat: ${item.point.lat}, lon: ${item.point.lon}`);
            });
            return { success: true, message: "Все координаты обновлены" };
        }


    } catch (error) {
        console.error("Ошибка при получении локаций:", error);
        throw error;
    }
};