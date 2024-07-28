import Order from "../Models/Order.js";
import User from "../Models/User.js";

export const addOrder = async (req, res) => {
    try {
        const { client, address, products, courier, date, clientNotes } =
            req.body;

        const sum =
            Number(products.b12) * Number(client.price12) +
            Number(products.b19) * Number(client.price19);

        const order = new Order({
            franchisee: client.franchisee,
            client,
            address,
            products,
            date,
            courier,
            sum,
            clientNotes: clientNotes || "",
        });

        await order.save();

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

export const getOrders = async (req, res) => {
    try {
        const id = req.userId;
        const { page, startDate, endDate, status, product, sort, courier } =
            req.body;

        const sDate = startDate
            ? new Date(`${startDate}T00:00:00.000Z`)
            : new Date("2024-01-01T00:00:00.000Z");
        const eDate = endDate
            ? new Date(`${endDate}T23:59:59.999Z`)
            : new Date("2026-01-01T23:59:59.999Z");

        const limit = 3;
        const skip = (page - 1) * limit;

        const user = await User.findById(id);

        // Строим базовый фильтр
        const filter = {
            createdAt: { $gte: sDate, $lte: eDate },
        };

        // Добавляем фильтр по статусу, если он не "all"
        if (status !== "all") {
            filter.status = status;
        }

        // Добавляем фильтр по франчайзи для админа
        if (user.role === "admin") {
            filter.franchisee = id;
        }

        // Выполняем запрос с фильтрацией, сортировкой, пропуском и лимитом
        // Добавляем фильтр по продукту, если он указан
        if (product !== "all") {
            const productFilter = {};
            productFilter[`products.${product}`] = { $gt: 0 };
            Object.assign(filter, productFilter);
        }

        // Добавляем фильтр по курьеру, если он указан
        if (courier) {
            filter.courier = courier;
        }

        // Обрабатываем параметры сортировки
        const sortOptions = {};
        switch (sort) {
            case "new":
                sortOptions.createdAt = -1; // Сортировка по убыванию даты создания (новые)
                break;
            case "old":
                sortOptions.createdAt = 1; // Сортировка по возрастанию даты создания (старые)
                break;
            case "expensive":
                sortOptions.sum = -1; // Сортировка по убыванию суммы (дорогие)
                break;
            case "cheap":
                sortOptions.sum = 1; // Сортировка по возрастанию суммы (дешевые)
                break;
            default:
                sortOptions.createdAt = 1; // Сортировка по умолчанию по дате создания
                break;
        }

        // Выполняем запрос с фильтрацией, сортировкой, пропуском и лимитом
        const orders = await Order.find(filter)
            .populate("franchisee")
            .populate("courier")
            .populate("client")
            .sort(sortOptions)
            .skip(skip)
            .limit(limit);

        res.json({ orders });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getFreeInfoOrder = async (req, res) => {
    try {
        const id = req.userId;

        const user = await User.findById(id);

        const filter = {};

        if (user.role === "admin") {
            filter.franchisee = id;
        }

        const aggregatedData = await Order.aggregate([
            {
                $match: filter, // Применяем фильтр перед группировкой
            },
            {
                $group: {
                    _id: null, // Мы не группируем по какому-либо конкретному полю, поэтому используем null
                    totalB12: { $sum: "$products.b12" },
                    totalB19: { $sum: "$products.b19" },
                    totalSum: { $sum: "$sum" },
                    orderCount: { $sum: 1 }, // Добавляем подсчет количества заказов
                },
            },
            {
                $project: {
                    _id: 0, // Исключаем поле _id из результата
                    totalB12: 1,
                    totalB19: 1,
                    totalSum: 1,
                    orderCount: 1, // Включаем поле orderCount в результат
                },
            },
        ]);

        res.json(aggregatedData[0]);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};
