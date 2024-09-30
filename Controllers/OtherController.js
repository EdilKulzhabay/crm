import User from "../Models/User.js";
import Courier from "../Models/Courier.js";
import Client from "../Models/Client.js";
import Order from "../Models/Order.js";

export const getAllUsersNCouriers = async (req, res) => {
    try {
        const users = await User.find();

        if (!users) {
            res.status(409).json({
                message: "Не удалось получить пользователей",
            });
        }

        const couriers = await Courier.find();

        if (!couriers) {
            res.status(409).json({
                message: "Не удалось получить курьеров",
            });
        }

        res.json([...users, ...couriers]);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const id = req.userId;

        const user = await User.findById(id);

        if (user.role !== "superAdmin") {
            res.json({
                success: false,
                message: "Не достаточно прав",
            });
        }

        const { userId } = req.body;

        const delRes = await User.findByIdAndDelete(userId);

        if (!delRes) {
            return res.json({
                success: false,
                message: "Не удалось удалить пользователя",
            });
        }
        res.json({
            success: true,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const deleteCourier = async (req, res) => {
    try {
        const id = req.userId;

        const user = await User.findById(id);

        if (user.role !== "superAdmin") {
            res.json({
                success: false,
                message: "Не достаточно прав",
            });
        }

        const { userId } = req.body;

        const delRes = await Courier.findByIdAndDelete(userId);

        if (!delRes) {
            return res.json({
                success: false,
                message: "Не удалось удалить курьера",
            });
        }
        res.json({
            success: true,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getMainPageInfo = async (req, res) => {
    try {
        const id = req.userId;
        const user = await User.findById(id);

        // Строим базовый фильтр
        const filter = {};

        // Добавляем фильтр по франчайзи для админа
        if (user.role === "admin") {
            filter.franchisee = id;
        }

        const clients = await Client.countDocuments({ ...filter });
        const activeOrders = await Order.countDocuments({
            ...filter,
            status: "awaitingOrder" || "onTheWay",
        });
        const deliveredOrders = await Order.countDocuments({
            ...filter,
            status: "delivered" || "cancelled",
        });

        const costPrice19 = 250; // Себестоимость 19L бутылки
        const costPrice12 = 150; // Себестоимость 12L бутылки

        // Получаем все заказы клиента
        const orders = await Order.find({...filter, status: "delivered"}).populate('client');

        let totalRevenue = 0;

        orders.forEach(order => {
            const client = order.client;

            // Цены продажи (price19 и price12) взятые из клиента
            const sellingPrice19 = client.price19 || 0;
            const sellingPrice12 = client.price12 || 0;

            // Проданные объемы
            const quantity19 = order.products.b19 || 0;
            const quantity12 = order.products.b12 || 0;

            // Выручка с 19 литровых бутылок
            const revenue19 = (sellingPrice19 - costPrice19) * quantity19;

            // Выручка с 12 литровых бутылок
            const revenue12 = (sellingPrice12 - costPrice12) * quantity12;

            // Суммарная выручка по заказу
            totalRevenue += revenue19 + revenue12;
        });


        res.json({
            clients,
            activeOrders,
            deliveredOrders,
            totalRevenue
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};
