import User from "../Models/User.js";
import Courier from "../Models/Courier.js";
import Client from "../Models/Client.js";
import Order from "../Models/Order.js";
import DepartmentHistory from "../Models/DepartmentHistory.js";
import mongoose from "mongoose";

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

// export const deleteCourier = async (req, res) => {
//     try {
//         const id = req.userId;

//         const user = await User.findById(id);

//         if (user.role !== "superAdmin") {
//             res.json({
//                 success: false,
//                 message: "Не достаточно прав",
//             });
//         }

//         const { userId } = req.body;

//         const delRes = await Courier.findByIdAndDelete(userId);

//         if (!delRes) {
//             return res.json({
//                 success: false,
//                 message: "Не удалось удалить курьера",
//             });
//         }
//         res.json({
//             success: true,
//         });
//     } catch (error) {
//         console.log(error);
//         res.status(500).json({
//             message: "Что-то пошло не так",
//         });
//     }
// };

export const getMainPageInfo = async (req, res) => {
    try {
        const id = req.userId;
        const user = await User.findById(id);
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
        const day = String(today.getDate()).padStart(2, '0');
        const todayDate = `${year}-${month}-${day}`;

        // Строим базовый фильтр
        const filter = {};

        // Добавляем фильтр по франчайзи для админа
        if (user.role === "admin") {
            filter.$or = [
                {franchisee: id},
                {transferredFranchise: user.fullName}
            ]
        }

        const clients = await Client.countDocuments(filter);
        const activeOrders = await Order.countDocuments({
            ...filter,
            'date.d': todayDate,
            status: { $in: ["awaitingOrder", "onTheWay"] },
        });
        const unfinishedOrders = await Order.countDocuments({
            ...filter,
            'date.d': { $lt: todayDate }, // Find orders with a date earlier than today
            status: { $in: ["awaitingOrder", "onTheWay"] },
        });
        const deliveredOrders = await Order.countDocuments({
            ...filter,
            'date.d': todayDate,
            status: { $in: ["delivered", "cancelled"] },
        });

        const costPrice19 = 250; // Себестоимость 19L бутылки
        const costPrice12 = 170; // Себестоимость 12L бутылки


        const orders = await Order.find({...filter, 'date.d': todayDate, status: "delivered"}).populate('client');

        let totalRevenue = 0;
        let totalSum = 0

        if (orders.length > 0) {
            orders.forEach(order => {
                const client = order?.client;
    
                // Цены продажи (price19 и price12) взятые из клиента
                const sellingPrice19 = client?.price19 || 0;
                const sellingPrice12 = client?.price12 || 0;
    
                // Проданные объемы
                const quantity19 = order.products?.b19 || 0;
                const quantity12 = order.products?.b12 || 0;

                let revenue19 = 0
                let revenue12 = 0
    
                if (order.transferred) {
                    revenue19 = (sellingPrice19 - 400) * quantity19;
                    revenue12 = (sellingPrice12 - 270) * quantity12;
                } else {
                    revenue19 = (sellingPrice19 - costPrice19) * quantity19;
                    revenue12 = (sellingPrice12 - costPrice12) * quantity12;
                }
                
    
                // Суммарная выручка по заказу
                totalRevenue += revenue19 + revenue12;
                totalSum += order.sum
            });
        }

        res.json({
            clients,
            activeOrders,
            unfinishedOrders,
            deliveredOrders,
            totalRevenue,
            totalSum
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getMainPageInfoSA = async (req, res) => {
    try {
        const id = req.userId;
        const user = await User.findById(id);
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
        const day = String(today.getDate()).padStart(2, '0');
        const todayDate = `${year}-${month}-${day}`;

        // Фильтр для сегодняшней даты
        const filter = { 'date.d': todayDate };

        // Считаем общее количество клиентов на сегодня
        const clients = await Client.countDocuments();

        // Считаем статистику по заказам
        const stats = await Order.aggregate([
            { $match: filter },
            {
                $addFields: {
                    isMyOrder: { $eq: ["$franchisee", new mongoose.Types.ObjectId(id)] },
                    isCompleted: { $in: ["$status", ["delivered", "cancelled"]] },
                    orderRevenue: {
                        $cond: [
                            { $eq: ["$franchisee", new mongoose.Types.ObjectId(id)] },
                            { 
                                $add: [
                                    { $multiply: ["$products.b12", 270] },
                                    { $multiply: ["$products.b19", 400] }
                                ]
                            },
                            { 
                                $add: [
                                    { $multiply: ["$products.b12", 170] },
                                    { $multiply: ["$products.b19", 250] }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$orderRevenue" },
                    totalSum: { $sum: "$sum" },
                    myActiveOrders: {
                        $sum: {
                            $cond: [{ $and: [{ $eq: ["$isMyOrder", true] }, { $not: "$isCompleted" }] }, 1, 0]
                        }
                    },
                    otherActiveOrders: {
                        $sum: {
                            $cond: [{ $and: [{ $eq: ["$isMyOrder", false] }, { $not: "$isCompleted" }] }, 1, 0]
                        }
                    },
                    myCompletedOrders: {
                        $sum: {
                            $cond: [{ $and: [{ $eq: ["$isMyOrder", true] }, "$isCompleted"] }, 1, 0]
                        }
                    },
                    otherCompletedOrders: {
                        $sum: {
                            $cond: [{ $and: [{ $eq: ["$isMyOrder", false] }, "$isCompleted"] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        today.setHours(0, 0, 0, 0);

        const bottles = await DepartmentHistory.aggregate([
            { $match: {type: false, createdAt: today} },
            {
                $group: {
                    _id: null,
                    total12: { $sum: "$data.b121kol" },
                    total19: { $sum: { $add: ["$data.b191kol", "$data.b197kol"] }}
                }
            }
        ])

        res.json({
            clients,
            stats: stats[0],
            bottles: bottles[0]
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};
