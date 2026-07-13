import CourierAggregator from "../Models/CourierAggregator.js";
import CourierRestrictions from "../Models/CourierRestrictions.js";
import Order from "../Models/Order.js";
import AquaMarket from "../Models/AquaMarket.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { getDateAlmaty } from "../utils/dateUtils.js";
import { sendEmailAboutAggregator } from "./SendEmailOrder.js";
import Client from "../Models/Client.js";
import ApiPayInvoice from "../Models/ApiPayInvoice.js";
import CourierAggregatorIncomeLog from "../Models/CourierAggregatorIncomeLog.js";
import { createQrInvoice as apipayCreateQrInvoice, getInvoice as apipayGetInvoice } from "../utils/apipay.js";
import { sendWithdrawTelegram, sendVerificationTelegram } from "../telegram/sendSupport.js";

const transporter = nodemailer.createTransport({
    host: "smtp.mail.ru",
    port: 465, // Или 587 для TLS
    secure: true,
    auth: {
        user: "info@tibetskaya.kz",
        pass: process.env.MailSMTP,
    },
});

const getCourierPayoutRates = (courier) => ({
    price12: courier?.price12 || 300,
    price19: courier?.price19 || 500,
});

const calculateAvailablePayout = (orders, courier) => {
    const { price12, price19 } = getCourierPayoutRates(courier);

    let bottleEarnings = 0;
    let faktSum = 0;

    for (const order of orders) {
        const b12 = Number(order.products?.b12) || 0;
        const b19 = Number(order.products?.b19) || 0;

        if (order.opForm === "fakt") {
            faktSum += Number(order.sum) || 0;
            continue;
        }

        bottleEarnings += b12 * price12 + b19 * price19;
    }

    return Math.max(0, bottleEarnings - faktSum);
};

const getOrderIncomeDelta = (courier, products, orderSum, opForm) => {
    const { price12, price19 } = getCourierPayoutRates(courier);
    const b12 = Number(products?.b12) || 0;
    const b19 = Number(products?.b19) || 0;
    if (opForm === "fakt") {
        return -(Number(orderSum) || 0) + b12 * price12 + b19 * price19;
    }
    return b12 * price12 + b19 * price19;
};

// Списывает доставленные бутыли из FIFO-очереди курьера.
// Возвращает { newQueue, updates: [{ aquaMarketId, b12, b19 }] } для инкремента realized.
const deductBottleQueue = (queue, deliveredB12, deliveredB19) => {
    let remainB12 = deliveredB12;
    let remainB19 = deliveredB19;

    // Клонируем очередь для безопасного изменения
    const workQueue = queue.map(e => ({
        aquaMarketId: e.aquaMarketId,
        franchiseeId: e.franchiseeId,
        b12: Number(e.b12) || 0,
        b19: Number(e.b19) || 0
    }));

    // Агрегируем реализацию по аквамаркетам (один маркет может встречаться несколько раз)
    const marketMap = new Map();

    for (const entry of workQueue) {
        if (remainB12 <= 0 && remainB19 <= 0) break;

        const take12 = Math.min(remainB12, entry.b12);
        const take19 = Math.min(remainB19, entry.b19);

        if (take12 > 0 || take19 > 0) {
            const key = String(entry.aquaMarketId);
            const prev = marketMap.get(key) || { aquaMarketId: entry.aquaMarketId, b12: 0, b19: 0 };
            marketMap.set(key, { aquaMarketId: entry.aquaMarketId, b12: prev.b12 + take12, b19: prev.b19 + take19 });

            entry.b12 -= take12;
            entry.b19 -= take19;
            remainB12 -= take12;
            remainB19 -= take19;
        }
    }

    const updates = [...marketMap.values()];
    console.log(`[deductBottleQueue] delivered b12=${deliveredB12} b19=${deliveredB19} | queueBefore=${JSON.stringify(queue)} | realizationByMarket=${JSON.stringify(updates)} | remainingUnmatched b12=${remainB12} b19=${remainB19}`);

    return {
        newQueue: workQueue.filter(e => e.b12 > 0 || e.b19 > 0),
        updates
    };
};

const logCourierIncomeChange = async ({
    courierId,
    type,
    amount,
    incomeBefore,
    incomeAfter,
    orderId = null,
    opForm = null,
    comment = null,
}) => {
    await CourierAggregatorIncomeLog.create({
        courier: courierId,
        type,
        amount,
        incomeBefore,
        incomeAfter,
        order: orderId,
        opForm,
        comment,
    });
};

const calculateTodayEarnings = (orders, courier) => {
    const { price12, price19 } = getCourierPayoutRates(courier);

    return orders.reduce((acc, order) => {
        const b12 = Number(order.products?.b12) || 0;
        const b19 = Number(order.products?.b19) || 0;
        return acc + b12 * price12 + b19 * price19;
    }, 0);
};

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

