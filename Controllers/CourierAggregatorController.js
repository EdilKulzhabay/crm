import CourierAggregator from "../Models/CourierAggregator.js";
import CourierRestrictions from "../Models/CourierRestrictions.js";
import Order from "../Models/Order.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { getDateAlmaty } from "../utils/dateUtils.js";
import queueOrTools from "../orToolsQueue.js";

// Функция для сброса ограничений уведомлений (будет импортирована из orTools.js)
let resetNotificationLimits = null;

// Динамический импорт для избежания циклических зависимостей
const loadResetFunction = async () => {
    if (!resetNotificationLimits) {
        const orToolsModule = await import("../orTools.js");
        resetNotificationLimits = orToolsModule.resetNotificationLimits;
    }
};

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

        if (id === "68412ff4b70d315d3b2b72f9" && changeField === "point") {
            await CourierAggregator.updateOne({_id: id}, { $set: {
                point: {
                    lat: 43.41377,
                    lon: 76.97149,
                    timestamp: new Date().toISOString()
                }
            } })

            return res.json({
                success: true,
                message: "Успешно изменен"
            })
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
            
            let sum = changeData.b12 > 0 ? changeData.b12 * order.client.price12 : 0
            sum += changeData.b19 > 0 ? changeData.b19 * order.client.price19 : 0

            courier.order.income = sum;
            courier.order.products = changeData;
            courier.orders[0].products = changeData;
            order.sum = sum;
            await order.save();
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

                    // await queueOrTools('courier_offline_' + id);
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

        const order = await Order.findById(orderId)
            .populate("client", "price19 price12")
            .populate("franchisee", "fullName")

        const courier1 = await CourierAggregator.findById(courierId)

        const courierName = courier1?.fullName?.toLowerCase() || '';
        const franchiseeName = order?.franchisee?.fullName?.toLowerCase() || '';

        // Яковлев Василий
        if (courierName.includes("василий") && !franchiseeName.includes("василий")) {
            await Order.updateOne(
                { _id: order._id },
                {
                    $set: {
                        status: "delivered",
                        courierAggregator: courierId,
                        products: courier1.order.products,
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
                        status: "delivered",
                        courierAggregator: courierId,
                        products: courier1.order.products,
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
                        status: "delivered",
                        courierAggregator: courierId,
                        products: courier1.order.products,
                        transferred: true,
                        transferredFranchise: "Сандыбаев Айдынбек"
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
                        status: "delivered",
                        courierAggregator: courierId,
                        products: courier1.order.products,
                        transferred: true,
                        transferredFranchise: "Сапарбаев Бекет"
                    }
                }
            );
        }
        
        if (order.products.b12 !== courier1.order.products.b12 || order.products.b19 !== courier1.order.products.b19) {
            await CourierAggregator.updateOne({_id: courierId}, {
                $set: {
                    capacity12: courier1.capacity12 + (courier1.order.products.b12 - order.products.b12),
                    capacity19: courier1.capacity19 + (courier1.order.products.b19 - order.products.b19)
                }
            })
        }

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

        res.json({
            success: true,
            message: "Заказ завершен",
            // income: b12 * process.env.Reward12 + b19 * process.env.Reward19
            income: sum
        })
        // Добавляем задержку в 20 секунд
        await new Promise(resolve => setTimeout(resolve, 15000));

        // Проверяем наличие следующего заказа в массиве orders
        const updatedCourier = await CourierAggregator.findById(courierId);
        if (updatedCourier.orders && updatedCourier.orders.length > 0) {
            try {
                const nextOrder = updatedCourier.orders[0];
                const messageBody = `Следующий заказ: ${nextOrder.clientTitle}`;
                
                const { pushNotification } = await import("../pushNotification.js");
                await pushNotification(
                    "newOrder",
                    messageBody,
                    [updatedCourier.notificationPushToken],
                    "newOrder",
                    nextOrder
                );
            } catch (notificationError) {
                console.log("Ошибка отправки уведомления о следующем заказе:", notificationError);
            }
        }

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

        console.log("we in cancelOrderCourierAggregator courierId = ", id);

        const {orderId, reason} = req.body

        console.log("we in cancelOrderCourierAggregator orderId, reason = ", orderId, reason);
        

        const order = await Order.findById(orderId)

        const courier = await CourierAggregator.findById(id)

        // ИСПРАВЛЕНИЕ: Объединяем $set и $inc в один объект
        await CourierAggregator.updateOne(
            { _id: id },
            { 
                $set: { order: null, orders: [] },
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

        // // СБРАСЫВАЕМ ОГРАНИЧЕНИЯ УВЕДОМЛЕНИЙ для этого курьера
        // try {
        //     await loadResetFunction();
        //     if (resetNotificationLimits) {
        //         resetNotificationLimits(id.toString());
        //         console.log(`🔄 Сброшены ограничения уведомлений для курьера ${id}`);
        //     }
        // } catch (error) {
        //     console.log("⚠️ Не удалось сбросить ограничения уведомлений:", error.message);
        // }

        console.log(`✅ Заказ ${orderId} отменен курьером ${id}`);
        console.log(`   Возвращено бутылок: 12л=${order.products.b12}, 19л=${order.products.b19}`);

        res.json({
            success: true,
            message: "Заказ отменен"
        })

        // Проверяем, есть ли заказы в массиве orders
        if (courier.orders && courier.orders.length > 0) {
            // Получаем ID всех заказов из массива orders
            const orderIds = courier.orders.map(order => order.orderId);
            
            // Обновляем все заказы, убирая привязку к курьеру
            await Order.updateMany(
                { _id: { $in: orderIds } },
                { $set: { courierAggregator: null } }
            );

            // Очищаем массив orders у курьера
            await CourierAggregator.updateOne(
                { _id: id },
                { $set: { orders: [] } }
            );

            console.log(`✅ Очищены все заказы у курьера ${id}`);
        }

        // // Проверяем, есть ли еще заказы в массиве orders
        // const courier = await CourierAggregator.findById(id);
        // if (courier.orders && courier.orders.length > 0) {
        //     // Берем следующий заказ из массива
        //     const nextOrder = courier.orders[0];
            
        //     // Обновляем текущий заказ курьера
        //     await CourierAggregator.updateOne(
        //         { _id: id },
        //         { $set: { order: nextOrder } }
        //     );

        //     // Обновляем статус заказа
        //     await Order.updateOne(
        //         { _id: nextOrder.orderId },
        //         { $set: { 
        //             status: "onTheWay",
        //             courierAggregator: id
        //         }}
        //     );

        //     console.log(`✅ Следующий заказ ${nextOrder.orderId} назначен курьеру ${id}`);
        // }
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

export const clearCourierAggregatorOrders = async (req, res) => {
    try {
        const {courierId} = req.body

        const courier = await CourierAggregator.findById(courierId)

        if (!courier) {
            return res.status(404).json({ message: "Курьер не найден", success: false })
        }
        
        const orderId = courier.order.orderId

        await Order.updateOne(
            { _id: orderId },
            { $set: { forAggregator: true, status: "awaitingOrder", courierAggregator: null } }
        )
        
        await CourierAggregator.updateOne(
            { _id: courierId },
            { $set: { order: null, orders: [] } }
        )

        res.json({ message: "Заказы курьера очищены", success: true })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера", success: false });
    }
}

export const getActiveCourierAggregators = async (req, res) => {
    try {
        const couriers = await CourierAggregator.find({ onTheLine: true })
            .populate({
                path: 'order.orderId',
                model: 'Order',
                populate: {
                    path: 'client',
                    model: 'Client',
                    select: 'fullName'
                }
            });
        res.json({ couriers })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера", success: false });
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

export const getAllCouriersWithOrderCount = async (req, res) => {
    try {
        const couriers = await CourierAggregator.find({ onTheLine: true })
            .select('fullName _id orders order capacity12 capacity19');

        const couriersWithCount = couriers.map(courier => ({
            _id: courier._id,
            fullName: courier.fullName,
            orderCount: courier.orders ? courier.orders.length : 0,
            hasActiveOrder: courier.order !== null,
            capacity12: courier.capacity12,
            capacity19: courier.capacity19
        }));

        res.json({
            success: true,
            couriers: couriersWithCount
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        });
    }
};

export const assignOrderToCourier = async (req, res) => {
    try {
        const { orderId, courierId } = req.body;

        console.log("assignOrderToCourier req.body = ", req.body);

        // Находим заказ
        const order = await Order.findById(orderId)
            .populate("client", "fullName price12 price19 phone");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Заказ не найден"
            });
        }

        console.log("Назначаемый заказ:", {
            orderId: order._id,
            clientName: order.client?.fullName,
            products: order.products,
            status: order.status
        });

        // Находим курьера
        const courier = await CourierAggregator.findById(courierId);

        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден"
            });
        }

        // Проверяем, что курьер активен
        if (!courier.onTheLine) {
            return res.status(400).json({
                success: false,
                message: "Курьер неактивен"
            });
        }

        // Проверяем вместимость курьера
        console.log("Проверка вместимости:");
        console.log("Заказ требует:", order.products.b12, "12л и", order.products.b19, "19л");
        console.log("У курьера есть:", courier.capacity12, "12л и", courier.capacity19, "19л");
        
        if (courier.capacity12 < order.products.b12 || courier.capacity19 < order.products.b19) {
            return res.status(400).json({
                success: false,
                message: "Недостаточно места у курьера"
            });
        }

        // Формируем объект заказа в нужном формате
        const orderObject = {
            orderId: order._id,
            status: "onTheWay",
            products: order.products,
            sum: (order.products.b12 * order.client.price12) + (order.products.b19 * order.client.price19),
            opForm: order.opForm || 'fakt',
            comment: order.comment || '',
            clientReview: order.clientReview || '',
            date: order.date,
            clientTitle: order.client.fullName,
            clientPhone: order.client.phone,
            clientPoints: order.address.point,
            clientAddress: order.address.actual,
            clientAddressLink: order.address.link,
            aquaMarketPoints: { lat: 43.168573, lon: 76.896437 },
            aquaMarketAddress: 'Баязитовой 12 1',
            aquaMarketAddressLink: 'https://go.2gis.com/ZJw6E',
            step: 'toClient',
            income: (order.products.b12 * order.client.price12) + (order.products.b19 * order.client.price19)
        };

        // Обновляем заказ
        const orderUpdateResult = await Order.updateOne(
            { _id: orderId },
            { 
                $set: {
                    courierAggregator: courierId
                } 
            }
        );
        
        console.log("Результат обновления заказа:", orderUpdateResult);

        console.log("данные курьера", courier);
        console.log("courier.order =", courier.order);
        console.log("courier.order === null =", courier.order === null);
        console.log("!courier.order =", !courier.order);
        console.log("courier.order == null =", courier.order == null);
        console.log("courier.order === undefined =", courier.order === undefined);
        console.log("courier.order.orderId =", courier.order?.orderId);
        console.log("courier.order.status =", courier.order?.status);
        
        // Проверяем, есть ли у курьера активный заказ
        const hasActiveOrder = courier.order && courier.order.orderId && courier.order.status;
        console.log("hasActiveOrder =", hasActiveOrder);
        
        if (!hasActiveOrder) {
            console.log("У курьера нет активного заказа, добавляем его");

            // Если нет активного заказа, устанавливаем его как текущий
            const courierUpdateResult = await CourierAggregator.updateOne(
                { _id: courierId },
                {
                    $set: {
                        order: orderObject,
                        orders: [orderObject]
                    }
                }
            );
            
            console.log("Результат обновления курьера (установка активного заказа):", courierUpdateResult);

            // Отправляем уведомление курьеру
            try {
                const messageBody = `Новый заказ: ${order.client.fullName}`;
                
                const { pushNotification } = await import("../pushNotification.js");
                await pushNotification(
                    "newOrder",
                    messageBody,
                    [courier.notificationPushToken],
                    "newOrder",
                    orderObject
                );
            } catch (notificationError) {
                console.log("Ошибка отправки уведомления:", notificationError);
            }
        } else {
            console.log("У курьера есть активный заказ, добавляем в список");

            // Если есть активный заказ, добавляем в список
            const courierUpdateResult = await CourierAggregator.updateOne(
                { _id: courierId },
                {
                    $push: { orders: orderObject }
                }
            );
            
            console.log("Результат обновления курьера (добавление в список):", courierUpdateResult);
            console.log("Заказ добавлен в список заказов курьера");
        }

        res.json({
            success: true,
            message: "Заказ успешно назначен курьеру"
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        });
    }
};

