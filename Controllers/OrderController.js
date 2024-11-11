import Notification from "../Models/Notification.js";
import Order from "../Models/Order.js";
import User from "../Models/User.js";
import Client from "../Models/Client.js";
import Courier from "../Models/Courier.js";
import mongoose from "mongoose";

export const addOrder = async (req, res) => {
    try {
        const { franchisee, client, address, products, courier, date, clientNotes, opForm, comment } =
            req.body;

        let transferred = false;
        let transferredFranchise = "";

        if (franchisee !== null) {
            transferred = true;
            transferredFranchise = franchisee.fullName
        }

        const sum =
            Number(products.b12) * Number(client.price12) +
            Number(products.b19) * Number(client.price19);

        const filter = {
            "address.actual": address.actual,
            "date.d": date.d,
            client: client
        }

        const findOrder = await Order.find(filter)

        if (findOrder.length !== 0) {
            return res.json({
                success: false,
            });
        }

        const order = new Order({
            franchisee: client.franchisee,
            client,
            address,
            products,
            date,
            courier,
            sum,
            clientNotes: clientNotes || "",
            opForm,
            comment: comment || "",
            transferred,
            transferredFranchise
        });

        await order.save();

        if (courier) {
            const cour = await Courier.findById(courier)

            const courierOrder = {order: order._id, orderStatus: "inLine"}

            cour.orders.push(courierOrder)

            await cour.save()
        }

        let orConditions = []
        if (client.phone) {
            orConditions.push({ phone: client.phone, franchisee: { $ne: client.franchisee } })
        }
        
        const existingOrders = await Order.findOne({ $or: orConditions });
        
        if (existingOrders) {
            let matchedField;
            // Проверка на совпадение телефона
            if (existingOrders.phone && existingOrders.phone === phone) {
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

export const addOrder2 = async (req, res) => {
    try {
        const { franchisee, client, address, products, courier, date, clientNotes, opForm, comment } =
            req.body;

        let transferred = false;
        let transferredFranchise = "";

        if (franchisee !== null) {
            transferred = true;
            transferredFranchise = franchisee.fullName
        }

        const sum =
            Number(products.b12) * Number(client.price12) +
            Number(products.b19) * Number(client.price19);

        const filter = {
            "address.actual": address.actual,
            "date.d": date.d
        }

        const findOrder = await Order.find(filter)

        if (findOrder.length !== 0) {
            return res.json({
                success: false,
            });
        }

        const order = new Order({
            franchisee: client.franchisee,
            client,
            address,
            products,
            date,
            courier,
            sum,
            clientNotes: clientNotes || "",
            opForm,
            comment: comment || "",
            transferred,
            transferredFranchise,
            status: "delivered"
        });

        await order.save();

        if (courier) {
            const cour = await Courier.findById(courier)

            const courierOrder = {order: order._id, orderStatus: "inLine"}

            cour.orders.push(courierOrder)

            await cour.save()
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
        const { page, startDate, endDate, search, searchStatus, searchF, sa } =
            req.body;

        const limit = 5;
        const skip = (page - 1) * limit;

        const user = await User.findById(id);

        const filter = {
            "date.d": { $gte: startDate, $lte: endDate },
            status: { $nin: ["delivered", "cancelled"] },
        }

        // Добавляем фильтр по франчайзи для админа
        if (user.role === "admin") {
            filter.franchisee = id
        }

        if (sa) {
            filter.franchisee = id
        }

        if (user.role === "superAdmin" && searchF !== "") {
            // Сначала ищем франчайзи по имени или логину
            const franchisees = await User.find({
                $or: [
                    { fullName: { $regex: searchF, $options: "i" } },
                    { userName: { $regex: searchF, $options: "i" } }
                ]
            }).select('_id'); // Получаем только _id франчайзи
        
            // Извлекаем их ID
            const franchiseeIds = franchisees.map(franchisee => franchisee._id);
        
            // Добавляем ID франчайзи в фильтр заказов
            if (searchF === "empty") {
                filter.franchisee = id
                filter.transferred = false
            } else {
                if (sa) {
                    filter.transferredFranchise = { $regex: searchF, $options: "i" }
                } else {
                    filter.$or = [
                        { franchisee: { $in: franchiseeIds } }, // Применяем $in к полю franchisee
                        { transferredFranchise: { $regex: searchF, $options: "i" } } // Фильтр по transferredFranchise
                    ];
                }
            }
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

            filter.$or = [
                { client: { $in: clientIds } },
                { "address.actual": { $regex: search, $options: "i" } }
            ]
        }

        const totalOrders = await Order.countDocuments(filter)

        // Execute the query with the updated filter
        const orders = await Order.find(filter)
            .populate("franchisee")
            .populate("courier")
            .populate("client")
            .skip(skip)
            .limit(limit);

        res.json({ orders, totalOrders });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getClientOrders = async (req, res) => {
    try {
        const { page, clientId, startDate, endDate } = req.body;

        const limit = 3;
        const skip = (page - 1) * limit;

        const filter = {
            client: clientId,
            "date.d": { $gte: startDate, $lte: endDate }
        }

        // Выполняем запрос с фильтрацией, сортировкой, пропуском и лимитом
        const orders = await Order.find(filter)
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
            const client = await Client.findById(id)
            if (!client) {
                return res.json({
                    success: false,
                    message: "Не удалось найти пользователя",
                });
            }
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
            if (changeData === "delivered" || changeData === "cancelled") {
                const courierId = order.courier
                await Courier.updateOne(
                    { _id: courierId },
                    { $pull: { orders: { order: orderId } } }
                );
            }
            await order.save();
            
            const client = await Client.findById(order.client)
            const clientId = client._id.toHexString();
            global.io.to(clientId).emit("orderStatusChanged", {
                orderId: order._id,
                status: changeData,
                message: `Статус заказа #${order._id} был изменен на ${changeData}`,
            });

        } 

        if (change === "courier") {
            if (order?.courier) {
                const courierId = order.courier
                const lCourier = await Courier.findById(courierId)
                
                const orders = lCourier.orders.filter(item => item.order.toString() !== orderId.toString());
                lCourier.orders = orders
                await lCourier.save()
            }
            const courier = await Courier.findById(changeData._id)
            
            const courierOrder = {order: order._id, orderStatus: "inLine"}
            courier?.orders?.push(courierOrder)
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

        if (change === "comment") {
            order.comment = changeData
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
            if (order?.courier) {
                const courierId = order?.courier
                await Courier.updateOne(
                    { _id: courierId }, // находим курьера по его ID
                    { $pull: { orders: { order: orderId } } } // удаляем элемент из массива orders, где order равен orderId
                );
                order.courier = null
            }
        } else {
            order.transferred = true
            if (order?.courier) {
                const courierId = order?.courier
                await Courier.updateOne(
                    { _id: courierId }, // находим курьера по его ID
                    { $pull: { orders: { order: orderId } } } // удаляем элемент из массива orders, где order равен orderId
                );
                order.courier = null
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
        const {startDate, endDate, search, searchStatus, searchF} = req.body
        const user = await User.findById(id)

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
        
        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            })
        }
        const filter = {
            status: { $in: ["delivered", "cancelled"] },
            "date.d": { $gte: startDate !== "" ? startDate : todayDate, $lte: endDate !== "" ? endDate : tomorrowDate },
        }

        if (user.role === "admin") {
            filter.$or = [
                {franchisee: new mongoose.Types.ObjectId(id)},
                {transferredFranchise: user.fullName}
            ]
        }

        if (user.role === "superAdmin" && searchF !== "") {
            filter.transferredFranchise = { $regex: searchF, $options: "i" }
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
            } else {
                delete filter.$or;
                filter.$or = [
                    { client: { $in: clientIds } },
                    { "address.actual": { $regex: search, $options: "i" } }
                ]
            }
        }

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
        const { clientId, startDate, endDate } = req.body;

        const filter = {
            client: clientId,
            "date.d": { $gte: startDate, $lte: endDate },
            status: "delivered"
        }

        const orders = await Order.find(filter)
            .populate("courier", "fullName")
            .populate("client", "fullName userName")
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
        const {page, startDate, endDate, search, searchStatus, searchF, opForm, sa} = req.body
        
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
        
        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            })
        }
        const filter = {
            status: { $in: ["delivered", "cancelled"] },
            "date.d": { $gte: startDate !== "" ? startDate : todayDate, $lte: endDate !== "" ? endDate : tomorrowDate },
        }

        if (opForm !== "all") {
            filter.opForm = opForm
        }

        if (user.role === "admin") {
            filter.$or = [
                {franchisee: new mongoose.Types.ObjectId(id)},
                {transferredFranchise: user.fullName}
            ]
        }

        if (sa) {
            filter.franchisee = new mongoose.Types.ObjectId(id)
        }

        if (user.role === "superAdmin" && searchF !== "") {
            const franchisee = await User.find({fullName: { $regex: searchF, $options: "i" }})
            if (franchisee.length === 0) {
                return res.json({
                    orders: [],
                    result: { totalB12: 0, totalB19: 0, totalSum: 0, totalFakt: 0, totalCoupon: 0, totalPostpay: 0, totalCredit: 0, totalMixed: 0 }
                })
            }

            const franchiseeIds = franchisee.map(f => f._id);

            filter.$or = [
                {franchisee: { $in: franchiseeIds }},
                {transferredFranchise: { $regex: searchF, $options: "i" }}
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
            } else {
                delete filter.$or;
                filter.$or = [
                    { client: { $in: clientIds } },
                    { "address.actual": { $regex: search, $options: "i" } }
                ]
            }
        }

        const ordersResult = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalB12: { $sum: { $ifNull: ["$products.b12", 0] } },
                    totalB19: { $sum: { $ifNull: ["$products.b19", 0] } },
                    totalSum: { $sum: { $ifNull: ["$sum", 0] } },
                    totalFakt: { $sum: { $cond: [ { $eq: ["$opForm", "fakt"] }, 1, 0 ] } },
                    totalCoupon: { $sum: { $cond: [ { $eq: ["$opForm", "coupon"] }, 1, 0 ] } },
                    totalPostpay: { $sum: { $cond: [ { $eq: ["$opForm", "postpay"] }, 1, 0 ] } },
                    totalCredit: { $sum: { $cond: [ { $eq: ["$opForm", "credit"] }, 1, 0 ] } },
                    totalMixed: { $sum: { $cond: [ { $eq: ["$opForm", "mixed"] }, 1, 0 ] } },
                    orders: { $push: "$$ROOT" }, // Push all orders
                },
            },
        ]);

        const orders = await Order.find(filter)
            .populate("client")
            .limit(limit)
            .skip(skip)

        const result = ordersResult.length > 0 ? ordersResult[0] : { totalB12: 0, totalB19: 0, totalSum: 0, totalFakt: 0, totalCoupon: 0, totalPostpay: 0, totalCredit: 0, totalMixed: 0 };

        // Ответ сервера
        res.json({
            orders: orders ? orders : [],
            result
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getActiveOrdersKol = async (req, res) => {
    try {
        const id = req.userId;

        const user = await User.findById(id);

        const filter = {
            status: { $nin: ["delivered", "cancelled"] },
        }

        if (user.role === "admin") {
            filter.franchisee = id;
        }

        const activeOrdersKol = await Order.countDocuments(filter)

        res.json({
            activeOrdersKol
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const deleteOrder = async (req, res) => {
    try {
        const id = req.userId;
        const {orderId} = req.body
        const user = await User.findById(id)
        if (user.role === "superAdmin") {
            const order = await Order.findById(id)
            if (order?.courier) {
                const courierId = order.courier
                const courier = await Courier.findById(courierId)
                const orders = courier.orders.filter(item => item.order !== orderId);
                courier.orders = orders
                await courier.save()
            }
            const delRes = await Order.findByIdAndDelete(orderId);

            if (!delRes) {
                return res.status(400).json({
                    success: false,
                    message: "Не удалось удалить заказа",
                });
            }
            return res.json({success: true})
        }

        res.json({success: false})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

// magick TP1.PNG -resize 2064x2752! P1.PNG
// magick TP2.PNG -resize 2064x2752! P2.PNG
// magick TP3.PNG -resize 2064x2752! P3.PNG
// magick TP4.PNG -resize 2064x2752! P4.PNG
// magick TP5.PNG -resize 2064x2752! P5.PNG
// magick TP6.PNG -resize 2064x2752! P6.PNG
// magick TP7.PNG -resize 2064x2752! P7.PNG
// magick TP8.PNG -resize 2064x2752! P8.PNG
// magick TP9.PNG -resize 2064x2752! P9.PNG
// magick TP10.PNG -resize 2064x2752! P10.PNG

// ffmpeg -i 3.mp4 -vf "crop=886:1920" T3.mp4
// ffmpeg -i t2.MOV -vf "crop=886:1920" T2.MOV
// ffmpeg -i t3.MOV -vf "crop=886:1920" T3.MOV
// ffmpeg -i IMG_5057.MOV -vf "scale=886:1920" scaled_T2.MOV
