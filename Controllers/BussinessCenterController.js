import CourierAggregator from "../Models/CourierAggregator.js";
import Order from "../Models/Order.js";
import { getDateAlmaty } from "../utils/dateUtils.js";

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
        const today = getDateAlmaty();
        const orders = await Order.find({ "client.franchisee": franchiseeId, "date.d": today, status: { $nin: ["delivered", "cancelled"] } })
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
        const today = getDateAlmaty();
        const orders = await Order.find({ "client.franchisee": franchiseeId, "date.d": today, status: "delivered" })
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
        const today = getDateAlmaty();
        const orders = await Order.find({ "client.franchisee": franchiseeId, "date.d": today, status: "cancelled" })
            .populate("client")
            .populate("courierAggregator", "fullName _id");
        res.json({ orders })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Ошибка сервера", success: false });
    }
}