export const removeOrderFromCourier = async (req, res) => {
    try {
        const { orderId, courierId } = req.body;

        console.log("removeOrderFromCourier req.body = ", req.body);

        // Находим заказ
        const order = await Order.findById(orderId)
            .populate("client", "fullName price12 price19");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Заказ не найден"
            });
        }

        // Находим курьера
        const courier = await CourierAggregator.findById(courierId);

        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден"
            });
        }

        console.log("Удаляем заказ у курьера:", {
            orderId: order._id,
            clientName: order.client?.fullName,
            courierName: courier.fullName
        });

        // Обновляем заказ - убираем курьера и возвращаем статус "awaitingOrder"
        const orderUpdateResult = await Order.updateOne(
            { _id: orderId },
            { 
                $set: {
                    status: "awaitingOrder",
                    courierAggregator: null
                } 
            }
        );
        
        console.log("Результат обновления заказа:", orderUpdateResult);

        // Проверяем, является ли этот заказ активным у курьера
        const isActiveOrder = courier.order && courier.order.orderId && courier.order.orderId.toString() === orderId;
        
        if (isActiveOrder) {
            // Если это активный заказ, убираем его из активного заказа
            await CourierAggregator.updateOne(
                { _id: courierId },
                {
                    $set: { order: null },
                    $inc: {
                        capacity12: order.products.b12,
                        capacity19: order.products.b19
                    }
                }
            );
            console.log("Убран активный заказ у курьера");
        }

        // Убираем заказ из списка заказов курьера
        const courierUpdateResult = await CourierAggregator.updateOne(
            { _id: courierId },
            {
                $pull: { orders: { orderId: orderId } },
                $inc: {
                    capacity12: order.products.b12,
                    capacity19: order.products.b19
                }
            }
        );
        
        console.log("Результат обновления курьера (удаление заказа):", courierUpdateResult);

        res.json({
            success: true,
            message: "Заказ успешно убран у курьера"
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        });
    }
};

