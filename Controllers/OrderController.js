import Notification from "../Models/Notification.js";
import Order from "../Models/Order.js";
import User from "../Models/User.js";
import Client from "../Models/Client.js";
import Courier from "../Models/Courier.js";

export const addOrder = async (req, res) => {
    try {
        const { client, address, products, courier, date, clientNotes, opForm } =
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
            opForm
        });

        await order.save();

        if (courier) {
            const cour = await Courier.findById(courier)

            const courierOrder = {order: order._id, orderStatus: "inLine"}

            cour.orders.push(courierOrder)

            await cour.save()
        }

        let orConditions = [
            {
                fullName: client.fullName,
                franchisee: { $ne: client.franchisee },
            },
            { phone: client.phone, franchisee: { $ne: client.franchisee } },
            { mail: client.mail, franchisee: { $ne: client.franchisee } },
        ];

        const existingOrders = await Order.findOne({ $or: orConditions });

        if (existingOrders) {
            let matchedField;
            if (existingOrders.mail === mail && mail !== "")
                matchedField = "mail";
            else if (existingOrders.fullName === fullName)
                matchedField = "fullName";
            else if (existingOrders.phone === phone) matchedField = "phone";

            const notDoc = new Notification({
                first: existingOrders.franchisee,
                second: franchisee,
                matchesType: "order",
                matchedField,
                firstObject: existingOrders._id,
                secondObject: order._doc._id,
            });

            await notDoc.save();

            const notification = {
                message: "Есть совпадение заказов",
            };

            global.io.emit("orderMatch", notification);
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

export const getOrders = async (req, res) => {
    try {
        const id = req.userId;
        const { page, startDate, endDate, status, product, sort, courier, search, searchStatus } =
            req.body;

        const sDate = startDate
            ? new Date(`${startDate}T00:00:00.000Z`)
            : new Date("2024-01-01T00:00:00.000Z");
        const eDate = endDate
            ? new Date(`${endDate}T23:59:59.999Z`)
            : new Date("2026-01-01T23:59:59.999Z");

        const limit = 5;
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

        

        if (searchStatus && search) {
            // Find clients that match the search criteria
            const clients = await Client.find({
                $or: [
                    { fullName: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } },
                ]
            }).select('_id');

            const clientIds = clients.map(client => client._id);

            // Update the filter to include orders with matching clients or addresses
            filter.$or = [
                { client: { $in: clientIds } },
                { "address.actual": { $regex: search, $options: "i" } }
            ];
        }

        // Execute the query with the updated filter
        const orders = await Order.find({
            $or: [
                { ...filter }, // Первое условие — фильтр с конкретными полями
                { transferredFranchise: user.fullName } // Второе условие — передаем transferredFranchise
            ]
        })
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

export const getClientOrders = async (req, res) => {
    try {
        const { page, clientId } = req.body;

        const limit = 3;
        const skip = (page - 1) * limit;

        // Выполняем запрос с фильтрацией, сортировкой, пропуском и лимитом
        const orders = await Order.find({client: clientId})
            .populate("franchisee")
            .populate("courier")
            .populate("client")
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit);

        res.json({ orders });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

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

export const getOrderDataForId = async (req, res) => {
    try {
        const { id } = req.body;

        const order = await Order.findById(id)
            .populate("franchisee")
            .populate("courier")
            .populate("client");

        res.json({
            order,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const updateOrder = async (req, res) => {
    try {
        const id = req.userId;
        const { orderId, change, changeData } = req.body;

        const user = await User.findById(id);

        if (!user) {
            return res.json({
                success: false,
                message: "Не удалось найти пользователя",
            });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.json({
                success: false,
                message: "Не удалось найти заказ",
            });
        }

        if (change === "status") {
            order.status = changeData;
            let changeStatus = "Ожидает заказ";
            switch (changeData) {
                case "awaitingOrder":
                    changeStatus = "Ожидает заказ";
                    break;
                case "onTheWay":
                    changeStatus = "В пути";
                    break;
                case "delivered":
                    changeStatus = "Доставлен";
                    break;
                case "cancelled":
                    changeStatus = "Отменен";
                    break;
                default:
                    changeStatus = "Ожидает заказ";
                    break;
            }
            order.history.push(
                `Пользователь ${user.fullName} изменил статус на "${changeStatus}"`
            );
            await order.save();
        } else {
            order.courier = changeData._id;
            order.history.push(
                `Пользователь ${user.fullName} изменил курьера на "${changeData.fullName}"`
            );
            await order.save();
        }

        if (change === "courier") {
            const courier = await Courier.findById(changeData._id)

            const courierOrder = {order: order._id, orderStatus: "inLine"}

            courier.orders.push(courierOrder)

            await courier.save()
        }

        if (change === "opForm") {
            order.opForm = changeData

            await order.save()
        }

        if (change === "products") {
            order.products = changeData
            const client = await Client.findById(order.client)
            const sum =
            Number(changeData.b12) * Number(client.price12) +
            Number(changeData.b19) * Number(client.price19);
            order.sum = sum
            await order.save()
        }

        if (change === "date") {
            order.date = changeData

            await order.save()
        }

        res.json({
            success: true,
            message: "Заказ успешно изменен",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const updateOrderTransfer = async (req, res) => {
    try {
        const { orderId, change, changeData } = req.body;

        const order = await Order.findById(orderId)

        if (!order) {
            return res
                .status(404)
                .json({ success: false, message: "Order not found" });
        }

        order[change] = changeData
        if (changeData === "") {
            order.transferred = false
        } else {
            order.transferred = true
        }
        await order.save()

        res.json({ success: true, message: "Данные успешно изменены" });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getOrdersForExcel = async (req, res) => {
    try {
        const id = req.userId;
        const { startDate, endDate, status, product, sort, courier } = req.body;

        const sDate = startDate
            ? new Date(`${startDate}T00:00:00.000Z`)
            : new Date("2024-01-01T00:00:00.000Z");
        const eDate = endDate
            ? new Date(`${endDate}T23:59:59.999Z`)
            : new Date("2026-01-01T23:59:59.999Z");

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
            .populate("client", "userName")
            .sort(sortOptions);

        res.json({ orders });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getClientOrdersForExcel = async (req, res) => {
    try {
        const { clientId } = req.body;

        // Выполняем запрос с фильтрацией, сортировкой, пропуском и лимитом
        const orders = await Order.find({client: clientId})
            .populate("courier", "fullName")
            .populate("client", "userName")
            .sort({createdAt: 1});

        res.json({ orders });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getAdditionalOrders = async (req, res) => {
    try {
        const id = req.userId;
        const user = await User.findById(id)

        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            })
        }
        const userName = user.fullName
        const orders = await Order.find({transferredFranchise: userName})
        
        res.json({orders})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}