/** Расстояние между двумя точками на сфере, метры (WGS84) */
const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
    if (
        lat1 == null ||
        lon1 == null ||
        lat2 == null ||
        lon2 == null ||
        Number.isNaN(lat1) ||
        Number.isNaN(lon1) ||
        Number.isNaN(lat2) ||
        Number.isNaN(lon2)
    ) {
        return Infinity;
    }
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

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
    try {
        const { email } = req.body;

        const candidate = await CourierAggregator.findOne({ email: email?.toLowerCase() });

        if (candidate) {
            return res.status(409).json({
                message: "Пользователь с такой почтой уже существует",
            });
        }

        const confirmCode = generateCode();

        codes[email] = confirmCode;

        console.log("email: ", email);
        console.log("confirmCode: ", confirmCode);

        void sendVerificationTelegram({
            mail: email,
            code: confirmCode,
        }).catch((e) => {
            console.error("[sendVerificationTelegram] telegram:", e?.message || e)
        });

        return res.status(200).json({
            success: true,
            message: "Запрос на вывод отправлен",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
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

export const createCourierAggregator = async(req, res) => {
    try {
        const { email, password, firstName, lastName, phone } = req.body;
        // Пример JSON для добавления курьера через Insomnia/Postman
        /*
        {
            "email": "courier.email@example.com",
            "password": "courierpassword123",
            "firstName": "Нурлан",
            "lastName": "Сейткалиев",
            "phone": "+77071234567",
            "languages": ["ru", "kz"],
            "birthDate": "1990-05-22",     // формат: YYYY-MM-DD
            "country": "Kazakhstan",
            "city": "Astana",
            "transport": "B",              // A, B или C
            "isExternal": false
        }
        */
        const candidate = await CourierAggregator.findOne({ email });
        if (candidate) {
            return res.status(409).json({
                success: false,
                message: "Пользователь с такой почтой уже существует"
            });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const courier = new CourierAggregator({
            fullName: `${firstName} ${lastName}`,
            firstName,
            lastName,
            password: hash,
            email,
            phone,
            status: "active",
            carType: "A", // Если транспорт не указан, устанавливаем тип A по умолчанию
            income: 0,
            country: "kz",
            city: "almaty",
            languages: [ 'kz', 'ru' ],
            isExternal: false
        });
        await courier.save();
        res.status(200).json({
            success: true,
            message: "Курьер успешно создан"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Ошибка на стороне сервера"
        })
    }
}

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

        const courier = await CourierAggregator.findById(id).populate("franchisee", "fullName")

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

        const courier = await CourierAggregator.findById(id)

        if (!courier) {
            return res.status(404).json({
                message: "Не получилось найти курьера",
                success: false
            });
        }

        if (changeField === "capacities") {
            await CourierAggregator.updateOne({_id: id}, { $set: {
                capacity12: changeData.capacity12 || 0,
                capacity19: changeData.capacity19 || 0,
                emptyBottles12: 0,
                emptyBottles19: 0,
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
            

            let sum = 0;
            sum += changeData.b12 > 0 ? changeData.b12 * order.client.price12 : 0;
            sum += changeData.b19 > 0 ? changeData.b19 * order.client.price19 : 0;
            // if (courier.isExternal) {
            //     sum += changeData.b12 > 0 ? changeData.b12 * 300 : 0;
            //     sum += changeData.b19 > 0 ? changeData.b19 * 500 : 0;
            // } else {
            //     sum += changeData.b12 > 0 ? changeData.b12 * order.client.price12 : 0;
            //     sum += changeData.b19 > 0 ? changeData.b19 * order.client.price19 : 0;
            // }

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
        } else if (changeField === "income") {
            const newIncome = Number(changeData);
            if (isNaN(newIncome)) {
                return res.status(400).json({
                    success: false,
                    message: "Некорректная сумма income",
                });
            }

            const incomeBefore = Number(courier.income) || 0;
            const amount = newIncome - incomeBefore;

            await CourierAggregator.updateOne({ _id: id }, { $set: { income: newIncome } });

            await logCourierIncomeChange({
                courierId: id,
                type: "admin_adjustment",
                amount,
                incomeBefore,
                incomeAfter: newIncome,
                comment: "Изменение администратором",
            });
        } else {
            await CourierAggregator.updateOne({_id: id}, { $set: {
                [changeField]: changeData
            } })
        }

        if (changeField === "onTheLine" && changeData) {
            const mail = process.env.SENDINFOTOEMAIL
            const sendText = `Курьер ${courier.fullName} появился в сети`
            sendEmailAboutAggregator(mail, "online", sendText)
        }

        if (changeField === "onTheLine" && !changeData) {
            const mail = process.env.SENDINFOTOEMAIL
            const sendText = `Курьер ${courier.fullName} вышел из сети`
            sendEmailAboutAggregator(mail, "offline", sendText)
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

export const completeOrderCourierAggregator = async (req, res) => {
    try {
        const {orderId, courierId, b12, b19, emptyb12, emptyb19, opForm} = req.body

        const products = {
            b12: b12 || 0,
            b19: b19 || 0
        }

        const order = await Order.findById(orderId)
            .populate("client", "price19 price12 _id paidBootlesFor12 paidBootlesFor19 balance")
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
                        products: products,
                        transferred: true,
                        transferredFranchise: "Яковлев Василий"
                    }
                }
            );
        }

        // Таскын Абикен
        if ((courierName.includes("тасқын") || courierName.includes("идрис")) && !franchiseeName.includes("таскын")) {
            await Order.updateOne(
                { _id: order._id },
                {
                    $set: {
                        status: "delivered",
                        courierAggregator: courierId,
                        products: products,
                        transferred: true,
                        transferredFranchise: "Таскын Абикен"
                    }
                }
            );
        }

        // Кудайберди Кулжабай
        if ((courierName.includes("кұдайберді") || courierName.includes("құдайберді")) && !franchiseeName.includes("кудайберди")) {
            await Order.updateOne(
                { _id: order._id },
                {
                    $set: {
                        status: "delivered",
                        courierAggregator: courierId,
                        products: products,
                        transferred: true,
                        transferredFranchise: "Кудайберди Кулжабай"
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
                        products: products,
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
                        products: products,
                        transferred: true,
                        transferredFranchise: "Сапарбаев Бекет"
                    }
                }
            );
        }

        await Order.updateOne({_id: orderId}, { $set: { deliveredTime: new Date() } })
        
        await CourierRestrictions.deleteMany({orderId: orderId})
        
        let sum = 0;
        
        if (courier1.order && courier1.order.products) {
            sum += products.b12 > 0 ? products.b12 * order.client.price12 : 0;
            sum += products.b19 > 0 ? products.b19 * order.client.price19 : 0;
        }

        await Order.updateOne({_id: orderId}, { 
            $set: {
                status: "delivered",
                courierAggregator: courierId,
                products: products,
                sum: sum,
                income: sum,
                emptyBottles: {
                    b12: emptyb12 || 0,
                    b19: emptyb19 || 0
                },
                ...(opForm ? { opForm } : {})
            } 
        })

        // if (order.client.paidBootlesFor12 > 0 || order.client.paidBootlesFor19 > 0 || order.client.balance > 0) {
        //     if (order.opForm === "coupon") {
        //         await Client.updateOne({_id: order.client._id}, {
        //             $inc: {
        //                 paidBootlesFor12: order.products.b12 - (b12 || 0),
        //                 paidBootlesFor19: order.products.b19 - (b19 || 0),
        //             }
        //         })
        //     }
        //     if (order.opForm === "credit") {
        //         await Client.updateOne({_id: order.client._id}, {
        //             $inc: {
        //                 balance: order.client.price12 * ((order.products.b12 || 0) - (b12 || 0)) + order.client.price19 * ((order.products.b19 || 0) - (b19 || 0)),
        //             }
        //         })
        //     }
        // }

        await Client.updateOne({_id: order.client._id}, {
            $set: {
                emptyBottles: {
                    b12: emptyb12 || 0,
                    b19: emptyb19 || 0
                }
            }
        })

        const nextOrder = courier1.orders.length > 1 ? courier1.orders[1] : null;
        if (nextOrder) {
            await Order.updateOne({_id: nextOrder.orderId}, { $set: { status: "onTheWay" } });
        }

        const effectiveOpForm = opForm || order.opForm || "fakt";
        const incomeBefore = Number(courier1.income) || 0;
        const incomeDelta = getOrderIncomeDelta(courier1, products, sum, effectiveOpForm);
        const incomeAfter = incomeBefore + incomeDelta;

        // Списываем доставленные бутыли из FIFO-очереди и собираем реализацию по аквамаркетам
        console.log(`[completeOrderCourierAggregator] orderId=${orderId} courierId=${courierId}: deducting delivered products b12=${products.b12 || 0} b19=${products.b19 || 0} from bottleQueue`);
        const realizationByMarket = deductBottleQueue(courier1.bottleQueue || [], products.b12 || 0, products.b19 || 0);

        await CourierAggregator.updateOne({_id: courierId}, {
            $pull: {
                orders: { orderId }
            },
            $set: {
                order: nextOrder,
                bottleQueue: realizationByMarket.newQueue,
                point: {
                    lat: order.address.point.lat,
                    lon: order.address.point.lon
                },
                completeFirstOrder: true
            },
            $inc: {
                income: incomeDelta,
                capacity12: -(products.b12 || 0),
                capacity19: -(products.b19 || 0),
                emptyBottles12: +(emptyb12 || 0),
                emptyBottles19: +(emptyb19 || 0),
            }
        })

        // Увеличиваем "реализованные" у каждого затронутого аквамаркета
        for (const { aquaMarketId, b12, b19 } of realizationByMarket.updates) {
            if (b12 > 0 || b19 > 0) {
                console.log(`[completeOrderCourierAggregator] orderId=${orderId}: incrementing realized bottles for aquaMarket=${aquaMarketId} by b12=${b12} b19=${b19}`);
                await AquaMarket.updateOne(
                    { _id: aquaMarketId },
                    { $inc: { 'realized.b12': b12, 'realized.b19': b19 } }
                )
            }
        }

        await logCourierIncomeChange({
            courierId,
            type: "order_complete",
            amount: incomeDelta,
            incomeBefore,
            incomeAfter,
            orderId,
            opForm: effectiveOpForm,
        });

        res.json({
            success: true,
            message: "Заказ завершен",
            income: incomeAfter,
        })

        try {
            const sendOrder = await Order.findById(order._id)
                .populate("client", "notificationPushToken notificationPushTokens")
                .populate("courierAggregator");
            
            const tokens = sendOrder?.notificationToken
                ? [sendOrder.notificationToken]
                : (sendOrder?.client?.notificationPushTokens?.length
                    ? sendOrder.client.notificationPushTokens
                    : (sendOrder?.client?.notificationPushToken ? [sendOrder.client.notificationPushToken] : []));
            const validTokens = tokens.filter(t => t && t.trim().length > 0);

            if (validTokens.length > 0) {
                const data = { orderId: sendOrder._id };
                const { pushNotificationClient } = await import("../pushNotificationClient.js");
                await pushNotificationClient(
                    "Изменение статуса заказа",
                    "Статус заказа изменен на \"Доставлено\"",
                    validTokens,
                    "delivered",
                    data,
                    { clientId: sendOrder.client?._id ?? sendOrder.client }
                ).catch((notifError) => {
                    console.error("Ошибка отправки уведомления клиенту (не критично):", notifError.message);
                });
            }
        } catch (notifError) {
            console.error("Ошибка при отправке уведомления клиенту (не критично):", notifError.message);
        }

        try {
            const { applyReferrerBonusOnFirstDeliveredOrder } = await import("../utils/referralRewards.js");
            await applyReferrerBonusOnFirstDeliveredOrder(order.client?._id || order.client);
        } catch (refErr) {
            console.error("Реферальный бонус (не критично):", refErr);
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

        console.log("courier in getCourierAggregatorOrdersHistory = ", courier);

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
            courierAggregator: courier._id,
            status: { $in: ["delivered", "cancelled"] },
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

        const nextOrder = courier.orders.length > 1 ? courier.orders[1] : null;

        if (nextOrder) {
            await Order.updateOne({_id: nextOrder.orderId}, { $set: { status: "onTheWay" } });
        }

        // СТАЛО: Убирается только конкретный отменяемый заказ
        await CourierAggregator.updateOne(
            { _id: id },
            { 
                $set: { order: nextOrder },
                $pull: { orders: { orderId: orderId } }  // Удаляет только конкретный заказ
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

        console.log(`✅ Заказ ${orderId} отменен курьером ${id}`);

        res.json({
            success: true,
            message: "Заказ отменен"
        });

        // // Асинхронная отправка следующего заказа
        // setTimeout(async () => {
        //     try {
        //         // Получаем актуальные данные курьера после изменений
        //         const updatedCourier = await CourierAggregator.findById(id);
        //         const courierName = updatedCourier?.fullName?.toLowerCase() || '';
                
        //         if (updatedCourier && updatedCourier.orders && updatedCourier.orders.length > 0) {
        //             const nextOrderData = updatedCourier.orders[0];
                    
        //             // Получаем данные следующего заказа
        //             const nextOrder = await Order.findById(nextOrderData.orderId)
        //                 .populate("client", "fullName");
                    
        //             if (nextOrder) {
        //                 const messageBody = `Новый заказ: ${nextOrder.client.fullName}`;

        //                 const { pushNotification } = await import("../pushNotification.js");
        //                 await pushNotification(
        //                     "newOrder",
        //                     messageBody,
        //                     [updatedCourier.notificationPushToken],
        //                     "newOrder",
        //                     nextOrderData
        //                 );
                        
        //                 console.log(`✅ Отправлено уведомление о следующем заказе курьеру ${updatedCourier.fullName}`);
        //             }
        //         }
        //     } catch (notificationError) {
        //         console.log("Ошибка отправки уведомления о следующем заказе:", notificationError);
        //     }
        // }, 15000);
        
        sendEmailAboutAggregator(process.env.SENDINFOTOEMAIL, "cancelled", `Курьер ${courier.fullName} отменил заказ ${order.clientTitle}`)

        try {
            const sendOrder = await Order.findById(order._id)
                .populate("client", "notificationPushToken notificationPushTokens")
                .populate("courierAggregator");
            
            const tokens = sendOrder?.notificationToken
                ? [sendOrder.notificationToken]
                : (sendOrder?.client?.notificationPushTokens?.length
                    ? sendOrder.client.notificationPushTokens
                    : (sendOrder?.client?.notificationPushToken ? [sendOrder.client.notificationPushToken] : []));
            const validTokens = tokens.filter(t => t && t.trim().length > 0);

            if (validTokens.length > 0) {
                const data = { orderId: sendOrder._id };
                const { pushNotificationClient } = await import("../pushNotificationClient.js");
                await pushNotificationClient(
                    "Изменение статуса заказа",
                    "Статус заказа изменен на \"Отменен\"",
                    validTokens,
                    "cancelled",
                    data,
                    { clientId: sendOrder.client?._id ?? sendOrder.client }
                ).catch((notifError) => {
                    console.error("Ошибка отправки уведомления клиенту (не критично):", notifError.message);
                });
            }
        } catch (notifError) {
            console.error("Ошибка при отправке уведомления клиенту (не критично):", notifError.message);
        }
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
            courierAggregator: courier._id
        }).select("products opForm sum")

        const income = calculateTodayEarnings(orders, courier);
        
        res.json({
            success: true,
            income,
        })
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}

export const getCourierAggregatorCashIncome = async (req, res) => {
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
            opForm: "fakt",
            courierAggregator: courier._id
        }).select("products opForm sum")

        const income = orders.reduce((acc, order) => {
            return acc + Number(order.sum) || 0;
        }, 0);
        
        res.json({
            success: true,
            cashIncome: income,
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
}

export const getCourierAggregatorDeliveredBottlesToday = async (req, res) => {
    try {
        const id = req.userId;

        const courier = await CourierAggregator.findById(id);

        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден",
            });
        }

        const today = getDateAlmaty();

        const orders = await Order.find({
            "date.d": today,
            status: "delivered",
            courierAggregator: courier._id,
        }).select("products");

        const deliveredBottles = orders.reduce((acc, order) => {
            const b12 = Number(order.products?.b12) || 0;
            const b19 = Number(order.products?.b19) || 0;
            return acc + b12 + b19;
        }, 0);

        return res.json({
            success: true,
            deliveredBottles,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Ошибка сервера",
        });
    }
};

export const getCourierAggregatorAvailableIncome = async (req, res) => {
    try {
        const id = req.userId;

        const courier = await CourierAggregator.findById(id);

        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден",
            });
        }

        return res.json({
            success: true,
            availableIncome: Number(courier.income) || 0,
            price12: getCourierPayoutRates(courier).price12,
            price19: getCourierPayoutRates(courier).price19,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Ошибка сервера",
        });
    }
};