export const resendNotificationToCourier = async (req, res) => {
    try {
        const { courierId } = req.body;

        console.log("resendNotificationToCourier req.body = ", req.body);

        // Находим курьера
        const courier = await CourierAggregator.findById(courierId);

        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден"
            });
        }

        // Проверяем, есть ли у курьера заказы в массиве orders
        if (!courier.orders || courier.orders.length === 0) {
            return res.status(400).json({
                success: false,
                message: "У курьера нет заказов"
            });
        }

        // Берем первый заказ из массива orders
        const firstOrderData = courier.orders[0];
        const orderId = firstOrderData.orderId;

        // Находим заказ
        const order = await Order.findById(orderId)
            .populate("client", "fullName price12 price19");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Заказ не найден"
            });
        }

        console.log("Отправляем повторное уведомление курьеру:", {
            courierName: courier.fullName,
            orderId: order._id,
            clientName: order.client?.fullName,
            orderIndex: 0
        });

        // Отправляем уведомление курьеру
        try {
            const messageBody = `Напоминание: заказ ${order.client.fullName}`;
            
            const { pushNotification } = await import("../pushNotification.js");
            
            await pushNotification(
                "newOrder",
                messageBody,
                [courier.notificationPushToken],
                "newOrder",
                firstOrderData
            );

            console.log("Повторное уведомление успешно отправлено курьеру");

            res.json({
                success: true,
                message: "Уведомление успешно отправлено курьеру"
            });

        } catch (notificationError) {
            console.log("Ошибка отправки повторного уведомления:", notificationError);
            res.status(500).json({
                success: false,
                message: "Ошибка при отправке уведомления"
            });
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        });
    }
};

