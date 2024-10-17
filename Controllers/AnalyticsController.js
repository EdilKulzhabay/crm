import mongoose from "mongoose";
import Order from "../Models/Order.js";
import User from "../Models/User.js";

export const getAnalyticsData = async (req, res) => {
    try {
        const {id, startDate, endDate} = req.body;

        const user = await User.findById(id);

        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        const filter = {
            status: { $in: ["delivered", "cancelled"] },
            "date.d": { $gte: startDate, $lte: endDate }
        };

        if (user.role === "admin") {
            filter.$or = [
                {franchisee: new mongoose.Types.ObjectId(id)},
                {transferredFranchise: user.fullName}
            ];
        }

        const stats = await Order.aggregate([
            { $match: filter },

            // Популяция данных клиента
            { 
                $lookup: {
                    from: "clients",
                    localField: "client",
                    foreignField: "_id",
                    as: "clientData"
                }
            },
            { $unwind: "$clientData" }, // Разворачиваем массив клиента
            
            // Добавляем флаги для регулярных и дополнительных заказов
            { 
                $addFields: {
                    isRegular: { $eq: ["$franchisee", new mongoose.Types.ObjectId(id)] },
                    isAdditional: { $eq: ["$transferredFranchise", user.fullName] }
                }
            },

            // Группировка всех данных
            { 
                $group: {
                    _id: null,
                    totalRegularOrders: { $sum: { $cond: ["$isRegular", 1, 0] } },
                    totalRegularB12Bottles: { $sum: { $cond: ["$isRegular", "$products.b12", 0] } },
                    regularB12Revenue: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b12", { $subtract: ["$clientData.price12", 170] }] }, 0] } },
                    regularB12Expense: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b12", 170] }, 0] } },
                    regularB12Amount: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b12", "$clientData.price12"] }, 0] } },
                    totalRegularB19Bottles: { $sum: { $cond: ["$isRegular", "$products.b19", 0] } },
                    regularB19Revenue: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b19", { $subtract: ["$clientData.price19", 250] }] }, 0] } },
                    regularB19Expense: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b19", 250] }, 0] } },
                    regularB19Amount: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b19", "$clientData.price19"] }, 0] } },

                    totalAdditionalOrders: { $sum: { $cond: ["$isAdditional", 1, 0] } },
                    totalAdditionalB12Bottles: { $sum: { $cond: ["$isAdditional", "$products.b12", 0] } },
                    additionalB12Revenue: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b12", { $subtract: ["$clientData.price12", 270] }] }, 0] } },
                    additionalB12Expense: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b12", 270] }, 0] } },
                    additionalB12Amount: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b12", "$clientData.price12"] }, 0] } },
                    totalAdditionalB19Bottles: { $sum: { $cond: ["$isAdditional", "$products.b19", 0] } },
                    additionalB19Revenue: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b19", { $subtract: ["$clientData.price19", 400] }] }, 0] } },
                    additionalB19Expense: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b19", 400] }, 0] } },
                    additionalB19Amount: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b19", "$clientData.price19"] }, 0] } },
                }
            },

            // Вычисление средних затрат
            { 
                $project: {
                    totalRegularOrders: 1,
                    totalRegularB12Bottles: 1,
                    regularB12Revenue: 1,
                    regularB12Expense: 1,
                    regularB12Amount: 1,
                    regularAverageCostB12: {
                        $cond: {
                            if: { $gt: ["$totalRegularB12Bottles", 0] },
                            then: { $round: [{ $divide: ["$regularB12Amount", "$totalRegularB12Bottles"] }, 0] },
                            else: 0
                        }
                    },
                    totalRegularB19Bottles: 1,
                    regularB19Revenue: 1,
                    regularB19Expense: 1,
                    regularB19Amount: 1,
                    regularAverageCostB19: {
                        $cond: {
                            if: { $gt: ["$totalRegularB19Bottles", 0] },
                            then: { $round: [{ $divide: ["$regularB19Amount", "$totalRegularB19Bottles"] }, 0] },
                            else: 0
                        }
                    },

                    totalAdditionalOrders: 1,
                    totalAdditionalB12Bottles: 1,
                    additionalB12Revenue: 1,
                    additionalB12Expense: 1,
                    additionalB12Amount: 1,
                    additionalAverageCostB12: {
                        $cond: {
                            if: { $gt: ["$totalAdditionalB12Bottles", 0] },
                            then: { $round: [{ $divide: ["$additionalB12Amount", "$totalAdditionalB12Bottles"] }, 0] },
                            else: 0
                        }
                    },
                    totalAdditionalB19Bottles: 1,
                    additionalB19Revenue: 1,
                    additionalB19Expense: 1,
                    additionalB19Amount: 1,
                    additionalAverageCostB19: {
                        $cond: {
                            if: { $gt: ["$totalAdditionalB19Bottles", 0] },
                            then: { $round: [{ $divide: ["$additionalB19Amount", "$totalAdditionalB19Bottles"] }, 0] },
                            else: 0
                        }
                    }
                }
            }
        ]);

        console.log(stats);
        

        res.json({ stats: stats[0] || {} });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}


export const getAnalyticsData2 = async (req, res) => {
    try {
        const {id, startDate, endDate} = req.body

        const user = await User.findById(id);

        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        const filter = {
            status: { $in: ["delivered", "cancelled"] },
            "date.d": { $gte: startDate, $lte: endDate },
        };

        if (user.role === "admin") {
            filter.$or = [
                {franchisee: new mongoose.Types.ObjectId(id)},
                {transferredFranchise: user.fullName}
            ];
        }

        const orders = await Order.find(filter).populate("client", "price12 price19")
        const stats = {
            totalRegularOrders: 0,
            totalRegularB12Bottles: 0,
            regularB12Revenue: 0,
            regularB12Expense: 0,
            regularB12Amount: 0,
            regularAverageCostB12: 0,
            totalRegularB19Bottles: 0,
            regularB19Revenue: 0,
            regularB19Expense: 0,
            regularB19Amount: 0,
            regularAverageCostB19: 0,

            totalAdditionalOrders: 0,
            totalAdditionalB12Bottles: 0,
            additionalB12Revenue: 0,
            additionalB12Expense: 0,
            additionalB12Amount: 0,
            additionalAverageCostB12: 0,
            totalAdditionalB19Bottles: 0,
            additionalB19Revenue: 0,
            additionalB19Expense: 0,
            additionalB19Amount: 0,
            additionalAverageCostB19: 0,
        }

        orders.forEach((item) => {
            if (item.franchisee.toString() === id) {
                stats.totalRegularOrders++
                if (item.products.b12 && item.products.b12 > 0) {
                    stats.totalRegularB12Bottles += item.products.b12
                    stats.regularB12Revenue += item.products.b12 * (item.client.price12 - 170)
                    stats.regularB12Expense += item.products.b12 * 170
                    stats.regularB12Amount += item.products.b12 * item.client.price12
                }
                if (item.products.b19 && item.products.b19 > 0) {
                    stats.totalRegularB19Bottles += item.products.b19
                    stats.regularB19Revenue += item.products.b19 * (item.client.price19 - 250)
                    stats.regularB19Expense += item.products.b19 * 250
                    stats.regularB19Amount += item.products.b19 * item.client.price19
                }
            }
            if (item?.transferredFranchise === user.fullName) {
                stats.totalAdditionalOrders++
                if (item.products.b12 && item.products.b12 > 0) {
                    stats.totalAdditionalB12Bottles += item.products.b12
                    stats.additionalB12Revenue += item.products.b12 * (item.client.price12 - 270)
                    stats.additionalB12Expense += item.products.b12 * 270
                    stats.additionalB12Amount += item.products.b12 * item.client.price12
                }
                if (item.products.b19 && item.products.b19 > 0) {
                    stats.totalAdditionalB19Bottles += item.products.b19
                    stats.additionalB19Revenue += item.products.b19 * (item.client.price19 - 400)
                    stats.additionalB19Expense += item.products.b19 * 400
                    stats.additionalB19Amount += item.products.b19 * item.client.price19
                }
            }
        })

        stats.regularAverageCostB12 = stats.totalRegularB12Bottles > 0 
            ? Math.round(stats.regularB12Amount / stats.totalRegularB12Bottles) 
            : 0;

        stats.regularAverageCostB19 = stats.totalRegularB19Bottles > 0 
            ? Math.round(stats.regularB19Amount / stats.totalRegularB19Bottles) 
            : 0;

        stats.additionalAverageCostB12 = stats.totalAdditionalB12Bottles > 0 
            ? Math.round(stats.additionalB12Amount / stats.totalAdditionalB12Bottles) 
            : 0;

        stats.additionalAverageCostB19 = stats.totalAdditionalB19Bottles > 0 
            ? Math.round(stats.additionalB19Amount / stats.totalAdditionalB19Bottles) 
            : 0;

        res.json({ stats });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}