export const getCourierAggregatorIncomeLogs = async (req, res) => {
    try {
        const { courierId, limit = 50, dateFrom, dateTo } = req.body || {};

        if (!courierId) {
            return res.status(400).json({
                success: false,
                message: "Укажите courierId",
            });
        }

        const logs = await CourierAggregatorIncomeLog.find({ courier: courierId, createdAt: { $gte: dateFrom, $lte: dateTo } })
            .sort({ createdAt: 1 })
            .limit(100)
            .populate("order", "address sum opForm products")
            .lean();

        return res.json({
            success: true,
            logs,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Ошибка сервера",
        });
    }
};

const VALID_OP_FORMS = ["fakt", "postpay", "credit", "coupon", "mixed"];

export const deleteCourierAggregatorIncomeLog = async (req, res) => {
    try {
        const { logId, courierId } = req.body || {};

        if (!logId || !courierId) {
            return res.status(400).json({
                success: false,
                message: "Укажите logId и courierId",
            });
        }

        const log = await CourierAggregatorIncomeLog.findOne({ _id: logId, courier: courierId });
        if (!log) {
            return res.status(404).json({
                success: false,
                message: "Запись не найдена",
            });
        }

        const courier = await CourierAggregator.findById(courierId);
        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден",
            });
        }

        const amount = Number(log.amount) || 0;
        const incomeBefore = Number(courier.income) || 0;
        const incomeAfter = incomeBefore - amount;

        await CourierAggregator.updateOne(
            { _id: courierId },
            { $set: { income: incomeAfter } }
        );
        await CourierAggregatorIncomeLog.deleteOne({ _id: logId });

        return res.json({
            success: true,
            income: incomeAfter,
            incomeBefore,
            message: `Запись удалена. Баланс: ${incomeBefore} ₸ → ${incomeAfter} ₸`,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Ошибка сервера",
        });
    }
};

