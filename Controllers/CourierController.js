import Courier from "../Models/Courier.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../Models/User.js";
import Order from "../Models/Order.js"
import Client from "../Models/Client.js";
import {Expo} from "expo-server-sdk";

let expo = new Expo({ useFcmV1: true });

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
            franchisee,
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
        const limit = 3;
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

        res.json({ couriers });
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
        const { id, page } = req.body;

        if (!id) {
            return res.status(400).json({ message: "ID курьера не предоставлен" });
        }

        const limit = 3; // Количество заказов на странице
        const skip = (page - 1) * limit;

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
        const deliveredOrders = courier.orders.filter(
            (item) => item.orderStatus === "delivered"
        );

        // Убираем заказы, где поле order равно null
        const filteredOrders = deliveredOrders.filter(item => item.order !== null);

        // Применяем skip и limit на отфильтрованные заказы
        const paginatedOrders = filteredOrders.slice(skip, skip + limit);

        // Возвращаем только нужные заказы для текущей страницы
        res.json({ deliveredOrders: paginatedOrders, totalOrders: filteredOrders.length });
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
        

        const updateQuery = {
            $set: { 'orders.$.orderStatus': newStatus } // Обновляем статус заказа в массиве orders
        };

        // Если статус заказа "delivered", увеличиваем completedOrders на 1
        if (newStatus === "delivered") {
            updateQuery.$inc = { completedOrders: 1 }; // Увеличиваем completedOrders на 1
        }

        // Найдем курьера и обновим статус заказа в массиве orders и при необходимости увеличим completedOrders
        const updatedCourier = await Courier.findOneAndUpdate(
            { _id: id, 'orders._id': orderId }, // Находим документ и нужный элемент в массиве orders по ID
            updateQuery, // Выполняем нужные обновления
            { new: true } // Возвращаем обновленный документ
        );

        const order = await Order.findOne({_id: trueOrder})

        
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
        const expoToken = client?.expoPushToken || ""

        if (expoToken !== "" && Expo.isExpoPushToken(expoToken)) {
            const messageTitle = "Обновление статуса заказа"

            const messageBody = `Статус вашего заказа: ${newStatus === "delivered" ? "Доставлен" : "В пути"}`
        
            // Создаем уведомление
            const message = {
            to: expoToken,
            sound: "default",
            title: messageTitle,
            body: messageBody,
            priority: "high",
            data: { newStatus },
            _displayInForeground: true,
            contentAvailable: true,
            };
            
            // Отправляем уведомление
            const ticket = await expo.sendPushNotificationsAsync([message]);
        
            console.log("Push notification ticket:", ticket);
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



