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

        res.json({ stats: stats[0] || {} });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getChartByOp = async (req, res) => {
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
            "date.d": { $gte: startDate, $lte: endDate },
            franchisee: new mongoose.Types.ObjectId(id)
        };

        const stats = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$opForm", // Группировка по форме оплаты
                    count: { $sum: 1 }, // Подсчет количества заказов для каждой формы оплаты
                }
            },
            {
                $group: {
                    _id: null, // Группировка всех данных в один объект для подсчета общего количества заказов
                    totalOrders: { $sum: "$count" }, // Общий итог всех заказов
                    ordersByOpForm: { // Сохранение статистики по формам оплаты
                        $push: {
                            opForm: "$_id",
                            count: "$count"
                        }
                    }
                }
            }
        ]);

        const filterAdditional = {
            status: { $in: ["delivered", "cancelled"] },
            "date.d": { $gte: startDate, $lte: endDate },
            transferredFranchise: user.fullName
        };

        const additionalTotal = await Order.countDocuments(filterAdditional)

        if (stats.length === 0) {
            return res.json({
                success: false,
                additionalTotal,
                message: "Нет данных для выбранного периода"
            });
        }

        // Теперь stats содержит один объект, из которого можно вытащить totalOrders и ordersByOpForm
        const { totalOrders, ordersByOpForm } = stats[0]; // Извлекаем общее количество и данные по оплатам

        // Формируем новый массив с процентами
        const formattedStats = ordersByOpForm.map(order => ({
            opForm: order.opForm,
            count: order.count,
            percentage: ((order.count / totalOrders) * 100).toFixed(2)
        }));

        // Возвращаем totalOrders отдельно и форматированные данные
        res.json({
            success: true,
            totalOrders,        // Общее количество заказов
            stats: formattedStats, // Данные по формам оплаты
            additionalTotal
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getClientsByOpForm = async (req, res) => {
    try {
        const {id, startDate, endDate, opForm} = req.body;

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
            franchisee: new mongoose.Types.ObjectId(id),
            opForm
        };

        const stats = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$client", // Группируем заказы по клиентам
                    totalSum: { $sum: "$sum" }, // Считаем общую сумму заказов для каждого клиента
                    totalB12: { $sum: "$products.b12" }, // Считаем общую сумму заказов для каждого клиента
                    totalB19: { $sum: "$products.b19" }, // Считаем общую сумму заказов для каждого клиента
                    orderCount: { $sum: 1 }, // Считаем количество заказов для каждого клиента
                }
            },
            {
                $lookup: { // Получаем информацию о клиенте
                    from: "clients", // Коллекция клиентов
                    localField: "_id", // Соединяем по полю "_id" (клиент)
                    foreignField: "_id", // Соответствует полю "_id" в коллекции клиентов
                    as: "clientInfo" // Название поля, куда будет помещена информация о клиенте
                }
            },
            {
                $unwind: "$clientInfo" // Разворачиваем массив с информацией о клиенте
            },
            {
                $project: {
                    _id: 0, // Не отображаем _id
                    clientId: "$clientInfo._id", // ID клиента
                    clientFullName: "$clientInfo.fullName", // Имя клиента (если в модели Client есть поле name)
                    clientUserName: "$clientInfo.userName", // Имя клиента (если в модели Client есть поле name)
                    totalSum: 1, // Общая сумма заказов клиента
                    totalB12: 1,
                    totalB19: 1,
                    orderCount: 1 // Количество заказов клиента
                }
            },
            {
                $sort: { totalSum: -1 } // Сортируем по общей сумме в порядке убывания
            }
        ]);

        const totalOrdersSum = stats.reduce((acc, client) => acc + client.totalSum, 0);

        res.json({
            success: true,
            stats,
            totalOrdersSum
        });
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getAdditionalRevenue = async (req, res) => {
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
            "date.d": { $gte: startDate, $lte: endDate },
            transferredFranchise: user.fullName,
        };

        const stats = await Order.aggregate([
            { $match: filter },
            { 
                $lookup: {
                    from: "clients",
                    localField: "client",
                    foreignField: "_id",
                    as: "clientData"
                }
            },
            { $unwind: "$clientData" }, 
            {
                $group: {
                    _id: null, // Группируем заказы по клиентам
                    B19Revenue: { $sum: { $multiply: ["$products.b19", { $subtract: ["$clientData.price19", 400] }] } },
                    B12Revenue: { $sum: { $multiply: ["$products.b12", { $subtract: ["$clientData.price12", 270] }] } },
                    B19FaktRevenue: {
                        $sum: { $cond: [{ $eq: ["$opForm", "fakt"] }, { $sum: { $multiply: ["$products.b19", { $subtract: ["$clientData.price19", 400] }] } }, 0] }
                    },
                    B12FaktRevenue: {
                        $sum: { $cond: [{ $eq: ["$opForm", "fakt"] }, { $sum: { $multiply: ["$products.b12", { $subtract: ["$clientData.price12", 270] }] } }, 0] }
                    }
                }
            },
            {
                $project: {
                    totalRevenue: { $add: ["$B19Revenue", "$B12Revenue"] },
                    totalFaktRevenue: { $add: ["$B19FaktRevenue", "$B12FaktRevenue"] }
                }
            },
        ]);

        if (stats.length === 0) {
            return res.json({
                success: false,
                message: "Нет данных для выбранного периода"
            });
        }

        res.json({ success: true, stats: stats[0] || {} });
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
