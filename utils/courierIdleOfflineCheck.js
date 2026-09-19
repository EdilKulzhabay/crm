import cron from "node-cron";
import CourierAggregator from "../Models/CourierAggregator.js";

const NO_ORDER_OFFLINE_THRESHOLD_MS = 60 * 60 * 1000; // 1 час
const CHECK_CRON_EXPRESSION = "*/15 * * * *"; // каждые 15 минут

const hasOrder = (courier) =>
    !!(courier.order?.orderId || courier.order?.stopType === "aquaMarket");

/**
 * Переводит в оффлайн курьеров, которые онлайн, но не имеют заказов
 * дольше NO_ORDER_OFFLINE_THRESHOLD_MS. Момент, с которого курьер остаётся
 * без заказов, фиксируется в noOrderSince при каждом запуске проверки —
 * это даёт точность в пределах интервала cron (15 минут), но не требует
 * правки всех мест назначения заказов курьеру.
 */
export const checkIdleCouriersOffline = async () => {
    try {
        const onlineCouriers = await CourierAggregator.find({ onTheLine: true });
        const now = Date.now();

        for (const courier of onlineCouriers) {
            if (hasOrder(courier)) {
                if (courier.noOrderSince) {
                    courier.noOrderSince = null;
                    await courier.save();
                }
                continue;
            }

            if (!courier.noOrderSince) {
                courier.noOrderSince = new Date();
                await courier.save();
                continue;
            }

            const idleMs = now - courier.noOrderSince.getTime();
            if (idleMs >= NO_ORDER_OFFLINE_THRESHOLD_MS) {
                courier.onTheLine = false;
                courier.noOrderSince = null;
                await courier.save();
                console.log(
                    `[courierIdleOfflineCheck] Курьер ${courier.fullName} (${courier._id}) переведён в оффлайн: нет заказов более часа`
                );
            }
        }
    } catch (error) {
        console.error("[courierIdleOfflineCheck] Ошибка при проверке неактивных курьеров:", error);
    }
};

export const startCourierIdleOfflineCheck = () => {
    cron.schedule(CHECK_CRON_EXPRESSION, () => {
        checkIdleCouriersOffline();
    });
    console.log("[courierIdleOfflineCheck] Проверка неактивных курьеров запущена (каждые 15 минут)");
};