// db.orders.find({_id: ObjectId("6884769dcc17337ee0fb2ee1")})

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
//         "date.d": "2025-07-28"
//     },
//     {
//         $set: { status: "awaitingOrder", courierAggregator: null }
//     }
// )


/// git suka

// db.courieraggregators.updateOne({fullName: "Edil Kulzhabay"}, { $set: { order: null, orders:[], capacity12: 0, capacity19: 100, point: { lat: 43.41377, lon: 76.97149 } }}) 

// db.orders.countDocuments({
//     "date.d": "2025-07-16",
//     status: "delivered",
//     forAggregator: true,
//     franchisee: {$ne: ObjectId('66f15c557a27c92d447a16a0')}
// })

// db.orders.updateMany({"date.d": "2025-07-17"}, {$set: {forAggregator: false, status: "awaitingOrder", courierAggregator: null}})

// db.orders.updateMany(
//     {
//         _id: {
//         $in: [
//             ObjectId("688393d9bbc47e9e50b0f6b5")
//         ]
//         }
//     },
//     {
//         $set: { status: "awaitingOrder", courierAggregator: null }
//     }
// )

// db.courieraggregators.updateOne({fullName: "Edil Kulzhabay"}, { $set: { order: null, orders:[] }})

// db.orders.updateMany(
//     {
//         "date.d": "2025-07-24",
//         forAggregator: true,
//         status: "onTheWay"
//     },
//     {
//         $set: {
//             status: "awaitingOrder"
//         }
//     }
// )