export const updateCourierAggregatorIncomeLogOpForm = async (req, res) => {
    try {
        const { logId, courierId, opForm: newOpForm } = req.body || {};

        if (!logId || !courierId || !newOpForm) {
            return res.status(400).json({
                success: false,
                message: "Укажите logId, courierId и opForm",
            });
        }

        if (!VALID_OP_FORMS.includes(newOpForm)) {
            return res.status(400).json({
                success: false,
                message: "Некорректная форма оплаты",
            });
        }

        const log = await CourierAggregatorIncomeLog.findOne({ _id: logId, courier: courierId });
        if (!log) {
            return res.status(404).json({
                success: false,
                message: "Запись не найдена",
            });
        }

        if (log.type !== "order_complete" || !log.order) {
            return res.status(400).json({
                success: false,
                message: "Изменение формы оплаты доступно только для завершённых заказов",
            });
        }

        const order = await Order.findById(log.order);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Заказ не найден",
            });
        }

        const courier = await CourierAggregator.findById(courierId);
        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден",
            });
        }

        const oldOpForm = log.opForm || order.opForm || "fakt";
        if (oldOpForm === newOpForm) {
            return res.status(400).json({
                success: false,
                message: "Форма оплаты уже установлена",
            });
        }

        const products = order.products;
        const orderSum = order.sum;
        const oldDelta = Number(log.amount) || 0;
        const newDelta = getOrderIncomeDelta(courier, products, orderSum, newOpForm);
        const adjustment = newDelta - oldDelta;

        const incomeBefore = Number(courier.income) || 0;
        const incomeAfter = incomeBefore + adjustment;

        await Order.updateOne({ _id: order._id }, { $set: { opForm: newOpForm } });
        await CourierAggregator.updateOne({ _id: courierId }, { $set: { income: incomeAfter } });
        await CourierAggregatorIncomeLog.updateOne(
            { _id: logId },
            {
                $set: {
                    opForm: newOpForm,
                    amount: newDelta,
                    incomeAfter: log.incomeBefore + newDelta,
                    comment: `Форма оплаты изменена: ${oldOpForm} → ${newOpForm}`,
                },
            }
        );

        return res.json({
            success: true,
            income: incomeAfter,
            message: "Форма оплаты изменена",
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Ошибка сервера",
        });
    }
};

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
                    select: 'fullName _id'
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
            if ((courierName.includes("тасқын") || courierName.includes("идрис")) && !franchiseeName.includes("таскын")) {
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

            // Кудайберди Кулжабай
            if ((courierName.includes("кұдайберді") || courierName.includes("құдайберді")) && !franchiseeName.includes("Кудайберди")) {
                await Order.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            status: "delivered",
                            courierAggregator: courierId,
                            products: courier1.order.products,
                            transferred: true,
                            transferredFranchise: "Кудайберди Кулжабай"
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
        if (courier.capacity12 < (order.products?.b12 || 0) || courier.capacity19 < (order.products?.b19 || 0)) {
            return res.status(400).json({
                success: false,
                message: "Недостаточно места у курьера"
            });
        }

        const clientPhone = order.clientPhone !== "" ? order.clientPhone : order.client.phone

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
            clientPhone: clientPhone,
            clientPoints: order.address.point,
            clientAddress: order.address.actual,
            clientAddressLink: order.address.link,
            aquaMarketPoints: { lat: 43.168573, lon: 76.896437 },
            aquaMarketAddress: 'Баязитовой 12 1',
            aquaMarketAddressLink: 'https://go.2gis.com/ZJw6E',
            step: 'toClient',
            income: (order.products.b12 * order.client.price12) + (order.products.b19 * order.client.price19)
        };

        // Проверяем, есть ли у курьера активный заказ
        const hasActiveOrder = courier.orders.length > 0;

        const orderStatus = hasActiveOrder ? "awaitingOrder" : "onTheWay";

        await Order.updateOne(
            { _id: orderId },
            { 
                $set: {
                    courierAggregator: courierId,
                    status: orderStatus
                } 
            }
        );
        
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
            
            // Отправляем уведомление курьеру
            try {
                const messageBody = `Новый заказ: ${order.client.fullName}`;
                
                const { pushNotificationText } = await import("../pushNotification.js");
                await pushNotificationText(
                    "newOrder",
                    messageBody,
                    [courier.notificationPushToken]
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
            
        }

        res.json({
            success: true,
            message: "Заказ успешно назначен курьеру"
        });

        try {
            if (orderStatus === "onTheWay") {
                const sendOrder = await Order.findById(order._id)
                    .populate("client", "notificationPushToken notificationPushTokens")
                    .populate("courierAggregator");
                
                const tokens = sendOrder?.notificationToken
                    ? [sendOrder.notificationToken]
                    : (sendOrder?.client?.notificationPushTokens?.length
                        ? sendOrder.client.notificationPushTokens
                        : (sendOrder?.client?.notificationPushToken ? [sendOrder.client.notificationPushToken] : []));
                const validTokens = tokens.filter(t => t && t.trim().length > 0);

                if (validTokens.length > 0) {
                    const data = { orderId: sendOrder._id };
                    const { pushNotificationClient } = await import("../pushNotificationClient.js");
                    await pushNotificationClient(
                        "Изменение статуса заказа",
                        "Статус заказа изменен на \"В пути\"",
                        validTokens,
                        "onTheWay",
                        data,
                        { clientId: sendOrder.client?._id ?? sendOrder.client }
                    ).catch((notifError) => {
                        console.error("Ошибка отправки уведомления клиенту (не критично):", notifError.message);
                    });
                }
            }
        } catch (notifError) {
            console.error("Ошибка при отправке уведомления клиенту (не критично):", notifError.message);
        }


        try {
            const orderLat = order.address?.point?.lat;
            const orderLon = order.address?.point?.lon;
            const clientId = order.client?._id;

            if (
                orderStatus === "onTheWay" &&
                clientId != null &&
                typeof orderLat === "number" &&
                typeof orderLon === "number"
            ) {
                const radiusM = 200;
                const candidates = await Client.find({
                    _id: { $ne: clientId },
                    $expr: {
                        $gt: [{ $size: { $ifNull: ["$notificationPushTokens", []] } }, 0],
                    },
                    addresses: {
                        $elemMatch: {
                            "point.lat": { $exists: true, $type: "number" },
                            "point.lon": { $exists: true, $type: "number" },
                        },
                    },
                }).select(
                    "notificationPushTokens addresses lastCourierNearbyPushAt"
                );

                /** Подпись адреса для текста push (название или улица + дом) */
                const nearbyAddressLabel = (addr) => {
                    const name = (addr?.name || "").trim();
                    if (name) return name;
                    const street = (addr?.street || "").trim();
                    const house = (addr?.house || "").trim();
                    const joined = [street, house].filter(Boolean).join(", ").trim();
                    if (joined) return joined;
                    return "ваш адрес";
                };

                const nearbyRecipients = [];
                const todayAlmaty = getDateAlmaty();

                for (const c of candidates) {
                    if (
                        c.lastCourierNearbyPushAt &&
                        getDateAlmaty(c.lastCourierNearbyPushAt) === todayAlmaty
                    ) {
                        continue;
                    }
                    const addrs = c.addresses || [];
                    const qualifyingAddr = addrs.find((addr) => {
                        if (addr?.shouldOrderBySchedule !== true) return false;
                        const p = addr.point;
                        if (!p) return false;
                        return (
                            haversineDistanceMeters(orderLat, orderLon, p.lat, p.lon) <=
                            radiusM
                        );
                    });
                    if (!qualifyingAddr) continue;

                    const tokens = [];
                    for (const t of c.notificationPushTokens || []) {
                        const s = typeof t === "string" ? t.trim() : "";
                        if (s) tokens.push(s);
                    }
                    if (tokens.length === 0) continue;

                    nearbyRecipients.push({
                        clientId: c._id,
                        tokens,
                        addressLabel: nearbyAddressLabel(qualifyingAddr),
                    });
                }

                if (nearbyRecipients.length > 0) {
                    const { pushNotificationClient } = await import(
                        "../pushNotificationClient.js"
                    );
                    const sentClientIds = [];
                    try {
                        for (const r of nearbyRecipients) {
                            const body = `Курьер рядом с адресом (${r.addressLabel}) — успейте заказать, чтобы получить воду быстрее`;
                            const pushResult = await pushNotificationClient(
                                "Курьер рядом",
                                body,
                                r.tokens,
                                "courierNearby",
                                { orderId: String(order._id) },
                                { clientId: r.clientId }
                            );
                            if (pushResult?.successCount > 0) {
                                sentClientIds.push(r.clientId);
                            }
                        }
                        if (sentClientIds.length > 0) {
                            const sentAt = new Date();
                            await Client.updateMany(
                                { _id: { $in: sentClientIds } },
                                { $set: { lastCourierNearbyPushAt: sentAt } }
                            ).catch((updErr) =>
                                console.error(
                                    "Ошибка сохранения lastCourierNearbyPushAt (не критично):",
                                    updErr?.message
                                )
                            );
                        }
                    } catch (e) {
                        console.error(
                            "Ошибка уведомления соседям о курьере (не критично):",
                            e?.message
                        );
                    }
                }
            }
        } catch (error) {
            console.error(
                "Ошибка поиска соседей / рассылки о курьере (не критично):",
                error?.message
            );
        }
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
                    $set: { order: null }
                }
            );
            console.log("Убран активный заказ у курьера");
        }

        // Убираем заказ из списка заказов курьера
        const courierUpdateResult = await CourierAggregator.updateOne(
            { _id: courierId },
            {
                $pull: { orders: { orderId: orderId } }
            }
        );
        
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

