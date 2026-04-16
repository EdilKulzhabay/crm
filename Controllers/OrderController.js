import Notification from "../Models/Notification.js";
import Order from "../Models/Order.js";
import User from "../Models/User.js";
import Client from "../Models/Client.js";
import Courier from "../Models/Courier.js";
import mongoose from "mongoose";
import { SendEmailOrder, sendEmailAboutAggregator } from "./SendEmailOrder.js";
import { pushNotification } from "../pushNotification.js";
import getLocationsLogicQueue from "../utils/getLocationsLogicQueue.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import { getDateAlmaty } from "../utils/dateUtils.js";
// import queueOrTools from "../orToolsQueue.js";

export const addOrder = async (req, res) => {
    try {

        const id = req.userId;

        const candidate = await User.findById(id);

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

        const clientPhone = address.phone !== "" ? address.phone : client.phone

        const order = new Order({
            franchisee: client.franchisee,
            client,
            address,
            products,
            date,
            courier,
            sum,
            clientNotes: clientNotes || [],
            opForm,
            comment: comment || "",
            transferred,
            transferredFranchise,
            // income: Number(products.b12 || 0) * Number(process.env.Reward12) + Number(products.b19 || 0) * Number(process.env.Reward19)
            income: sum,
            clientPhone: clientPhone
        });

        await order.save();

        if (id === "66fc0cc6953c2dbbc86c2132") {
            const mail = process.env.SENDINFOTOEMAIL
            const sendText = `Бекет добавил заказ по адресу ${address.actual}`
            sendEmailAboutAggregator(mail, "add", sendText)
        }

        if (id === "66fc0d01953c2dbbc86c2135") {
            const mail = process.env.SENDINFOTOEMAIL
            const sendText = `Василий добавил заказ по адресу ${address.actual}`
            sendEmailAboutAggregator(mail, "add", sendText)
        }

        if (id === "66fc0d3e953c2dbbc86c2138") {
            const mail = process.env.SENDINFOTOEMAIL
            const sendText = `Ринат добавил заказ по адресу ${address.actual}`
            sendEmailAboutAggregator(mail, "add", sendText)
        }

        if (id === "67010493e6648af4cb0213b7") {
            const mail = process.env.SENDINFOTOEMAIL
            const sendText = `Айдынбек добавил заказ по адресу ${address.actual}`
            sendEmailAboutAggregator(mail, "add", sendText)
        }

        if (id === "66f15c557a27c92d447a16a0") {
            const mail = process.env.SENDINFOTOEMAIL
            const sendText = `Admin добавил заказ по адресу ${address.actual}`
            sendEmailAboutAggregator(mail, "add", sendText)
        }

        if (franchisee !== null) {
            const mail = franchisee.mail
            let sendText = `По адресу ${address.actual}, `
            if (products.b12 !== null &&  Number(products.b12 > 0)) {
                sendText += `кол. 12,5 л.: ${products.b12}, `
            }
            if (products.b19 !== null &&  Number(products.b19 > 0)) {
                sendText += `кол. 18,9 л.: ${products.b19} `
            }
            SendEmailOrder(mail, "add", sendText)
        }

        if (courier !== null) {
            const courierId = courier._id
            const cour = await Courier.findById(courierId)

            const courierOrder = {order: order._id, orderStatus: "inLine"}

            cour.orders.push(courierOrder)

            await cour.save()
            const mail = cour.mail
            if (mail !== null && mail !== "" && mail.includes("@")) {
                let sendText = `По адресу ${address.actual}, `
                if (products.b12 !== null &&  Number(products.b12 > 0)) {
                    sendText += `кол. 12,5 л.: ${products.b12}, `
                }
                if (products.b19 !== null &&  Number(products.b19 > 0)) {
                    sendText += `кол. 18,9 л.: ${products.b19} `
                }
                SendEmailOrder(mail, "add", sendText)
            }
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
                    secondObject: order._doc._id
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
            clientNotes: clientNotes || [],
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
                    filter.$and = [
                        {
                            $or: [
                                { franchisee: { $in: franchiseeIds } },
                                { transferredFranchise: { $regex: searchF, $options: "i" } }
                            ]
                        }
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

            if (filter.$and) {
                filter.$and.push({
                    $or: [
                        { client: { $in: clientIds } },
                        { "address.actual": { $regex: search, $options: "i" } }
                    ]
                });
            } else {
                filter.$and = [
                    {
                        $or: [
                            { client: { $in: clientIds } },
                            { "address.actual": { $regex: search, $options: "i" } }
                        ]
                    }
                ];
            }
        }

        const totalOrders = await Order.countDocuments(filter)

        // Execute the query with the updated filter
        const orders = await Order.find(filter)
            .populate("franchisee")
            .populate("courier")
            .populate("client")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

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
            .sort({ createdAt: -1 })
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
            .populate("client")
            .populate("courierAggregator")

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
            const oldStatus = order.status; // Сохраняем старый статус
            order.status = changeData;
            if (changeData === "delivered" || changeData === "cancelled") {
                const courierId = order.courier
                await Courier.updateOne(
                    { _id: courierId },
                    { $pull: { orders: { order: orderId } } }
                );
            }
            await order.save();

            if (changeData === "delivered") {
                try {
                    await Order.updateOne({_id: orderId}, { $set: { deliveredTime: new Date() } })
                    const { applyReferrerBonusOnFirstDeliveredOrder } = await import("../utils/referralRewards.js");
                    await applyReferrerBonusOnFirstDeliveredOrder(order.client);
                } catch (refErr) {
                    console.error("Реферальный бонус (не критично):", refErr);
                }
            }
            
            const client = await Client.findById(order.client)
            const clientId = client._id.toHexString();
            global.io.to(clientId).emit("orderStatusChanged", {
                orderId: order._id,
                status: changeData,
                message: `Статус заказа #${order._id} был изменен на ${changeData}`,
            });
        } 

        if (change === "courier") {
            if (order?.courier && order?.courier !== null) {
                const courierId = order.courier
                const lCourier = await Courier.findById(courierId)
                const mail = lCourier?.mail || ""
                if (mail !== null && mail !== "" && mail.includes("@")) {
                    let sendText = `По адресу ${order?.address.actual}, `
                    if (order?.products.b12 !== null &&  Number(order?.products.b12 > 0)) {
                        sendText += `кол. 12,5 л.: ${order?.products.b12}, `
                    }
                    if (order?.products.b19 !== null &&  Number(order?.products.b19 > 0)) {
                        sendText += `кол. 18,9 л.: ${order?.products.b19} `
                    }
                    SendEmailOrder(mail, "cancelled", sendText)
                }
                
                const orders = lCourier.orders.filter(item => item.order.toString() !== orderId.toString());
                lCourier.orders = orders
                await lCourier.save()
            }
            const courier = await Courier.findById(changeData._id)
            
            const courierOrder = {order: order._id, orderStatus: "inLine"}
            courier?.orders?.push(courierOrder)
            await courier.save()
            const mail = courier.mail
            if (mail !== null && mail !== "" && mail.includes("@")) {
                let sendText = `По адресу ${order?.address.actual}, `
                if (order?.products.b12 !== null &&  Number(order?.products.b12 > 0)) {
                    sendText += `кол. 12,5 л.: ${order?.products.b12}, `
                }
                if (order?.products.b19 !== null &&  Number(order?.products.b19 > 0)) {
                    sendText += `кол. 18,9 л.: ${order?.products.b19} `
                }
                SendEmailOrder(mail, "add", sendText)
            }

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

            if (order.status === "delivered") {
                const courierId = order.courierAggregator
                if (courierId) {
                    await CourierAggregator.updateOne({_id: courierId}, { 
                        $inc: {
                            capacity12: Number((changeData.b12 || 0) - (order.products.b12 || 0)),
                            capacity19: Number((changeData.b19 || 0) - (order.products.b19 || 0))
                        } 
                    })
                }
            }
        }
        if (change === "date") {
            order.date = changeData
            const clientId = order.client
            const client = await Client.findById(clientId)

            if (client && client?.expoPushToken?.length > 0) {
                const expoTokens = client?.expoPushToken
                const messageTitle = "Доставка воды – новая дата 📅"
                const messageBody = `Уважаемый клиент, доставка вашей воды "Тибетская" переносится на завтра из-за внеплановых логистических обстоятельств. Примите наши извинения, завтра мы позаботимся о том, чтобы ваш заказ прибыл как можно раньше. Спасибо за понимание!`
                const newStatus = "date"
                pushNotification(messageTitle, messageBody, expoTokens, newStatus)
            }
            await order.save()
        }

        if (change === "comment") {
            order.comment = changeData
            await order.save()
        }

        if (change === "opForm") {
            order.opForm = changeData
            await order.save()
        }

        if (change === "forAggregator") {
            await Order.updateOne({_id: orderId}, { $set: { forAggregator: changeData } })
            // if (order.address.point.lat && order.address.point.lon) {
            //     setImmediate(async () => {
            //         const orderId = order?._id
            //         try {
            //             console.log("Добавляем заказ в очередь для распределение");
            //             await getLocationsLogicQueue(orderId);
            //         } catch (error) {
            //             console.error("Ошибка при получении локаций:", error);
            //         }
            //     });
            // }
        }

        if (change === "isUrgent") {
            await Order.updateOne({_id: orderId}, { $set: { isUrgent: changeData } })
        }

        if (change === "priority") {
            await Order.updateOne({_id: orderId}, { $set: { priority: changeData } })
        }

        if (change === "address.point") {
            await Order.updateOne({_id: orderId}, { $set: { "address.point": changeData } })
        }

        res.json({
            success: true,
            message: "Заказ успешно изменен",
        });

        // if (change === "forAggregator" && changeData === true) {
        //     await queueOrTools('order_for_aggregator_' + orderId)
        // }
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

        const franchiseeFullName = changeData !== "" ? changeData : order?.transferredFranchise
        const franchisee = await User.findOne({fullName: franchiseeFullName})

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

        const mail = franchisee?.mail
        let sendText = `По адресу ${order.address.actual}, `
        if (order.products.b12 !== null &&  Number(order.products.b12 > 0)) {
            sendText += `кол. 12,5 л.: ${order.products.b12}, `
        }
        if (order.products.b19 !== null &&  Number(order.products.b19 > 0)) {
            sendText += `кол. 18,9 л.: ${order.products.b19} `
        }
        SendEmailOrder(mail, changeData !== "" ? "add" : "cancelled", sendText)

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
            status: "delivered",
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
            .populate("courierAggregator", "fullName")
            .populate("franchisee", "fullName")

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
            .populate("client", "fullName userName phone")
            .populate("courierAggregator", "fullName")
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
        const {startDate, endDate} = req.body
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
            "date.d": { $gte: startDate, $lte: endDate },
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
        const {page, startDate, endDate, search, searchStatus, searchF, opForm, sa, courierAggregator, fromAggregator} = req.body

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
            status: "delivered",
            "date.d": { $gte: startDate !== "" ? startDate : todayDate, $lte: endDate !== "" ? endDate : tomorrowDate },
        }

        if (fromAggregator) {
            filter.courierAggregator = { $ne: null }
        }

        if (courierAggregator !== "" && typeof courierAggregator === 'string') {
            const courier = await CourierAggregator.find({
                fullName: { $regex: courierAggregator, $options: "i" }
            })

            if (courier.length === 0) {
                return res.json({
                    orders: [],
                    result: { totalB12: 0, totalB19: 0, totalSum: 0, totalFakt: 0, totalCoupon: 0, totalPostpay: 0, totalCredit: 0, totalMixed: 0 }
                })
            }

            const courierIds = courier.map(c => c._id);
            filter.courierAggregator = { $in: courierIds };
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

        if (user.role === "superAdmin" && searchF !== "" && typeof searchF === 'string') {
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

        if (searchStatus && search && typeof search === 'string') {
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
            .populate("franchisee")
            .populate("courierAggregator")
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
            const order = await Order.findById(orderId)
            if (order?.status !== "delivered" && order?.status !== "cancelled") {
                if (order?.courier) {
                    const courierId = order.courier
                    const courier = await Courier.findById(courierId)
                    if (courier) {
                        const orders = courier.orders.filter(item => item.order !== orderId);
                        courier.orders = orders
                        await courier.save()
                        const mail = courier.mail
                        if (mail !== null && mail !== "" && mail.includes("@")) {
                            let sendText = `По адресу ${order?.address.actual}, `
                            if (order?.products.b12 !== null &&  Number(order?.products.b12 > 0)) {
                                sendText += `кол. 12,5 л.: ${order?.products.b12}, `
                            }
                            if (order?.products.b19 !== null &&  Number(order?.products.b19 > 0)) {
                                sendText += `кол. 18,9 л.: ${order?.products.b19} `
                            }
                            SendEmailOrder(mail, "cancelled", sendText)
                        }
                    } else {
                        const courieraggregator = await CourierAggregator.findById(courierId)
                        if (courieraggregator) {
                            const orders = courieraggregator.orders.filter(item => item.orderId !== orderId);
                            if (courieraggregator.order._id === orderId) {
                                courieraggregator.order = null
                            }
                            courieraggregator.orders = orders
                            await courieraggregator.save()
                            
                        }
                    }
                }
                if (order?.franchisee) {
                    const franchisee = await User.findOne({_id: order.franchisee})
                    const mail = franchisee.mail
                    if (mail !== null && mail !== "" && mail.includes("@")) {
                        let sendText = `По адресу ${order?.address.actual}, `
                        if (order?.products.b12 !== null &&  Number(order?.products.b12 > 0)) {
                            sendText += `кол. 12,5 л.: ${order?.products.b12}, `
                        }
                        if (order?.products.b19 !== null &&  Number(order?.products.b19 > 0)) {
                            sendText += `кол. 18,9 л.: ${order?.products.b19} `
                        }
                        SendEmailOrder(mail, "cancelled", sendText)
                    }
                }
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

export const getOrdersForAggregator = async (req, res) => {
    try {
        const { forAggregator } = req.body;

        const today = new Date();
        const todayString = getDateAlmaty(today);

        const filter = {
            status: { $nin: ["delivered", "cancelled"] },
            "date.d": todayString,
        }

        if (forAggregator !== "all") {
            filter.forAggregator = forAggregator
        }

        const orders = await Order.find(filter)

        res.json({ orders })

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const clearOrdersForAggregator = async (req, res) => {
    try {
        const today = new Date();
        const todayString = getDateAlmaty(today);

        const filter = {
            status: { $nin: ["delivered", "cancelled"] },
            "date.d": todayString,
            forAggregator: true,
        }

        await Order.updateMany(filter, { $set: { forAggregator: false, courierAggregator: null } })

        res.json({ success: true })

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const fixRinat = async (req, res) => {
    try {
        const orders = await Order.find({
            $or: [
                {"transferredFranchise": "Таскын Абикен"},
                {"franchisee": new mongoose.Types.ObjectId('66fc0d3e953c2dbbc86c2138')},
            ],
            "date.d": "2025-06-30",
            opForm: "fakt"
        }).populate("client")

        const message = []

        let qwe = 0
        let addresses = []

        for (const order of orders) {
            let sum = 0;
            if (order.products.b12 && order.client.price12) {
                sum += Number(order.products.b12 * order.client.price12);
            }
            if (order.products.b19 && order.client.price19) {
                sum += Number(order.products.b19 * order.client.price19);
            }
            if (sum !== order.sum) {
                message.push(`${order.address.actual}, ${order.client.fullName}, ${sum}, ${order.sum}`)
            }
            qwe += sum
            addresses.push(order.address.actual)
        }

        res.json({ message, qwe, addresses })

    } catch (error) { 
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getCancelledOrders = async (req, res) => {
    try {
        const { date } = req.body;

        const orders = await Order.find({
            status: "cancelled",
            "date.d": date,
        }).populate("client")

        res.json({ orders, success: true })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getCancelledOrdersCount = async (req, res) => {
    try {
        const today = new Date();
        const todayString = getDateAlmaty(today);

        const count = await Order.countDocuments({
            status: "cancelled",
            "date.d": todayString,
        })

        res.json({ count, success: true })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getResultForToday = async (req, res) => {
    try {
        const today = new Date();
        const todayString = getDateAlmaty(today);

        const orders = await Order.find({
            "date.d": todayString,
            forAggregator: true
        }).populate("franchisee")

        const deliveredOrders = {} 
        const activeOrders = {}
        
        orders.forEach((order) => {
            if (!order.franchisee) {
                console.log(`⚠️  Заказ ${order._id} не имеет франчайзи`);
                return;
            }
            
            const franchiseeName = order.franchisee.fullName;
            
            if (order.status === "delivered") {
                deliveredOrders[franchiseeName] = (deliveredOrders[franchiseeName] || 0) + 1;
            }
            
            if (order.status !== "delivered" && order.status !== "cancelled") {
                activeOrders[franchiseeName] = (activeOrders[franchiseeName] || 0) + 1;
            }
        });

        res.json({ deliveredOrders, activeOrders })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const toTomorrow = async (req, res) => {
    try {
        const { orderId } = req.body;
        
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (tomorrow.getDay() === 0) {
            tomorrow.setDate(tomorrow.getDate() + 1);
        }
        const tomorrowString = getDateAlmaty(tomorrow);
        
        await Order.findByIdAndUpdate(orderId, { 
            $set: { 
                "date.d": tomorrowString,
                status: "awaitingOrder",
                courierAggregator: null
            } 
        })

        res.json({ success: true })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const addOrderToAggregator = async (req, res) => {
    try {
        const { orderId } = req.body;

        await Order.findByIdAndUpdate(orderId, { $set: { status: "awaitingOrder", courierAggregator: null } })

        res.json({ success: true })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getAllOrderForToday = async (req, res) => {
    try {
        const today = new Date();
        const todayString = getDateAlmaty(today);

        const orders = await Order.find({
            "date.d": todayString,
            franchisee: { 
                $nin: [
                    new mongoose.Types.ObjectId('67010493e6648af4cb0213b7'),
                    new mongoose.Types.ObjectId('66fc0cc6953c2dbbc86c2132'),
                    new mongoose.Types.ObjectId('66fc0d01953c2dbbc86c2135')
                ]
            }
        }).populate("client").populate("courierAggregator", "fullName _id")
        
        res.json({ orders })
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const fixOrdersSum = async (req, res) => {
    try {
        const orders = await Order.find({
            "date.d": { $gte: "2025-07-01", $lte: "2025-07-30" },
            status: "delivered"
        }).populate("client")

        for (const order of orders) {
            let sum = 0
            if (order.products.b12 && order.client.price12) {
                sum += Number(order.products.b12 * order.client.price12);
            }
            if (order.products.b19 && order.client.price19) {
                sum += Number(order.products.b19 * order.client.price19);
            }
            if (sum !== order.sum) {
                await Order.findByIdAndUpdate(order._id, { $set: { sum: sum } })
            }
        }

        res.json({ success: true })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}