//   db.courieraggregators.updateOne({fullName: 'Бекет Сапарбаев'}, {$set: {  order:
//     {
//         orderId: '6879d531347a61c83c9d38c0',
//         status: 'onTheWay',
//         products: { b12: 0, b19: 2 },
//         sum: 2600,
//         opForm: 'fakt',
//         comment: '',
//         clientReview: '',
//         date: { d: '2025-07-18', time: '' },
//         clientTitle: 'Smart Medical - Samal',
//         clientPhone: '87017558032',
//         clientPoints: { lat: 43.234822, lon: 76.953763 },
//         clientAddress: 'Микрорайон Самал-1, 23 кв. 72; 1 этаж',
//         clientAddressLink: 'https://go.2gis.com/EjqTk',
//         aquaMarketPoints: { lat: 43.168573, lon: 76.896437 },
//         aquaMarketAddress: 'Баязитовой 12 1',
//         aquaMarketAddressLink: 'https://go.2gis.com/ZJw6E',
//         step: 'toClient',
//         income: 2600,
//         _id: ObjectId('687a13f8ca79cb6a34d182e5')
//     }, orders:[{orderId: '6879d531347a61c83c9d38c0',
//         status: 'onTheWay',
//         products: { b12: 0, b19: 2 },
//         sum: 2600,
//         opForm: 'fakt',
//         comment: '',
//         clientReview: '',
//         date: { d: '2025-07-18', time: '' },
//         clientTitle: 'Smart Medical - Samal',
//         clientPhone: '87017558032',
//         clientPoints: { lat: 43.234822, lon: 76.953763 },
//         clientAddress: 'Микрорайон Самал-1, 23 кв. 72; 1 этаж',
//         clientAddressLink: 'https://go.2gis.com/EjqTk',
//         aquaMarketPoints: { lat: 43.168573, lon: 76.896437 },
//         aquaMarketAddress: 'Баязитовой 12 1',
//         aquaMarketAddressLink: 'https://go.2gis.com/ZJw6E',
//         step: 'toClient',
//         income: 2600,
//         _id: ObjectId('687a13f8ca79cb6a34d182e5')}]
//    }})
//   db.courieraggregators.updateOne({fullName: 'Василий Яковлев'}, { $set: { order: null, orders:[] }})
//   db.courieraggregators.updateOne({fullName: 'Тасқын Әбікен'}, { $set: {order: null, orders:[] }})
//   db.courieraggregators.updateOne({fullName: 'Бекет Сапарбаев'}, { $set: {  order: null, orders:[] }})
//   db.courieraggregators.updateOne({fullName: 'Айдынбек Сандыбаев'}, {$set: { order: null, orders:[] }})
  
// db.courieraggregators.updateMany({}, {$set: { order: null, orders:[] }})

// db.orders.find({
//     "date.d": "2025-07-16",
//     $or: [
//       { "products.b12": { $in: [null, ""] } },
//       { "products.b19": { $in: [null, ""] } }
//     ]
//   })

// db.courieraggregators.find({onTheLine: true}, {fullName: 1, capacity12: 1, capacity19: 1})
// db.courieraggregators.find({onTheLine: true})
  