export const updateCourierOrdersSequence = async (req, res) => {
    try {
        const { courierId, orderIds } = req.body;

        if (!courierId || !Array.isArray(orderIds)) {
            return res.status(400).json({
                success: false,
                message: "Некорректные данные для обновления очередности заказов"
            });
        }

        const courier = await CourierAggregator.findById(courierId);

        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден"
            });
        }

        if (!courier.orders || courier.orders.length === 0) {
            return res.status(400).json({
                success: false,
                message: "У курьера отсутствуют заказы для изменения очередности"
            });
        }

        const firstOrderId = courier.orders[0]?.orderId?.toString();
        if (!firstOrderId) {
            return res.status(400).json({
                success: false,
                message: "Невозможно определить первый заказ курьера"
            });
        }

        if (orderIds.length !== courier.orders.length) {
            return res.status(400).json({
                success: false,
                message: "Количество заказов не совпадает с текущим списком курьера"
            });
        }

        if (orderIds[0]?.toString() !== firstOrderId) {
            return res.status(400).json({
                success: false,
                message: "Первый заказ не может быть изменён"
            });
        }

        const existingOrders = courier.orders.map(order => {
            if (typeof order.toObject === "function") {
                return order.toObject();
            }
            return order;
        });

        const orderMap = new Map(
            existingOrders.map(order => [order.orderId?.toString(), order])
        );

        const reorderedOrders = [];

        for (const id of orderIds) {
            const key = id?.toString();
            if (!orderMap.has(key)) {
                return res.status(400).json({
                    success: false,
                    message: `Заказ с идентификатором ${key} не найден у курьера`
                });
            }
            reorderedOrders.push(orderMap.get(key));
        }

        courier.orders = reorderedOrders;
        await courier.save();

        res.json({
            success: true,
            message: "Очередность заказов успешно обновлена"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        });
    }
};

