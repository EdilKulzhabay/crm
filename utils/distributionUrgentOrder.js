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
    } catch {
        console.log("Волшебная ошибка");
        return
    }
}

export default distributionUrgentOrder