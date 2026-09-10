import Client from "../Models/Client.js";
import Order from "../Models/Order.js";

/**
 * Публичная (по API-ключу) отчётность для рекламного агентства: регистрации,
 * заказы и повторные заказы с фильтрацией по датам. Установки сюда не входят —
 * агентство получает их из своей SDK-аналитики (Adjust/AppsFlyer/Meta) и
 * сопоставляет с userId из этих ответов самостоятельно.
 */

const MAX_LIMIT = 2000;
const DEFAULT_LIMIT = 500;
const DEFAULT_RANGE_DAYS = 30;

const parseDateRange = (query) => {
    const now = new Date();
    const start = query.startDate
        ? new Date(query.startDate)
        : new Date(now.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    const end = query.endDate ? new Date(query.endDate) : now;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return null;
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

const parsePagination = (query) => {
    const limit = Math.min(
        Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1),
        MAX_LIMIT
    );
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    return { limit, page, skip: (page - 1) * limit };
};

const badDateRangeResponse = (res) =>
    res.status(400).json({
        success: false,
        message: "Некорректный формат даты. Используйте YYYY-MM-DD в startDate/endDate",
    });

// Дата, кол-во регистраций, user_id — для атрибуции (install/user_id).
export const getRegistrations = async (req, res) => {
    try {
        const range = parseDateRange(req.query);
        if (!range) return badDateRangeResponse(res);
        const { start, end } = range;
        const { limit, page, skip } = parsePagination(req.query);

        const filter = { createdAt: { $gte: start, $lte: end } };

        const [count, clients] = await Promise.all([
            Client.countDocuments(filter),
            Client.find(filter)
                .select("_id createdAt")
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(limit),
        ]);

        res.json({
            success: true,
            count,
            page,
            limit,
            registrations: clients.map((client) => ({
                userId: client._id,
                date: client.createdAt,
            })),
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};

// Дата, сумма, user_id на каждом заказе — "кто заказал".
export const getOrders = async (req, res) => {
    try {
        const range = parseDateRange(req.query);
        if (!range) return badDateRangeResponse(res);
        const { start, end } = range;
        const { limit, page, skip } = parsePagination(req.query);

        const filter = { createdAt: { $gte: start, $lte: end } };

        const [totals, orders] = await Promise.all([
            Order.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        totalSum: { $sum: { $ifNull: ["$sum", 0] } },
                    },
                },
            ]),
            Order.find(filter)
                .select("_id client createdAt sum status")
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(limit),
        ]);

        res.json({
            success: true,
            count: totals[0]?.count || 0,
            totalSum: totals[0]?.totalSum || 0,
            page,
            limit,
            orders: orders.map((order) => ({
                orderId: order._id,
                userId: order.client,
                date: order.createdAt,
                sum: order.sum,
                status: order.status,
            })),
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};

// Клиенты с более чем одним заказом в периоде, с user_id на каждом вложенном заказе.
export const getRepeatOrders = async (req, res) => {
    try {
        const range = parseDateRange(req.query);
        if (!range) return badDateRangeResponse(res);
        const { start, end } = range;
        const { limit, page, skip } = parsePagination(req.query);

        const filter = {
            createdAt: { $gte: start, $lte: end },
            client: { $ne: null },
        };

        const groupStage = {
            $group: {
                _id: "$client",
                ordersCount: { $sum: 1 },
                totalSum: { $sum: { $ifNull: ["$sum", 0] } },
                firstOrderDate: { $min: "$createdAt" },
                lastOrderDate: { $max: "$createdAt" },
                orders: {
                    $push: {
                        orderId: "$_id",
                        date: "$createdAt",
                        sum: "$sum",
                        status: "$status",
                    },
                },
            },
        };

        const [repeatCustomers, countResult] = await Promise.all([
            Order.aggregate([
                { $match: filter },
                { $sort: { createdAt: 1 } },
                groupStage,
                { $match: { ordersCount: { $gt: 1 } } },
                { $sort: { ordersCount: -1 } },
                { $skip: skip },
                { $limit: limit },
            ]),
            Order.aggregate([
                { $match: filter },
                { $group: { _id: "$client", ordersCount: { $sum: 1 } } },
                { $match: { ordersCount: { $gt: 1 } } },
                { $count: "total" },
            ]),
        ]);

        res.json({
            success: true,
            count: countResult[0]?.total || 0,
            page,
            limit,
            repeatCustomers: repeatCustomers.map((customer) => ({
                userId: customer._id,
                ordersCount: customer.ordersCount,
                repeatOrdersCount: customer.ordersCount - 1,
                totalSum: customer.totalSum,
                firstOrderDate: customer.firstOrderDate,
                lastOrderDate: customer.lastOrderDate,
                orders: customer.orders,
            })),
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};
