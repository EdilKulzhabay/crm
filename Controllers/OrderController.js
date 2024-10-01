import Notification from "../Models/Notification.js";
import Order from "../Models/Order.js";
import User from "../Models/User.js";
import Client from "../Models/Client.js";
import Courier from "../Models/Courier.js";
import mongoose from "mongoose";

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
        
            // Проверка на наличие почты и совпадение
            if (existingOrders.mail && existingOrders.mail === mail) {
                matchedField = "mail";
            }
            // Проверка на совпадение имени
            else if (existingOrders.fullName && existingOrders.fullName === fullName) {
                matchedField = "fullName";
            }
            // Проверка на совпадение телефона
            else if (existingOrders.phone && existingOrders.phone === phone) {
                matchedField = "phone";
            }
        
            if (matchedField) {
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
        const { page, startDate, endDate, search, searchStatus } =
            req.body;

        const sDate = startDate !== ""
            ? new Date(`${startDate}T00:00:00.000Z`)
            : new Date("2024-01-01T00:00:00.000Z");
        const eDate = endDate !== ""
            ? new Date(`${endDate}T23:59:59.999Z`)
            : new Date("2026-01-01T23:59:59.999Z");

        const limit = 5;
        const skip = (page - 1) * limit;

        const user = await User.findById(id);

        const filter = {
            createdAt: { $gte: sDate, $lte: eDate },
            status: { $nin: ["delivered", "cancelled"] },
        }

        // Добавляем фильтр по франчайзи для админа
        if (user.role === "admin") {
            filter.franchisee = id;
        }

        if (searchStatus && search) {
            // Find clients that match the search criteria
            const clients = await Client.find({
                $or: [
                    { userName: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } },
                ]
            }).select('_id');

            const clientIds = clients.map(client => client._id);

            if (user.role === "admin") {
                delete filter.$or; // Удаляем $or, если он пустой

                filter.$and = [
                    {
                        $or: [
                            { franchisee: id },
                            { transferredFranchise: user.fullName }
                        ]
                    },
                    {
                        $or: [
                            { client: { $in: clientIds } },
                            { "address.actual": { $regex: search, $options: "i" } }
                        ]
                    }
                ];
            }
        }

        if (filter.$or && filter.$or.length === 0) {
            delete filter.$or; // Удаляем $or, если он пустой
        }

        // Execute the query with the updated filter
        const orders = await Order.find({
            $or: [
                { ...filter }, // Первое условие — фильтр с конкретными полями
            ]
        })
            .populate("franchisee")
            .populate("courier")
            .populate("client")
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
        } 

        if (change === "courier") {
            const courier = await Courier.findById(changeData._id)
            const courierOrder = {order: order._id, orderStatus: "inLine"}
            courier.orders.push(courierOrder)
            await courier.save()

            order.courier = changeData._id;
            await order.save();
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
            if (order.courier) {
                const courierId = order.courier
                await Courier.updateOne(
                    { _id: courierId }, // находим курьера по его ID
                    { $pull: { orders: { order: orderId } } } // удаляем элемент из массива orders, где order равен orderId
                );
            }
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
        const { startDate, endDate, search, searchStatus } = req.body;

        const sDate = startDate !== ""
            ? new Date(`${startDate}T00:00:00.000Z`)
            : new Date("2024-01-01T00:00:00.000Z");
        const eDate = endDate !== ""
            ? new Date(`${endDate}T23:59:59.999Z`)
            : new Date("2026-01-01T23:59:59.999Z");

        const user = await User.findById(id);

        // Строим базовый фильтр
        const filter = {
            status: { $in: ["delivered", "cancelled"] },
            createdAt: { $gte: sDate, $lte: eDate },
        };
        // Добавляем фильтр по франчайзи для админа
        if (user.role === "admin") {
            filter.$or = [
                {franchisee: id},
                {transferredFranchise: user.fullName}
            ]
        }

        if (searchStatus && search) {
            // Find clients that match the search criteria
            const clients = await Client.find({
                $or: [
                    { userName: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } },
                    { fullName: { $regex: search, $options: "i" } },
                ]
            }).select('_id');

            const clientIds = clients.map(client => client._id);

            if (user.role === "admin") {
                delete filter.$or; // Удаляем $or, если он пустой

                filter.$and = [
                    {
                        $or: [
                            { franchisee: id },
                            { transferredFranchise: user.fullName }
                        ]
                    },
                    {
                        $or: [
                            { client: { $in: clientIds } },
                            { "address.actual": { $regex: search, $options: "i" } }
                        ]
                    }
                ];
            }
        }

        if (filter.$or && filter.$or.length === 0) {
            delete filter.$or; // Удаляем $or, если он пустой
        }

        // Выполняем запрос с фильтрацией, сортировкой, пропуском и лимитом
        const orders = await Order.find(filter)
            .populate("client", "userName fullName")
            .populate("courier", "fullName")

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
        const filter = {
            transferredFranchise: userName,
            status: { $nin: ["delivered", "cancelled"] },
        }
        const orders = await Order.find(filter).populate("client").populate("courier", "fullName")
        
        res.json({orders})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getCompletedOrders = async (req, res) => {
    try {
        const id = req.userId;
        const {page, startDate, endDate, search, searchStatus} = req.body
        const user = await User.findById(id)
        const limit = 5;
        const skip = (page - 1) * limit;

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
        const day = String(today.getDate()).padStart(2, '0');
        const todayDate = `${year}-${month}-${day}`;
        const tomorrow = new Date(today); // Копируем сегодняшнюю дату
        tomorrow.setDate(today.getDate() + 1);  
        const tYear = tomorrow.getFullYear();
        const tMonth = String(tomorrow.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
        const tDay = String(tomorrow.getDate()).padStart(2, '0');
        const tomorrowDate = `${tYear}-${tMonth}-${tDay}`;
        

        // Устанавливаем начальную и конечную даты
        let sDate = startDate !== "" ? new Date(`${startDate}T00:00:00.000Z`) : new Date(`${todayDate}T00:00:00.000Z`);
        let eDate = endDate !== "" ? new Date(`${endDate}T23:59:59.999Z`) : new Date(`${tomorrowDate}T00:00:00.000Z`) // +1 день

        if (startDate === "" && searchStatus) {
            sDate = new Date("2024-01-01T00:00:00.000Z");
            eDate = new Date("2030-01-01T00:00:00.000Z");
        }

        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            })
        }
        const filter = {
            status: { $in: ["delivered", "cancelled"] },
            createdAt: { $gte: sDate, $lte: eDate },
        }

        if (user.role === "admin") {
            filter.$or = [
                {franchisee: new mongoose.Types.ObjectId(id)},
                {transferredFranchise: user.fullName}
            ]
        }

        if (searchStatus && search) {
            // Find clients that match the search criteria
            const clients = await Client.find({
                $or: [
                    { userName: { $regex: search, $options: "i" } },
                    { fullName: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } },
                ]
            }).select('_id');

            const clientIds = clients.map(client => client._id);

            if (user.role === "admin") {
                delete filter.$or; // Удаляем $or, если он пустой

                filter.$and = [
                    {
                        $or: [
                            { franchisee: new mongoose.Types.ObjectId(id)},
                            { transferredFranchise: user.fullName }
                        ]
                    },
                    {
                        $or: [
                            { client: { $in: clientIds } },
                            { "address.actual": { $regex: search, $options: "i" } }
                        ]
                    }
                ];
            }
        }

        const ordersResult = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalB12: { $sum: "$products.b12" },
                    totalB19: { $sum: "$products.b19" },
                    totalSum: { $sum: "$sum" },
                    orders: { $push: "$$ROOT" }, // Push all orders
                },
            },
        ]);

        const orders = await Order.find(filter)
            .populate("client")
            .limit(limit)
            .skip(skip)

        const result = ordersResult.length > 0 ? ordersResult[0] : { totalB12: 0, totalB19: 0, totalSum: 0 };

        // Ответ сервера
        res.json({
            orders: orders ? orders : [],
            totalB12: result.totalB12,
            totalB19: result.totalB19,
            totalSum: result.totalSum,
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}
