import CourierAggregator from "../Models/CourierAggregator.js";
import Order from "../Models/Order.js";

export const getActiveCourierAggregatorsForBussinessCenter = async (req, res) => {
    try {
        const franchiseeId = req.body.franchisee;
        const couriers = await CourierAggregator.find({ franchisee: franchiseeId, onTheLine: true })
            .populate({
                path: 'order.orderId',
                model: 'Order',
                populate: {
                    path: 'client',
                    model: 'Client',
                    select: 'fullName _id'
                }
            });
        res.json({ couriers })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Ошибка сервера", success: false });
    }
}

export const getActiveOrdersForBussinessCenter = async (req, res) => {
    try {
        const franchiseeId = req.body.franchisee;
        const today = new Date();
        const todayString = getDateAlmaty(today);
        const orders = await Order.find({ franchisee: franchiseeId, "date.d": todayString, status: { $nin: ["delivered", "cancelled"] } })
            .populate("client")
            .populate("courierAggregator", "fullName _id");

        res.json({ orders })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Ошибка сервера", success: false });
    }
}

export const getCompletedOrdersForBussinessCenter = async (req, res) => {
    try {
        const franchiseeId = req.body.franchisee;
        const orders = await Order.find({ franchisee: franchiseeId, status: "delivered" })
            .populate("client")
            .populate("courierAggregator", "fullName _id");
        res.json({ orders })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Ошибка сервера", success: false });
    }
}

export const getCancelledOrdersForBussinessCenter = async (req, res) => {
    try {
        const franchiseeId = req.body.franchisee;
        const orders = await Order.find({ franchisee: franchiseeId, status: "cancelled" })
            .populate("client")
            .populate("courierAggregator", "fullName _id");
        res.json({ orders })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Ошибка сервера", success: false });
    }
}