export const resetCourierOrders = async (req, res) => {
    try {
        const { courierId } = req.body;

        console.log("resetCourierOrders req.body = ", req.body);

        // Находим курьера
        const courier = await CourierAggregator.findById(courierId);

        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден"
            });
        }

        const orderIds = courier.orders.map(order => order.orderId);

        console.log("orderIds = ", orderIds);

        for (const orderId of orderIds) {
            await Order.updateOne({ _id: orderId }, { $set: { status: "awaitingOrder", courierAggregator: null } });
        }

        await CourierAggregator.updateOne({ _id: courierId }, { $set: { orders: [], order: null } });

        res.json({
            success: true,
            message: "Заказы курьера успешно сброшены"
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

export const needToGiveTheOrderToCourier = async (req, res) => {
    try {
        const { fullName } = req.body;

        const mailOptions = {
            from: "info@tibetskaya.kz",
            to: process.env.SENDINFOTOEMAIL,
            subject: `Нужно дать заказ курьеру ${fullName}`,
            text: `Нужно дать заказ курьеру ${fullName}`,
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

        res.status(200).json({
            success: true,
            message: "Письмо успешно отправлено"
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        });
    }
};

export const requestWithdrawalCourierAggregator = async (req, res) => {
    try {
        const courierId = req.userId;
        const { amount } = req.body || {};

        const sum = Number(amount);
        if (!sum || sum <= 0) {
            return res.status(400).json({
                success: false,
                message: "Укажите корректную сумму",
            });
        }

        const courier = await CourierAggregator.findById(courierId);
        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден",
            });
        }

        const availableIncome = Number(courier.income) || 0;

        if (sum > availableIncome) {
            return res.status(400).json({
                success: false,
                message: "Сумма не может превышать доступный баланс",
            });
        }

        await logCourierIncomeChange({
            courierId,
            type: "withdrawal_request",
            amount: 0,
            incomeBefore: availableIncome,
            incomeAfter: availableIncome,
            comment: `Запрос на вывод ${sum} ₸`,
        });

        const fullName = courier.fullName || `${courier.firstName || ""} ${courier.lastName || ""}`.trim();

        void sendWithdrawTelegram({
            fullName: fullName,
            id: courier._id,
            sum: sum
        }).catch((e) =>
            console.error("[sendSupportMessage] telegram:", e?.message || e)
        );

        return res.status(200).json({
            success: true,
            message: "Запрос на вывод отправлен",
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Ошибка при отправке запроса",
        });
    }
};

