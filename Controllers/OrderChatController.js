import Order from "../Models/Order.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import { pushOrderChatMessageToCourier } from "../pushNotification.js";
import { pushNotificationClientSupport } from "../pushNotificationClient.js";

export const sendMessageAsClient = async (req, res) => {
    try {
        const { orderId, text } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Заказ не найден" });
        }

        if (!order.client || order.client.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: "Нет доступа" });
        }

        const newMessage = {
            text,
            sender: "client",
            timestamp: new Date().toISOString(),
            isRead: false,
        };

        order.chatMessages.push(newMessage);
        await order.save();

        if (order.courierAggregator) {
            const courierAggregator = await CourierAggregator.findById(order.courierAggregator);
            if (courierAggregator?.notificationPushToken) {
                pushOrderChatMessageToCourier(
                    courierAggregator.notificationPushToken,
                    order._id.toString(),
                    order.chatMessages[order.chatMessages.length - 1]
                ).catch((e) => console.error("[sendMessageAsClient] push:", e?.message || e));
            }
        }

        res.json({ success: true, messages: order.chatMessages });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};

export const getMessagesAsClient = async (req, res) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Заказ не найден" });
        }

        if (!order.client || order.client.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: "Нет доступа" });
        }

        res.json({ success: true, messages: order.chatMessages });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};

export const sendMessageAsCourier = async (req, res) => {
    try {
        const { orderId, text } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Заказ не найден" });
        }

        if (!order.courierAggregator || order.courierAggregator.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: "Нет доступа" });
        }

        const newMessage = {
            text,
            sender: "courier",
            timestamp: new Date().toISOString(),
            isRead: false,
        };

        order.chatMessages.push(newMessage);
        await order.save();

        if (order.notificationToken) {
            const lastMessage = order.chatMessages[order.chatMessages.length - 1];
            pushNotificationClientSupport(
                "Сообщение от курьера",
                text,
                [order.notificationToken],
                "newOrderChatMessage",
                { ...lastMessage.toObject(), orderId: order._id.toString() },
                { clientId: order.client }
            ).catch((e) => console.error("[sendMessageAsCourier] push:", e?.message || e));
        }

        res.json({ success: true, messages: order.chatMessages });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};

export const getMessagesAsCourier = async (req, res) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Заказ не найден" });
        }

        if (!order.courierAggregator || order.courierAggregator.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: "Нет доступа" });
        }

        res.json({ success: true, messages: order.chatMessages });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};
