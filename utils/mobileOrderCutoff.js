import MobileAppSettings from "../Models/MobileAppSettings.js";

const DEFAULT_ORDER_SAME_DAY_UNTIL_HOUR = 19;

/** Час (Алматы) до которого действует заказ «на сегодня». */
export async function getOrderSameDayUntilHourValue() {
    let doc = await MobileAppSettings.findOne();
    if (!doc) {
        doc = await MobileAppSettings.create({
            orderSameDayUntilHour: DEFAULT_ORDER_SAME_DAY_UNTIL_HOUR,
        });
    }
    const h = Number(doc.orderSameDayUntilHour);
    if (!Number.isFinite(h) || h < 0 || h > 23) {
        return DEFAULT_ORDER_SAME_DAY_UNTIL_HOUR;
    }
    return Math.floor(h);
}

/** Подставляет настройку в объект профиля для ответов мобильному приложению */
export async function withOrderSameDayUntilHour(clientPayload) {
    const orderSameDayUntilHour = await getOrderSameDayUntilHourValue();
    return { ...clientPayload, orderSameDayUntilHour };
}