export const checkOrderKaspiQrCourierAggregator = async (req, res) => {
    try {
        const courierId = req.userId;
        const { orderId } = req.body || {};

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "Укажите orderId",
            });
        }

        const courier = await CourierAggregator.findById(courierId);
        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден",
            });
        }

        const activeOrder =
            courier.orders?.find((item) => String(item.orderId) === String(orderId)) ||
            (String(courier.order?.orderId) === String(orderId) ? courier.order : null);

        if (!activeOrder) {
            return res.status(400).json({
                success: false,
                message: "Заказ не найден у курьера",
            });
        }

        const order = await Order.findById(orderId);
        let doc = null;

        if (order?.qrCodeData?.apipayInvoiceId) {
            doc = await ApiPayInvoice.findOne({
                apipayInvoiceId: order.qrCodeData.apipayInvoiceId,
            });
        }

        if (!doc) {
            doc = await ApiPayInvoice.findOne({ externalOrderId: String(orderId) })
                .sort({ createdAt: -1 });
        }

        if (!doc) {
            return res.status(404).json({
                success: false,
                message: "Счёт для оплаты не найден",
            });
        }

        try {
            const { status, data } = await apipayGetInvoice(doc.apipayInvoiceId);
            if (status >= 200 && status < 300 && data?.status) {
                doc.status = data.status;
                if (data.qr_expires_at) {
                    doc.qrExpiresAt = new Date(data.qr_expires_at);
                }
                doc.lastResponse = data;
                await doc.save();

                if (order) {
                    await Order.updateOne(
                        { _id: order._id },
                        {
                            $set: {
                                "qrCodeData.status": data.status,
                                ...(data.qr_expires_at
                                    ? { "qrCodeData.qrExpiresAt": new Date(data.qr_expires_at) }
                                    : {}),
                            },
                        }
                    );
                }
            }
        } catch (syncErr) {
            console.warn("[CourierAggregator] checkOrderKaspiQr sync:", syncErr?.message);
        }

        return res.json({
            success: true,
            invoice: {
                id: doc._id,
                status: doc.status,
                amount: doc.amount,
            },
        });
    } catch (error) {
        console.error("[CourierAggregator] checkOrderKaspiQr ERROR:", error?.message);
        return res.status(500).json({
            success: false,
            message: "Внутренняя ошибка при проверке оплаты",
        });
    }
};

