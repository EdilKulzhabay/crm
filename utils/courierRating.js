import Order from "../Models/Order.js";
import CourierAggregator from "../Models/CourierAggregator.js";

/**
 * Пересчитывает рейтинг курьера (CourierAggregator.raiting) как среднее
 * clientReview по всем его доставленным и оценённым заказам. Вызывается
 * при каждой отправке отзыва клиентом — так рейтинг всегда отражает
 * актуальный набор отзывов, без накопления погрешности инкрементального
 * среднего.
 */
export const recalculateCourierAggregatorRating = async (courierAggregatorId) => {
    if (!courierAggregatorId) {
        return;
    }

    const reviewedOrders = await Order.find({
        courierAggregator: courierAggregatorId,
        status: "delivered",
        clientReview: { $exists: true, $ne: 0 },
    }).select("clientReview");

    if (reviewedOrders.length === 0) {
        return;
    }

    const totalRating = reviewedOrders.reduce((sum, order) => sum + order.clientReview, 0);
    const averageRating = Math.round((totalRating / reviewedOrders.length) * 10) / 10;

    await CourierAggregator.updateOne(
        { _id: courierAggregatorId },
        { $set: { raiting: averageRating } }
    );
};
