import CourierAggregator from "../Models/CourierAggregator.js";
import Order from "../Models/Order.js";
import getLocationsLogicQueue from "./getLocationsLogicQueue.js";

async function distributionUrgentOrder(orderId) {
    try {
        const result = await CourierAggregator.aggregate([
            {
                $match: {
                    onTheLine: true
                }
            },
            {
                $unwind: {
                    path: "$orders",
                    includeArrayIndex: "arrayIndex"
                }
            },
            {
                $match: {
                    "arrayIndex": { $gt: 1 }
                }
            },
            {
                $project: {
                    orderId: "$orders.orderId"
                }
            }
        ]);

        const orderIds = result.map(item => item.orderId);
        const orders = await Order.find({ _id: { $in: orderIds } }).sort({ createdAt: 1 })

        if (!orders || orders?.length === 0) {
            await getLocationsLogicQueue(orderId)
            console.log("Заказ нашел курьера");
            
            return
        }

        const updateResult = await CourierAggregator.updateMany(
            { "orders.orderId": { $in: orderIds } }, // Находим курьеров, у которых есть эти заказы
            { $pull: { orders: { orderId: { $in: orderIds } } } } // Удаляем заказы из массива
        );

        const order = await Order.findById(orderId)
        orders.unshift(order)

        for (const order of orders) {
            await getLocationsLogicQueue(order._id);
        }

    } catch {
        console.log("Волшебная ошибка");
        return
    }
}

export default distributionUrgentOrder