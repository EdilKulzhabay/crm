import Courier from "../Models/Courier.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../Models/User.js";
import Order from "../Models/Order.js"
import Client from "../Models/Client.js";
import { SendEmailOrder } from "./SendEmailOrder.js";
import { pushNotification } from "../pushNotification.js";
import mongoose from "mongoose";


export const addCourier = async (req, res) => {
    try {
        const { fullName, phone, mail, franchisee } = req.body;

        const candidate = await Courier.findOne({ phone });

        if (candidate) {
            return res.status(409).json({
                success: false,
                message: "Курьер с таким номером уже существует",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(req.body.password, salt);

        const doc = new Courier({
            fullName,
            password: hash,
            phone,
            mail,
            franchisee
        });

        const courier = await doc.save();

        const token = jwt.sign(
            {
                _id: courier._id,
            },
            process.env.SecretKey,
            {
                expiresIn: "30d",
            }
        );

        res.json({
            success: true,
            message: "Курьер успешно добавлен",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getCouriers = async (req, res) => {
    try {
        const id = req.userId;
        const { page } = req.body;
        const limit = 9;
        const skip = (page - 1) * limit;

        const user = await User.findById(id);

        // Строим базовый фильтр
        const filter = {};

        // Добавляем фильтр по франчайзи для админа
        if (user.role === "admin") {
            filter.franchisee = id;
        }

        // Выполняем запрос с фильтрацией, сортировкой, пропуском и лимитом
        const couriers = await Courier.find(filter)
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit);

        const couriersWithRating = [];

            // Проходимся по каждому курьеру
        for (const courier of couriers) {
            // Находим последние 20 выполненных заказов для текущего курьера
            const orders = await Order.find({ courier: courier._id, clientReview: { $exists: true, $ne: 0 }, status: "delivered" })
                .sort({ createdAt: -1 }) // Сортировка по убыванию времени создания, чтобы получить последние заказы первыми
                .limit(20); // Ограничиваем до 20 заказов

            // Вычисляем сумму оценок клиентов
            let totalRating = 0;
            for (const order of orders) {
                totalRating += order.clientReview || 0;
            }

            // Вычисляем среднюю оценку
            const averageRating = orders.length > 0 ? totalRating / orders.length : 0;

            // Добавляем курьера с его оценкой в результат
            couriersWithRating.push({
                _id: courier._id,
                name: courier.name,
                fullName: courier.fullName,
                status: courier.status,
                completedOrders: courier.completedOrders,
                averageRating: averageRating.toFixed(1), // Округляем до двух знаков после запятой
            });
        }

        res.json({ couriers: couriersWithRating });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getFreeInfoCourier = async (req, res) => {
    try {
        const id = req.userId;

        const user = await User.findById(id);

        const filter = {};

        if (user.role === "admin") {
            filter.franchisee = id;
        }

        const total = await Courier.countDocuments(filter);

        res.json({
            total,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const searchCourier = async (req, res) => {
    try {
        const id = req.userId;

        const user = await User.findById(id);

        const { search } = req.body;

        const regex = new RegExp(search, "i"); // 'i' делает поиск регистронезависимым

        const filter = [
            { fullName: { $regex: regex } },
            { phone: { $regex: regex } },
            { mail: { $regex: regex } },
        ];

        const franch = {};

        if (user.role === "admin") {
            franch.franchisee = id;
        }

        const couriers = await Courier.find({
            ...franch,
            $or: filter,
        });

        res.json(couriers);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getCourierDataForId = async (req, res) => {
    try {
        const { id } = req.body;

        const courier = await Courier.findById(id).select('-orders');;

        if (!courier) {
            res.status(404).json({
                message: "Не удалось найти курьера",
            });
        }

        res.json(courier);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const updateCourierData = async (req, res) => {
    try {
        const { courierId, field, value } = req.body;

        const courier = await Courier.findById(courierId);
        if (!courier) {
            return res
                .status(404)
                .json({ success: false, message: "Client not found" });
        }

        courier[field] = value;
        await courier.save();

        res.json({ success: true, message: "Данные успешно изменены" });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const deleteCourier = async (req, res) => {
    try {
        const { id } = req.body;

        const delRes = await Courier.findByIdAndDelete(id);

        if (!delRes) {
            return res.status(400).json({
                success: false,
                message: "Не удалось удалить курьера",
            });
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

export const getActiveOrdersCourier = async (req, res) => {
    try {
        const { id, role } = req.body;
        console.log(role);

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
        const day = String(today.getDate()).padStart(2, '0');
        const todayDate = `${year}-${month}-${day}`;

        if (!id) {
            return res.status(400).json({ message: "ID курьера не предоставлен" });
        }

        // Находим курьера и пополняем поле orders.order
        const courier = await Courier.findById(id)
            .populate({
                path: 'orders.order', // Пополняем поле order
                populate: {
                    path: 'client', // Вложенный populate для клиента
                    model: 'Client', // Указываем модель клиента
                }
            });

        if (!courier) {
            return res.status(404).json({ message: "Курьер не найден" });
        }

        // Фильтруем заказы с нужным статусом
        const activeOrders = courier.orders.filter(
            (item) => item.orderStatus === "inLine" || item.orderStatus === "onTheWay"
        );

        // console.log(activeOrders);
        
        // const filteredOrders = activeOrders.filter(item => item.order !== null);
        // Убираем заказы, где поле order равно null
        const filteredOrders = activeOrders.filter(item => {
            return item.order !== null && (
                role !== "courier" || 
                item.order.date.d === todayDate
            );
        });

        // console.log(filteredOrders);
        

        // Возвращаем только нужные заказы для текущей страницы
        res.json({ activeOrders: filteredOrders, totalOrders: filteredOrders.length });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getDeliveredOrdersCourier = async (req, res) => {
    try {
        const { id, page, startDate, endDate, clientNote } = req.body;

        const limit = 5;
        const skip = (page - 1) * limit;
        
        let filter = { 
            courier: id,
            status: "delivered",
            "date.d": {$gte: startDate, $lte: endDate}
        };

        // Добавление условия для clientNotes
        if (clientNote && clientNote !== "") {
            filter.clientNotes = { $in: [clientNote] };
        }

        // Найти заказы по условиям
        const deliveredOrders = await Order.find(filter).sort({updatedAt: -1}).limit(limit).skip(skip).populate("client").populate("franchisee")
        

        res.status(200).json({ deliveredOrders });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getDeliveredOrdersCourierTagCounts = async (req, res) => {
    try {
        const { id, startDate, endDate } = req.body;

        let filter = { 
            courier: new mongoose.Types.ObjectId(id),
            status: "delivered",
            "date.d": {$gte: startDate, $lte: endDate}
        };

        const tagCounts = await Order.aggregate([
            { $match: filter }, // Применить те же условия для агрегации
            { $unwind: "$clientNotes" }, // Развернуть массив clientNotes
            { $group: { _id: "$clientNotes", count: { $sum: 1 } } } // Сгруппировать и подсчитать количество каждого тега
        ]);

        console.log("tagCounts:", tagCounts);

        res.status(200).json({ tagCounts });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getFirstOrderForToday = async (req, res) => {
    try {
        const id = req.userId
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];

        if (!id) {
            return res.status(400).json({ message: "ID курьера не предоставлен" });
        }

        // Находим курьера и пополняем поле orders.order
        const courier = await Courier.findById(id)
            .populate({
                path: 'orders.order', // Пополняем поле order
                populate: {
                    path: 'client', // Вложенный populate для клиента
                    model: 'Client', // Указываем модель клиента
                }
            });

        if (!courier) {
            return res.status(404).json({ message: "Курьер не найден" });
        }

        // Фильтруем заказы на текущую дату
        const activeOrders = courier.orders.filter(
            (item) => item?.order?.date?.d === todayString
        );

        // Ищем заказы со статусом 'onTheWay'
        const onTheWayOrders = activeOrders.filter(
            (item) => item?.orderStatus === "onTheWay"
        );

        // Если есть заказы со статусом 'onTheWay', возвращаем первый из них
        if (onTheWayOrders.length > 0) {
            return res.json({ firstActiveOrder: onTheWayOrders[0] });
        }

        // Если нет заказов со статусом 'onTheWay', ищем самый первый заказ со статусом 'inLine'
        const inLineOrders = activeOrders.filter(
            (item) => item.orderStatus === "inLine"
        );

        const firstInLineOrder = inLineOrders.length > 0 ? inLineOrders[0] : null;

        if (!firstInLineOrder) {
            return res.status(404).json({ message: "Активные заказы не найдены" });
        }

        res.json({ firstActiveOrder: firstInLineOrder });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const updateOrderList = async (req, res) => {
    try {
        const {id, orders} = req.body

        const courier = await Courier.findById(id)

        if (!courier) {
            return res.json({
                success: false
            })
        }

        courier.orders = orders

        await courier.save()

        res.json({
            success: true
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const updateCourierOrderStatus = async (req, res) => {
    try {
        const id = req.userId
        const {orderId, trueOrder, newStatus, products, opForm, sum} = req.body
        
        const order = await Order.findOne({_id: trueOrder})

        const updateQuery = {
            $set: { 'orders.$.orderStatus': newStatus } // Обновляем статус заказа в массиве orders
        };

        // Если статус заказа "delivered", увеличиваем completedOrders на 1
        if (newStatus === "delivered") {
            updateQuery.$inc = { completedOrders: 1 }; // Увеличиваем completedOrders на 1
            const franchiseeID = order?.franchisee
            const franchisee = await User.findOne({_id: franchiseeID})
            const mail = franchisee.mail
            if (mail !== null && mail !== "" && mail.includes("@")) {
                let sendText = `По адресу ${order?.address.actual}, `
                if (products.b12 !== null &&  Number(products.b12 > 0)) {
                    sendText += `кол. 12,5 л.: ${products.b12}, `
                }
                if (products.b19 !== null &&  Number(products.b19 > 0)) {
                    sendText += `кол. 18,9 л.: ${products.b19} `
                }
                SendEmailOrder(mail, "delivered", sendText)
            }
        }

        // Найдем курьера и обновим статус заказа в массиве orders и при необходимости увеличим completedOrders
        const updatedCourier = await Courier.findOneAndUpdate(
            { _id: id, 'orders._id': orderId }, // Находим документ и нужный элемент в массиве orders по ID
            updateQuery, // Выполняем нужные обновления
            { new: true } // Возвращаем обновленный документ
        );

        const clientId = order.client.toHexString()
        if (order.status !== newStatus) {
            console.log("socket orderStatusChanged");
            
            global.io.to(clientId).emit("orderStatusChanged", {
                orderId: trueOrder,
                status: newStatus,
                message: `Статус заказа #${trueOrder} был изменен на ${newStatus}`,
            });
        }   
        order.status = newStatus
        if (newStatus === "delivered") {
            order.products = products
            order.opForm = opForm
            order.sum = sum
        }

        await order.save()

        const clientId2 = order.client

        const client = await Client.findById(clientId2)
        const expoTokens = client?.expoPushToken || []

        if (expoTokens.length > 0) {
            const messageTitle = "Обновление статуса заказа"

            const messageBody = `Статус: ${newStatus === "delivered" ? "Доставлено" : "В пути"} (${order?.address?.name})`

            pushNotification(messageTitle, messageBody, expoTokens, newStatus)
        }

        client.haveCompletedOrder = true

        await client.save()

        if (!updatedCourier) {
            return res.status(404).json({ message: "Курьер или заказ не найдены" });
        }

        res.json({
            success: true
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Не удалось обновить статус заказа" });
    }
};

export const getCourierRating = async (req, res) => {
    try {
        const id = req.userId

        const orders = await Order.find({ courier: id, clientReview: { $exists: true, $ne: 0 }, status: "delivered" })
            .sort({ createdAt: -1 }) 
            .limit(20); 
        
        let totalRating = 0;
        orders.forEach(order => {
            totalRating += order.clientReview || 0; 
        });

        const rating = orders.length > 0 ? totalRating / orders.length : 0

        res.status(200).json({ rating: rating.toFixed(1) });
    } catch {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}



