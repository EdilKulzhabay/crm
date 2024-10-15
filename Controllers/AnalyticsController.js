import mongoose from "mongoose";
import Order from "../Models/Order.js";
import User from "../Models/User.js";

export const getAnalyticsData = async (req, res) => {
    try {
        const { id, startDate, endDate } = req.body;

        const user = await User.findById(id);

        if (!user) {
            return res.json({
                success: false,
                message: "User not found",
            });
        }

        const filter = {
            status: { $in: ["delivered", "cancelled"] },
            "date.d": { $gte: startDate, $lte: endDate },
        };

        let orCondition = [];
        if (user.role === "admin") {
            orCondition = [
                { franchisee: new mongoose.Types.ObjectId(id) },
                { transferredFranchise: user.fullName },
            ];
        }

        const orders = await Order.aggregate([
            { $match: { ...filter, $or: orCondition } },
            {
                $lookup: {
                    from: "clients",
                    localField: "client",
                    foreignField: "_id",
                    as: "clientDetails",
                },
            },
            { $unwind: "$clientDetails" },
            {
                $group: {
                    _id: null,
                    totalRegularB12Bottles: {
                        $sum: {
                            $cond: [
                                { $eq: ["$franchisee", new mongoose.Types.ObjectId(id)] },
                                "$products.b12",
                                0,
                            ],
                        },
                    },
                    regularB12Revenue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$franchisee", new mongoose.Types.ObjectId(id)] },
                                { $multiply: ["$products.b12", { $subtract: ["$clientDetails.price12", 170] }] },
                                0,
                            ],
                        },
                    },
                    regularB12Expense: {
                        $sum: {
                            $cond: [
                                { $eq: ["$franchisee", new mongoose.Types.ObjectId(id)] },
                                { $multiply: ["$products.b12", 170] },
                                0,
                            ],
                        },
                    },
                    regularB12Amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$franchisee", new mongoose.Types.ObjectId(id)] },
                                { $multiply: ["$products.b12", "$clientDetails.price12"] },
                                0,
                            ],
                        },
                    },
                    totalRegularB19Bottles: {
                        $sum: {
                            $cond: [
                                { $eq: ["$franchisee", new mongoose.Types.ObjectId(id)] },
                                "$products.b19",
                                0,
                            ],
                        },
                    },
                    regularB19Revenue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$franchisee", new mongoose.Types.ObjectId(id)] },
                                { $multiply: ["$products.b19", { $subtract: ["$clientDetails.price19", 250] }] },
                                0,
                            ],
                        },
                    },
                    regularB19Expense: {
                        $sum: {
                            $cond: [
                                { $eq: ["$franchisee", new mongoose.Types.ObjectId(id)] },
                                { $multiply: ["$products.b19", 250] },
                                0,
                            ],
                        },
                    },
                    regularB19Amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$franchisee", new mongoose.Types.ObjectId(id)] },
                                { $multiply: ["$products.b19", "$clientDetails.price19"] },
                                0,
                            ],
                        },
                    },
                    totalAdditionalB12Bottles: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transferredFranchise", user.fullName] },
                                "$products.b12",
                                0,
                            ],
                        },
                    },
                    additionalB12Revenue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transferredFranchise", user.fullName] },
                                { $multiply: ["$products.b12", { $subtract: ["$clientDetails.price12", 270] }] },
                                0,
                            ],
                        },
                    },
                    additionalB12Expense: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transferredFranchise", user.fullName] },
                                { $multiply: ["$products.b12", 270] },
                                0,
                            ],
                        },
                    },
                    additionalB12Amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transferredFranchise", user.fullName] },
                                { $multiply: ["$products.b12", "$clientDetails.price12"] },
                                0,
                            ],
                        },
                    },
                    totalAdditionalB19Bottles: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transferredFranchise", user.fullName] },
                                "$products.b19",
                                0,
                            ],
                        },
                    },
                    additionalB19Revenue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transferredFranchise", user.fullName] },
                                { $multiply: ["$products.b19", { $subtract: ["$clientDetails.price19", 400] }] },
                                0,
                            ],
                        },
                    },
                    additionalB19Expense: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transferredFranchise", user.fullName] },
                                { $multiply: ["$products.b19", 400] },
                                0,
                            ],
                        },
                    },
                    additionalB19Amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transferredFranchise", user.fullName] },
                                { $multiply: ["$products.b19", "$clientDetails.price19"] },
                                0,
                            ],
                        },
                    },
                },
            },
        ]);

        const stats = orders.length > 0 ? orders[0] : {};

        stats.regularAverageCostB12 = stats.totalRegularB12Bottles
            ? stats.regularB12Amount / stats.totalRegularB12Bottles
            : 0;
        stats.regularAverageCostB19 = stats.totalRegularB19Bottles
            ? stats.regularB19Amount / stats.totalRegularB19Bottles
            : 0;
        stats.additionalAverageCostB12 = stats.totalAdditionalB12Bottles
            ? stats.additionalB12Amount / stats.totalAdditionalB12Bottles
            : 0;
        stats.additionalAverageCostB19 = stats.totalAdditionalB19Bottles
            ? stats.additionalB19Amount / stats.totalAdditionalB19Bottles
            : 0;

        res.json({ stats });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

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
