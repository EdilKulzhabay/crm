import CourierAggregator from "../Models/CourierAggregator.js";
import CourierRestrictions from "../Models/CourierRestrictions.js";
import Order from "../Models/Order.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import distributionOrdersToFreeCourier from "../utils/distributionOrdersToFreeCourier.js";
import distributionUrgentOrder from "../utils/distributionUrgentOrder.js";
import getLocationsLogicQueue from "../utils/getLocationsLogicQueue.js";
import { pushNotification } from "../pushNotification.js";
import nodemailer from "nodemailer";
import orTools from "../orTools.js";
import { getDateAlmaty } from "../utils/dateUtils.js";
import queueOrTools from "../orToolsQueue.js";

const transporter = nodemailer.createTransport({
    host: "smtp.mail.ru",
    port: 465, // Или 587 для TLS
    secure: true,
    auth: {
        user: "info@tibetskaya.kz",
        pass: process.env.MailSMTP,
    },
});

const generateCode = () => {
    const characters = "0123456789";
    let randomPart = "";

    for (let i = 0; i < 6; i++) {
        randomPart += characters.charAt(
            Math.floor(Math.random() * characters.length)
        );
    }

    return randomPart;
};

const codes = {};

export const courierAggregatorTestLog = async (req, res) => {
    try {
        console.log("req.body = ", req.body);

        res.status(200).json({
            success: true,
            message: "Тестовое сообщение отправлено"
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const courierAggregatorSendCode = async (req, res) => {
    const { email } = req.body;

    const candidate = await CourierAggregator.findOne({ email: email?.toLowerCase() });

    if (candidate) {
        return res.status(409).json({
            message: "Пользователь с такой почтой уже существует",
        });
    }

    const confirmCode = generateCode();

    codes[email] = confirmCode;

    const mailOptions = {
        from: "info@tibetskaya.kz",
        to: email,
        subject: "Подтвердждение электронной почты",
        text: confirmCode,
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
            res.status(500).json({
                success: false,
                message: "Ошибка при отправке письма"
            })
        } else {
            console.log("Email sent: " + info.response);
            res.status(200).json({
                success: true,
                message: "Письмо успешно отправлено"
            })
        }
    });
};

export const courierAggregatorCodeConfirm = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (codes[email] === code) {
            delete codes[email]; // Удаляем код после успешного подтверждения
            res.status(200).json({
                success: true,
                message: "Код успешно подтвержден"
            })
        } else {
            res.status(400).json({
                success: false,
                message: "Неверный код"
            })
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getCourierAggregatorData = async(req, res) => {
    try {
        const id = req.userId

        const courier = await CourierAggregator.findById(id)

        if (!courier) {
            return res.json({
                success: false,
                message: "Не смогли найти курьера"
            })
        }

        return res.json({
            success: true,
            userData: courier._doc,
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const getCourierAggregatorDataForAdmin = async(req, res) => {
    try {
        const { id } = req.body

        const courier = await CourierAggregator.findById(id)

        if (!courier) {
            return res.json({
                success: false,
                message: "Не смогли найти курьера"
            })
        }

        return res.json({
            success: true,
            userData: courier._doc,
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const courierAggregatorLogin = async(req, res) => {
    try {
        const {email, password} = req.body
        console.log("aggregatorLogin req.body = ", req.body);
        

        const courier = await CourierAggregator.findOne({email})

        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Неверный логин или пароль"
            })
        }

        console.log("courier = ", courier);
        

        const isValidPass = await bcrypt.compare(password, courier._doc.password);

        if (!isValidPass) {
            return res.status(404).json({
                message: "Неверный логин или пароль",
                success: false
            });
        }

        if (courier.status === "inActive") {
            return res.status(404).json({
                message: "Ваш аккаунт заблокироан, свяжитесь с вашим франчайзи",
                success: false
            });
        }

        const token = jwt.sign({ _id: courier._id, role: "courier" }, process.env.SecretKey, {
            expiresIn: "30d",
        });

        res.status(200).json({
            token, 
            userData: {...courier._doc, password},
            success: true,
            message: "Вы успешно авторизовались"
        });

        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const courierAggregatorRegister = async (req, res) => {
    try {
        const { 
            firstName, 
            lastName, 
            email, 
            phone, 
            languages, 
            birthDate, 
            country, 
            city, 
            transport, 
            inviteCode, 
            termsAccepted, 
            privacyAccepted 
        } = req.body;

        console.log("courierAggregatorRegister req.body = ", req.body);
        
        // Проверяем, приняты ли условия
        if (!termsAccepted || !privacyAccepted) {
            return res.status(400).json({
                success: false,
                message: "Необходимо принять условия использования и политику конфиденциальности"
            });
        }

        const candidate = await CourierAggregator.findOne({ email });

        if (candidate) {
            return res.status(409).json({
                success: false,
                message: "Пользователь с такой почтой уже существует"
            });
        }

        // Генерируем случайный пароль
        const password = "qweasdzxc";
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const courier = new CourierAggregator({
            fullName: `${firstName} ${lastName}`,
            firstName,
            lastName,
            password: hash,
            email,
            phone,
            status: "awaitingVerfication",
            carType: transport || "A", // Если транспорт не указан, устанавливаем тип A по умолчанию
            income: 0,
            birthDate,
            country,
            city,
            languages
        });

        await courier.save();

        const token = jwt.sign(
            {
                _id: courier._id,
                role: "courier"
            },
            process.env.SecretKey,
            {
                expiresIn: "30d",
            }
        );

        res.status(200).json({ 
            token,
            userData: {...courier._doc, password},
            success: true,
            message: "Вы успешно зарегистрировались"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const updateCourierAggregatorData = async (req, res) => {
    try {
        const {id, changeField, changeData} = req.body

        console.log("updateCourierAggregatorData req.body = ", req.body);

        const courier = await CourierAggregator.findById(id)

        if (!courier) {
            return res.status(404).json({
                message: "Не получилось найти курьера",
                success: false
            });
        }

        if (changeField === "capacities") {
            await CourierAggregator.updateOne({_id: id}, { $set: {
                capacity12: changeData.capacity12,
                capacity19: changeData.capacity19
            } })
        } else if (changeField === "order.products") {
            if (!courier.order || !courier.order.orderId) {
                return res.status(400).json({
                    success: false,
                    message: "У курьера нет активного заказа"
                });
            }
            
            const order = await Order.findById(courier.order.orderId).populate("client", "price12 price19")
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Заказ не найден"
                });
            }

            order.products = changeData;
            await order.save();
            
            let sum = changeData.b12 > 0 ? changeData.b12 * order.client.price12 : 0
            sum += changeData.b19 > 0 ? changeData.b19 * order.client.price19 : 0

            courier.order.income = sum;
            courier.order.products = changeData;
            courier.orders[0].products = changeData;
            await courier.save();
        } else if (changeField === "order.step") {
            courier.order.step = changeData;
            if (courier.orders.length > 0) {
                courier.orders[0].step = changeData;
            }
            await courier.save();
        } else {
            await CourierAggregator.updateOne({_id: id}, { $set: {
                [changeField]: changeData
            } })
        }

        res.json({
            success: true,
            message: "Успешно изменен"
        })

        try {
            if (changeField === "onTheLine" && changeData) {
                await CourierAggregator.updateOne({_id: id}, { $set: {
                    completeFirstOrder: false
                } })
                await queueOrTools('courier_online_' + id);
            }

            if (changeField === "onTheLine" && !changeData) {
                // Получаем актуальные данные курьера после обновления
                const updatedCourier = await CourierAggregator.findById(id);
                
                if (updatedCourier && updatedCourier.orders.length > 0) {
                    const orderIds = updatedCourier.orders.map(item => item.orderId);
                    await Order.updateMany({_id: { $in: orderIds}}, {courierAggregator: null})
                    await CourierAggregator.updateOne({_id: id}, { $set: {
                        orders: [],
                        onTheLine: false
                    } })

                    await queueOrTools('courier_offline_' + id);
                }
            }
        } catch (asyncError) {
            console.log("Ошибка в асинхронных операциях после ответа:", asyncError);
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const updateCourierAggregatorDataFull = async (req, res) => {
    try {
        const {id, data} = req.body

        const courier = await CourierAggregator.findById(id)

        if (!courier) {
            return res.status(404).json({
                message: "Не получилось найти курьера",
                success: false
            });
        }

        courier.fullName = data.firstName + " " + data.lastName
        courier.firstName = data.firstName
        courier.lastName = data.lastName
        courier.birthDate = data.birthDate
        courier.country = data.country
        courier.city = data.city
        courier.languages = data.languages
        courier.phone = data.phone
        courier.email = data.email
        await courier.save()

        res.json({
            success: true,
            userData: {...courier._doc},
            message: "Успешно изменен"
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const acceptOrderCourierAggregator = async (req, res) => {
    try {
        const id = req.userId

        const courier = await CourierAggregator.findById(id)

        if (!courier) {
            return res.status(404).json({
                message: "Не получилось найти курьера",
                success: false
            });
        }

        const { order } = req.body

        console.log("order in acceptOrderCourierAggregator = ", order);

        await Order.updateOne({_id: order.orderId}, { 
            $set: {
                status: "onTheWay",
                courierAggregator: courier._id,
                aquaMarketAddress: order.aquaMarketAddress
            } 
        })

        // Проверяем, нет ли уже этого заказа в массиве orders
        const orderExists = courier.orders.some(existingOrder => existingOrder.orderId === order.orderId);

        order.status = "onTheWay"
        
        if (!orderExists) {
            await CourierAggregator.updateOne({_id: id}, {
                $set: {
                    order: order
                },
                $inc: {
                    capacity12: -order.products.b12,
                    capacity19: -order.products.b19
                },
                $push: {
                    orders: order
                }
            })
            // Проверим, что заказ действительно добавляется в массив orders
            console.log('Добавление заказа в orders:', order);
        } else {
            await CourierAggregator.updateOne({_id: id}, {
                $set: {
                    order: order
                },
                $inc: {
                    capacity12: -order.products.b12,
                    capacity19: -order.products.b19
                }
            })
            console.log('Заказ уже существует в массиве orders курьера');
        }

        // Обновляем статус заказа в массиве orders курьера
        await CourierAggregator.updateOne(
            { 
                _id: id,
                "orders.orderId": order.orderId 
            },
            {
                $set: {
                    "orders.$.status": "onTheWay"
                }
            }
        );

        res.json({
            success: true,
            message: "Заказ принят"
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const completeOrderCourierAggregator = async (req, res) => {
    try {
        const {orderId, courierId} = req.body

        const order = await Order.findById(orderId).populate("client", "price19 price12")

        const courier1 = await CourierAggregator.findById(courierId)

        await Order.updateOne({_id: orderId}, { 
            $set: {
                status: "delivered",
                courierAggregator: courierId,
                products: courier1.order.products
            } 
        })

        await CourierRestrictions.deleteMany({orderId: orderId})
        
        let sum = 0;
        
        // Проверяем, что order и products существуют
        if (courier1.order && courier1.order.products) {
            sum += courier1.order.products.b12 > 0 ? courier1.order.products.b12 * order.client.price12 : 0;
            sum += courier1.order.products.b19 > 0 ? courier1.order.products.b19 * order.client.price19 : 0;
        }

        await CourierAggregator.updateOne({_id: courierId}, {
            $pull: {
                orders: { orderId }
            },
            $set: {
                order: null,
                point: {
                    lat: order.address.point.lat,
                    lon: order.address.point.lon
                },
                completeFirstOrder: true
            },
            $inc: {
                income: sum // прибавит значение order.sum
            }
        })

        const courier = await CourierAggregator.findById(courierId)

        res.json({
            success: true,
            message: "Заказ завершен",
            // income: b12 * process.env.Reward12 + b19 * process.env.Reward19
            income: sum
        })

        // if (courier.orders.length === 0) {
        //     // await distributionOrdersToFreeCourier(courierId)
        //     console.log("У курьера нет заказов, отправляем на переназначение");
            
        // } else {
        //     await new Promise(resolve => setTimeout(resolve, 10000));
        //     let nextOrder = courier.orders[0]
        //     console.log("CourierAggregatorController 479, order = ", nextOrder);

        //     let message = ""

        //     if (nextOrder?.products?.b19 > 0) {
        //         message += `${nextOrder?.products?.b19} 19.8 бутылей.`
        //     }

        //     if (nextOrder?.products?.b12 > 0) {
        //         message += `${nextOrder?.products?.b12} 12.5 бутылей.`
        //     }

        //     message += `Забрать из аквамаркета: ${courier.orders[0].aquaMarketAddress}`

        //     await pushNotification(
        //         "newOrder",
        //         message,
        //         [courier.notificationPushToken],
        //         "newOrder",
        //         courier.orders[0]
        //     );
        //     console.log("CourierAggregatorController 487, отправили уведомление о заказе курьеру");
            
        //     await new Promise(resolve => setTimeout(resolve, 40000));
        //     const currentOrder = await Order.findById(courier.orders[0].orderId)
        //     if (currentOrder.status !== "onTheWay") {
        //         // Получаем все ID заказов курьера
        //         // const orderIds = courier.orders.map(order => order.orderId);
                
        //         // // Удаляем все заказы у курьера
        //         // await CourierAggregator.updateOne(
        //         //     { _id: courierId },
        //         //     { 
        //         //         $set: { 
        //         //             orders: [],
        //         //             order: null 
        //         //         }
        //         //     }
        //         // );

        //         // // Отправляем все заказы на переназначение
        //         // for (const orderId of orderIds) {
        //         //     await getLocationsLogicQueue(orderId);
        //         // }
        //         console.log("У курьера нет заказов, отправляем на переназначение");
                
        //     }
        // }

        await queueOrTools();

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const getCourierAggregatorOrdersHistory = async (req, res) => {
    try {
        const id = req.userId

        const courier = await CourierAggregator.findById(id)

        if (!courier) {
            return res.status(404).json({
                message: "Не получилось найти курьера",
                success: false
            });
        }

        const {startDate, endDate} = req.body

        console.log("startDate = ", startDate);
        console.log("endDate = ", endDate);

        const orders = await Order.find({
            courier: courier._id,
            "date.d": {
                $gte: startDate?.split('-').reverse().join('-'),
                $lte: endDate?.split('-').reverse().join('-')
            }
        })  

        console.log("orders = ", orders);

        res.json({
            success: true,
            orders
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const cancelOrderCourierAggregator = async (req, res) => {
    try {
        const id = req.userId

        const {orderId, reason} = req.body

        const order = await Order.findById(orderId)

        await CourierAggregator.updateOne(
            { _id: id },
            { $pull: { orders: { orderId: orderId } } },
            { $set: { order: null } },
            { 
                $inc: {
                    capacity12: order.products.b12,
                    capacity19: order.products.b19
                } 
            }
        );

        await Order.updateOne(
            { _id: orderId },
            { $set: {
                status: "cancelled",
                reason: reason,
                courierAggregator: null
            }}
        )

        res.json({
            success: true,
            message: "Заказ отменен"
        })
        await queueOrTools();
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const getCourierAggregators = async (req, res) => {
    try {
        const { page = 1, searchF = "", isActive } = req.body;
        const limit = 10;
        const skip = (page - 1) * limit;

        let query = {};
        if (searchF) {
            query = {
                $or: [
                    { fullName: { $regex: searchF, $options: 'i' } },
                    { phone: { $regex: searchF, $options: 'i' } }
                ]
            };
        }

        // Добавляем фильтрацию по статусу активности
        if (isActive === "active") {
            query.onTheLine = true;
        }

        if (isActive === "inActive") {
            query.onTheLine = false;
        }

        const totalCouriers = await CourierAggregator.countDocuments(query);
        const couriers = await CourierAggregator.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        res.json({
            totalCouriers,
            couriers
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
};

export const getOrdersWithCourierAggregator = async (req, res) => {
    try {
        const { status } = req.body;
        
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        
        let query = {
            $or: [
                { courierAggregator: { $ne: null } }, 
                { forAggregator: true  }
            ],
            "date.d": todayStr, 
        };
        
        // Добавляем фильтрацию по статусу заказа
        if (status && status !== "all") {
            query.status = status;
        }

        const orders = await Order.find(query)
            .populate('courierAggregator', 'fullName _id')
            .select('address.actual courierAggregator _id status')
            .sort({ createdAt: -1 });

        res.json({
            totalOrders: orders.length,
            orders
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
};

export const getCompletedOrCancelledOrdersFromCourierAggregator = async (req, res) => {
    try {
        const {courierId} = req.body
        const today = getDateAlmaty()

        const orders = await Order.find({
            courierAggregator: courierId,
            "date.d": today,
            status: { $in: ["delivered", "cancelled"] }
        });

        res.json({
            success: true,
            orders
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}

export const getCourierAggregatorIncome = async (req, res) => {
    try {
        const id = req.userId

        const courier = await CourierAggregator.findById(id)

        if (!courier) {
            return res.status(404).json({ message: "Курьер не найден", success: false })
        }

        const today = getDateAlmaty()

        const orders = await Order.find({
            "date.d": today,
            status: "delivered",
            forAggregator: true,
            courierAggregator: courier._id
        }).populate("client")

        const income = orders.reduce((acc, order) => {
            let sum = 0
            if (order.products.b12 > 0) {
                sum += order.products.b12 * order.client.price12
            }
            if (order.products.b19 > 0) {
                sum += order.products.b19 * order.client.price19
            }
            return acc + sum
        }, 0)
        
        res.json({
            success: true,
            income
        })
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}

export const appointmentFranchisee = async (req, res) => {
    try {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        
        let query = { courierAggregator: { $ne: null }, "date.d": todayStr, status: "delivered", forAggregator: true };

        const orders = await Order.find(query)
            .populate('courierAggregator', 'fullName _id')
            .populate('franchisee', "role fullName");

        await Promise.all(orders.map(async (order) => {
            const courierName = order.courierAggregator?.fullName?.toLowerCase() || '';
            const franchiseeName = order.franchisee?.fullName?.toLowerCase() || '';

            // Яковлев Василий
            if (courierName.includes("василий") && !franchiseeName.includes("василий")) {
                await Order.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            transferred: true,
                            transferredFranchise: "Яковлев Василий"
                        }
                    }
                );
            }

            // Таскын Абикен
            if (courierName.includes("тасқын") && !franchiseeName.includes("таскын")) {
                await Order.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            transferred: true,
                            transferredFranchise: "Таскын Абикен"
                        }
                    }
                );
            }

            // Сандыбаев Айдынбек
            if (courierName.includes("айдынбек") && !franchiseeName.includes("айдынбек")) {
                await Order.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            transferred: true,
                            transferredFranchise: "Сандыбаев Айдынбек"
                        }
                    }
                );
            }

            // Тимур Касымов
            if (courierName.includes("елдос") && !franchiseeName.includes("тимур")) {
                await Order.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            transferred: true,
                            transferredFranchise: "Тимур Касымов"
                        }
                    }
                );
            }

            // Ракып Нурганат
            if (courierName.includes("нұрғанат") && !franchiseeName.includes("нурганат")) {
                await Order.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            transferred: true,
                            transferredFranchise: "Ракып Нурганат"
                        }
                    }
                );
            }

            // Дауранбекова Гаухар
            if (courierName.includes("ербол") && !franchiseeName.includes("гаухар")) {
                await Order.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            transferred: true,
                            transferredFranchise: "Дауранбекова Гаухар"
                        }
                    }
                );
            }

            // Ахметова Саида
            // if (courierName.includes("саида") && !franchiseeName.includes("саида")) {
            //     await Order.updateOne(
            //         { _id: order._id },
            //         {
            //             $set: {
            //                 transferred: true,
            //                 transferredFranchise: "Ахметова Саида"
            //             }
            //         }
            //     );
            // }

            // Ахметов Канат
            // if (courierName.includes("канат") && !franchiseeName.includes("канат")) {
            //     await Order.updateOne(
            //         { _id: order._id },
            //         {
            //             $set: {
            //                 transferred: true,
            //                 transferredFranchise: "Ахметов Канат Ержанович"
            //             }
            //         }
            //     );
            // }

            // Толемисова Галия
            if (courierName.includes("серик") && !franchiseeName.includes("галия")) {
                await Order.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            transferred: true,
                            transferredFranchise: "Толемисова Галия"
                        }
                    }
                );
            }

            // Сапарбаев Бекет
            if (courierName.includes("бекет") && !franchiseeName.includes("бекет")) {
                await Order.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            transferred: true,
                            transferredFranchise: "Сапарбаев Бекет"
                        }
                    }
                );
            }

            // Кудайберди Кулжабай
            // if (courierName.includes("кұдайберді") && !franchiseeName.includes("кудайберди")) {
            //     await Order.updateOne(
            //         { _id: order._id },
            //         {
            //             $set: {
            //                 transferred: true,
            //                 transferredFranchise: "Кудайберди Кулжабай"
            //             }
            //         }
            //     );
            // }

        }));

        res.status(200).json({ message: "Переназначение выполнено" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}

// db.orders.updateMany(
//     {
//       _id: {
//         $in: [
//           ObjectId("6874959dc7cc88c13008eda2"),
//           ObjectId("687495d4c7cc88c13008edc4"),
//           ObjectId("6874960ac7cc88c13008f22e")
//         ]
//       }
//     },
//     {
//       $set: { forAggregator: true }
//     }
//   )



// db.orders.updateMany(
//     {
//       _id: {
//         $in: [
//           ObjectId("687509ae28192aeb917f011b")
//         ]
//       }
//     },
//     {
//       $set: { status: "awaitingOrder", forAggregator: true, courierAggregator: null }
//     }
//   )

// db.orders.countDocuments({
//     "date.d": "2025-07-16",
//     status: "delivered",
//     forAggregator: true,
//     franchisee: {$ne: ObjectId('66f15c557a27c92d447a16a0')}
// })

//   db.orders.updateMany(
//     {
//       _id: {
//         $in: [
//           ObjectId("68774a7576e0bf50af856e45")
//         ]
//       }
//     },
//     {
//       $set: { forAggregator: false, status: "awaitingOrder", courierAggregator: null }
//     }
//   )

//   db.courieraggregators.updateOne({fullName: 'Бекет Сапарбаев'}, {$set: { order: null, orders:[]}})
//   db.courieraggregators.updateOne({fullName: 'Василий Яковлев'}, {$set: { order: null, orders:[]}})
//   db.courieraggregators.updateOne({fullName: 'Айдынбек Сандыбаев'}, {$set: { order: null, orders:[]}})
  
// db.orders.find({
//     "date.d": "2025-07-16",
//     $or: [
//       { "products.b12": { $in: [null, ""] } },
//       { "products.b19": { $in: [null, ""] } }
//     ]
//   })
  