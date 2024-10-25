import mongoose from "mongoose";
import Order from "../Models/Order.js";
import User from "../Models/User.js";
import DepartmentHistory from "../Models/DepartmentHistory.js";

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
                    regularB12Revenue: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b12", { $subtract: [{ $ifNull: ["$clientData.price12", 0] }, 170] }] }, 0] } },
                    regularB12Expense: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b12", 170] }, 0] } },
                    regularB12Amount: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b12", { $ifNull: ["$clientData.price12", 0] }] }, 0] } },
                    totalRegularB19Bottles: { $sum: { $cond: ["$isRegular", "$products.b19", 0] } },
                    regularB19Revenue: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b19", { $subtract: [{ $ifNull: ["$clientData.price19", 0] }, 250] }] }, 0] } },
                    regularB19Expense: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b19", 250] }, 0] } },
                    regularB19Amount: { $sum: { $cond: ["$isRegular", { $multiply: ["$products.b19", { $ifNull: ["$clientData.price19", 0] }] }, 0] } },

                    totalAdditionalOrders: { $sum: { $cond: ["$isAdditional", 1, 0] } },
                    totalAdditionalB12Bottles: { $sum: { $cond: ["$isAdditional", "$products.b12", 0] } },
                    additionalB12Revenue: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b12", { $subtract: [{ $ifNull: ["$clientData.price12", 0] }, 270] }] }, 0] } },
                    additionalB12Expense: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b12", 270] }, 0] } },
                    additionalB12Amount: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b12", { $ifNull: ["$clientData.price12", 0] }] }, 0] } },
                    totalAdditionalB19Bottles: { $sum: { $cond: ["$isAdditional", "$products.b19", 0] } },
                    additionalB19Revenue: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b19", { $subtract: [{ $ifNull: ["$clientData.price19", 0] }, 400] }] }, 0] } },
                    additionalB19Expense: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b19", 400] }, 0] } },
                    additionalB19Amount: { $sum: { $cond: ["$isAdditional", { $multiply: ["$products.b19", { $ifNull: ["$clientData.price19", 0] }] }, 0] } },
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
            percentage: ((order.count / totalOrders) * 100).toFixed(0)
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
                    B19Revenue: { $sum: { $multiply: ["$products.b19", { $subtract: [{ $ifNull: ["$clientData.price19", 0] }, 400] }] } },
                    B12Revenue: { $sum: { $multiply: ["$products.b12", { $subtract: [{ $ifNull: ["$clientData.price12", 0] }, 270] }] } },
                    B19FaktRevenue: {
                        $sum: { $cond: [{ $eq: ["$opForm", "fakt"] }, { $sum: { $multiply: ["$products.b19", { $subtract: [{ $ifNull: ["$clientData.price19", 0] }, 400] }] } }, 0] }
                    },
                    B12FaktRevenue: {
                        $sum: { $cond: [{ $eq: ["$opForm", "fakt"] }, { $sum: { $multiply: ["$products.b12", { $subtract: [{ $ifNull: ["$clientData.price12", 0] }, 270] }] } }, 0] }
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

export const getFranchiseeAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;

        // Фильтр по диапазону дат
        const filter = {
            status: "delivered",
            "date.d": { $gte: startDate, $lte: endDate }
        };

        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);

        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);

        const filterDH = {
            createdAt: {$gte: sDate, $lte: eDate}
        }

        const franchisee = await User.find({ role: "admin" }).select("_id fullName");

        const departmentHistoryStats = await DepartmentHistory.aggregate([
            { $match: filterDH },
            {
                $group: {
                    _id: {
                        franchiseeId: "$franchisee",
                    },
                    totalTookAwayB121: { $sum: { $cond: ["$type", 0, "$data.b121kol"] } },
                    totalTookAwayB191: { $sum: { $cond: ["$type", 0, "$data.b191kol"] } },
                    totalTookAwayB197: { $sum: { $cond: ["$type", 0, "$data.b197kol"] } }
                }
            }  
        ])

        const ordersStats = await Order.aggregate([
            { $match: filter }, // Фильтр по диапазону дат
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
                $addFields: { fakt: { $and: [ { $eq: ["$opForm", "fakt"] }, { $eq: ["$transferred", true] } ] } }
            },
            {
                $group: {
                    _id: {
                        transferredFranchise: {$ifNull: ["$transferredFranchise", ""]},
                        franchiseeId: "$franchisee",
                        transferred: "$transferred"
                    },
                    totalRegularB12Bottles: { $sum: { $cond: ["$transferred", 0, "$products.b12"] } },
                    totalRegularB19Bottles: { $sum: { $cond: ["$transferred", 0, "$products.b19"] } },
                    totalAddtitionalB12Bottles: { $sum: { $cond: ["$transferred", "$products.b12", 0] } },
                    totalAddtitionalB19Bottles: { $sum: { $cond: ["$transferred", "$products.b19", 0] } },
                    totalRgularSumB19: { $sum: {$cond: ["$transferred", 0, { $multiply: ["$products.b19", { $ifNull: ["$clientData.price19", 0] }] } ] } },
                    totalRgularSumB12: { $sum: {$cond: ["$transferred", 0, { $multiply: ["$products.b12", { $ifNull: ["$clientData.price12", 0] }] } ] } },
                    totalAdditionalSumB19: { $sum: {$cond: ["$transferred", { $multiply: ["$products.b19", { $ifNull: ["$clientData.price19", 0] }] }, 0] } },
                    totalAdditionalSumB12: { $sum: {$cond: ["$transferred", { $multiply: ["$products.b12", { $ifNull: ["$clientData.price12", 0] }] }, 0] } },
                    haveTo: { 
                        $sum: { 
                            $cond: [
                                "$transferred", 
                                { $add: [ {$multiply: [ "$products.b19", { $ifNull: ["$clientData.price19", 0] } ] }, {$multiply: [ "$products.b12", { $ifNull: ["$clientData.price12", 0] } ] } ] },
                                0
                            ] 
                        } 
                    },
                    fakt: {
                        $sum: {
                            $cond: [
                                "$fakt",
                                { $add: [ {$multiply: [ "$products.b19", { $ifNull: ["$clientData.price19", 0] } ] }, {$multiply: [ "$products.b12", { $ifNull: ["$clientData.price12", 0] } ] } ] },
                                0
                            ]
                        }
                    },
                    owe: { 
                        $sum: { 
                            $cond: [
                                "$transferred", 
                                { $add: [ {$multiply: [ "$products.b19", 400 ] }, {$multiply: [ "$products.b12", 270 ] } ] },
                                { $add: [ {$multiply: [ "$products.b19", 250 ] }, {$multiply: [ "$products.b12", 170 ] } ] }
                            ] 
                        } 
                    }
                }
            }
        ]);

        // Создаем объект для хранения статистики по франчайзи
        const franchiseeStats = {};
        franchisee.forEach(fran => {
            franchiseeStats[fran._id] = {
                _id: fran._id,
                totalRegularB12Bottles: 0,
                totalRegularB19Bottles: 0,
                totalAddtitionalB12Bottles: 0,
                totalAddtitionalB19Bottles: 0,
                totalRgularSumB19: 0,
                totalAdditionalSumB19: 0,
                totalRgularSumB12: 0,
                totalAdditionalSumB12: 0,
                haveTo: 0,
                fakt: 0,
                owe: 0,
                tookAwayB12: 0,
                tookAwayB19: 0,
                fullName: fran.fullName
            };
        });

        // Обрабатываем результаты агрегации
        ordersStats.forEach(stat => {
            const franchiseeId = stat._id.transferred ? stat._id.transferredFranchise : stat._id.franchiseeId?.toString();
            const franchiseeEntry = franchisee.find(fran => stat._id.transferred ? fran.fullName === franchiseeId : fran._id.toString() === franchiseeId);

            if (franchiseeEntry) {
                franchiseeStats[franchiseeEntry._id].totalRegularB12Bottles += stat.totalRegularB12Bottles;
                franchiseeStats[franchiseeEntry._id].totalRegularB19Bottles += stat.totalRegularB19Bottles;
                franchiseeStats[franchiseeEntry._id].totalAddtitionalB19Bottles += stat.totalAddtitionalB19Bottles;
                franchiseeStats[franchiseeEntry._id].totalAddtitionalB12Bottles += stat.totalAddtitionalB12Bottles;
                franchiseeStats[franchiseeEntry._id].totalRgularSumB19 += stat.totalRgularSumB19;
                franchiseeStats[franchiseeEntry._id].totalRgularSumB12 += stat.totalRgularSumB12;
                franchiseeStats[franchiseeEntry._id].totalAdditionalSumB19 += stat.totalAdditionalSumB19;
                franchiseeStats[franchiseeEntry._id].totalAdditionalSumB12 += stat.totalAdditionalSumB12;
                franchiseeStats[franchiseeEntry._id].haveTo += stat.haveTo;
                franchiseeStats[franchiseeEntry._id].fakt += stat.fakt;
                franchiseeStats[franchiseeEntry._id].owe += stat.owe;
            }
        });

        departmentHistoryStats.forEach(stat => {
            const franchiseeEntry = franchisee.find(fran => fran._id.toString() === stat._id.franchiseeId.toString())
            if (franchiseeEntry) {
                franchiseeStats[franchiseeEntry._id].tookAwayB12 += stat.totalTookAwayB121
                franchiseeStats[franchiseeEntry._id].tookAwayB19 += stat.totalTookAwayB191 + stat.totalTookAwayB197
            }
        })

        res.json({
            success: true,
            stats: Object.values(franchiseeStats) // Преобразуем объект в массив
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