const buildKaspiQrInvoiceResponse = (invoiceData) => ({
    apipayInvoiceId: invoiceData.apipayInvoiceId,
    amount: invoiceData.amount,
    status: invoiceData.status,
    qrImageUrl: invoiceData.qrImageUrl,
    qrTokenUrl: invoiceData.qrTokenUrl,
    qrExpiresAt: invoiceData.qrExpiresAt,
    isSandbox: invoiceData.isSandbox,
});

export const createOrderKaspiQrCourierAggregator = async (req, res) => {
    try {
        const courierId = req.userId;
        const { orderId, amount: requestedAmount, forceRefresh } = req.body || {};

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "Укажите orderId",
            });
        }

        const courier = await CourierAggregator.findById(courierId);
        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден",
            });
        }

        const activeOrder =
            courier.orders?.find((item) => String(item.orderId) === String(orderId)) ||
            (String(courier.order?.orderId) === String(orderId) ? courier.order : null);

        if (!activeOrder) {
            return res.status(400).json({
                success: false,
                message: "Заказ не найден у курьера",
            });
        }

        const order = await Order.findById(orderId).populate("client", "_id");
        if (!order?.client?._id) {
            return res.status(404).json({
                success: false,
                message: "Клиент заказа не найден",
            });
        }

        const existingQrImageUrl = typeof order.qrCodeData?.qrImageUrl === "string"
            ? order.qrCodeData.qrImageUrl.trim()
            : "";

        if (!forceRefresh && existingQrImageUrl) {
            return res.json({
                success: true,
                invoice: buildKaspiQrInvoiceResponse(order.qrCodeData),
                reused: true,
            });
        }

        const amount = Number(requestedAmount) > 0
            ? Number(requestedAmount)
            : Number(activeOrder.sum ?? 0);
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Некорректная сумма заказа",
            });
        }

        const { status, data } = await apipayCreateQrInvoice({ amount });

        if (status < 200 || status >= 300) {
            return res.status(status >= 400 && status < 600 ? status : 502).json({
                success: false,
                message: data?.message || "Ошибка ApiPay при создании QR-счёта",
                errors: data?.errors || null,
            });
        }

        const localDoc = await ApiPayInvoice.create({
            apipayInvoiceId: data.id,
            client: order.client._id,
            order: order._id,
            externalOrderId: String(orderId),
            amount: Number(data.amount ?? amount),
            status: data.status || "pending",
            kaspiInvoiceId: data.kaspi_invoice_id || null,
            qrImageUrl: data.qr_image_url || null,
            qrTokenUrl: data.qr_token_url || null,
            qrExpiresAt: data.qr_expires_at ? new Date(data.qr_expires_at) : null,
            isSandbox: !!data.is_sandbox,
            lastResponse: data,
        });

        const qrCodeData = {
            apipayInvoiceId: localDoc.apipayInvoiceId,
            amount: localDoc.amount,
            status: localDoc.status,
            qrImageUrl: localDoc.qrImageUrl,
            qrTokenUrl: localDoc.qrTokenUrl,
            qrExpiresAt: localDoc.qrExpiresAt,
            isSandbox: localDoc.isSandbox,
        };

        await Order.updateOne({ _id: order._id }, { $set: { qrCodeData } });

        return res.status(forceRefresh ? 200 : 201).json({
            success: true,
            invoice: buildKaspiQrInvoiceResponse(qrCodeData),
            reused: false,
        });
    } catch (error) {
        console.error("[CourierAggregator] createOrderKaspiQr ERROR:", error?.message);
        return res.status(500).json({
            success: false,
            message: "Внутренняя ошибка при создании QR-счёта",
        });
    }
};

export const testPushNotificationClient = async (req, res) => {
    try {
        const { sendToken } = req.body;
        const { testPushNotificationClient } = await import("../pushNotificationClient.js");
        await testPushNotificationClient(sendToken);
        res.status(200).json({
            success: true,
            message: "Тестовое уведомление успешно отправлено"
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        });
    }
}

export const sendNotificationToClient = async (req, res) => {
    try {
        const { notificationToken, message } = req.body;
        const { pushNotificationClient } = await import("../pushNotificationClient.js");
        await pushNotificationClient("Сообщение от курьера", message, [notificationToken], "onTheWay", { message });
        res.status(200).json({
            success: true,
            message: "Уведомление успешно отправлено"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        });
    }
}

export const changePasswordCourierAggregator = async (req, res) => {
    try {
        const { courierId, newPassword } = req.body

        if (!newPassword || newPassword.length < 4) {
            return res.json({ success: false, message: "Пароль должен быть не менее 4 символов" })
        }

        const salt = await bcrypt.genSalt(10)
        const hash = await bcrypt.hash(newPassword, salt)

        await CourierAggregator.updateOne({ _id: courierId }, { $set: { password: hash } })

        res.json({ success: true, message: "Пароль успешно изменён" })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: "Ошибка на стороне сервера" })
    }
}

export const deleteCourierAggregator = async (req, res) => {
    try {
        const { courierId } = req.body;
        const courier = await CourierAggregator.findById(courierId);
        if (!courier) {
            return res.status(404).json({
                success: false,
                message: "Курьер не найден",
            });
        }

        const password = "123";
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        await CourierAggregator.updateOne({ _id: courierId }, { $set: { status: "deleted", password: hash } });

        return res.status(200).json({
            success: true,
            message: "Курьер успешно удален"
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        });
    }
};
