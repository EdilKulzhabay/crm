import Client from "../Models/Client.js";
import Order from "../Models/Order.js"
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {Expo} from "expo-server-sdk";
import { scheduleJob } from "node-schedule";
import "dotenv/config";
import { pushNotification } from "../pushNotification.js";
import User from "../Models/User.js";
import getLocationsLogicQueue from "../utils/getLocationsLogicQueue.js";
import CourierAggregator from "../Models/CourierAggregator.js";

let expo = new Expo({ useFcmV1: true });

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
const lastSentTime = {}; // Отслеживание времени последней отправки
const sendingInProgress = new Set(); // Отслеживание отправок в процессе

export const sendMail = async (req, res) => {
    const { mail } = req.body;

    // Валидация email
    if (!mail || !mail.includes('@')) {
        return res.status(400).json({
            success: false,
            message: "Некорректный email адрес"
        });
    }

    const normalizedMail = mail.toLowerCase();

    // Проверка на повторную отправку (защита от спама)
    const now = Date.now();
    const lastSent = lastSentTime[normalizedMail];
    const COOLDOWN_PERIOD = 60000; // 1 минута

    if (lastSent && (now - lastSent) < COOLDOWN_PERIOD) {
        const remainingTime = Math.ceil((COOLDOWN_PERIOD - (now - lastSent)) / 1000);
        return res.status(429).json({
            success: false,
            message: `Повторная отправка возможна через ${remainingTime} секунд`
        });
    }

    // Проверка на отправку в процессе
    if (sendingInProgress.has(normalizedMail)) {
        return res.status(429).json({
            success: false,
            message: "Отправка уже в процессе, пожалуйста подождите"
        });
    }

    // Добавляем в процесс отправки
    sendingInProgress.add(normalizedMail);

    try {
        const candidate = await Client.findOne({ mail: normalizedMail });

        // if (candidate) {
        //     sendingInProgress.delete(normalizedMail);
        //     return res.status(409).json({
        //         message: "Пользователь с такой почтой уже существует",
        //     });
        // }

        const confirmCode = generateCode();

        codes[normalizedMail] = confirmCode;
        lastSentTime[normalizedMail] = now;

        const mailOptions = {
            from: "info@tibetskaya.kz",
            to: normalizedMail,
            subject: "Подтверждение электронной почты",
            text: `Ваш код подтверждения: ${confirmCode}`,
        };

        transporter.sendMail(mailOptions, function (error, info) {
            // Убираем из процесса отправки
            sendingInProgress.delete(normalizedMail);
            
            if (error) {
                console.log("Ошибка отправки email:", error);
                // Удаляем сохраненный код при ошибке
                delete codes[normalizedMail];
                delete lastSentTime[normalizedMail];
                
                res.status(500).json({
                    success: false,
                    message: "Ошибка при отправке письма"
                });
            } else {
                console.log("Email sent successfully:", info.response);
                res.status(200).json({
                    success: true,
                    message: "Письмо успешно отправлено"
                });
            }
        });

    } catch (error) {
        // Убираем из процесса отправки при ошибке
        sendingInProgress.delete(normalizedMail);
        console.log("Ошибка в sendMail:", error);
        res.status(500).json({
            success: false,
            message: "Внутренняя ошибка сервера"
        });
    }
};

export const sendMailRecovery = async (req, res) => {
    const { mail } = req.body;

    // Валидация email
    if (!mail || !mail.includes('@')) {
        return res.status(400).json({
            success: false,
            message: "Некорректный email адрес"
        });
    }

    const normalizedMail = mail.toLowerCase();

    // Проверка на повторную отправку (защита от спама)
    const now = Date.now();
    const lastSent = lastSentTime[normalizedMail];
    const COOLDOWN_PERIOD = 60000; // 1 минута

    if (lastSent && (now - lastSent) < COOLDOWN_PERIOD) {
        const remainingTime = Math.ceil((COOLDOWN_PERIOD - (now - lastSent)) / 1000);
        return res.status(429).json({
            success: false,
            message: `Повторная отправка возможна через ${remainingTime} секунд`
        });
    }

    // Проверка на отправку в процессе
    if (sendingInProgress.has(normalizedMail)) {
        return res.status(429).json({
            success: false,
            message: "Отправка уже в процессе, пожалуйста подождите"
        });
    }

    // Добавляем в процесс отправки
    sendingInProgress.add(normalizedMail);

    try {
        // Проверка наличия кандидата
        const candidate = await Client.findOne({ mail: normalizedMail });

        if (!candidate) {
            sendingInProgress.delete(normalizedMail);
            return res.status(404).json({
                success: false,
                message: "Пользователь с такой почтой не существует",
            });
        }

        // Генерация кода подтверждения
        const confirmCode = generateCode();

        // Сохранение кода подтверждения
        codes[normalizedMail] = confirmCode;
        lastSentTime[normalizedMail] = now;

        const mailOptions = {
            from: "info@tibetskaya.kz",
            to: normalizedMail,
            subject: "Восстановление пароля",
            text: `Ваш код для восстановления пароля: ${confirmCode}`,
        };

        // Отправка письма
        transporter.sendMail(mailOptions, function (error, info) {
            // Убираем из процесса отправки
            sendingInProgress.delete(normalizedMail);
            
            if (error) {
                console.log("Ошибка отправки email восстановления:", error);
                // Удаляем сохраненный код при ошибке
                delete codes[normalizedMail];
                delete lastSentTime[normalizedMail];
                
                res.status(500).json({
                    success: false,
                    message: "Ошибка при отправке письма"
                });
            } else {
                console.log("Recovery email sent successfully:", info.response);
                res.status(200).json({
                    success: true,
                    message: "Письмо успешно отправлено"
                });
            }
        });

    } catch (error) {
        // Убираем из процесса отправки при ошибке
        sendingInProgress.delete(normalizedMail);
        console.log("Ошибка в sendMailRecovery:", error);
        res.status(500).json({
            success: false,
            message: "Внутренняя ошибка сервера"
        });
    }
};

export const codeConfirm = async (req, res) => {
    try {
        const { mail, code } = req.body;
        console.log("codeConfirm req.body: ", req.body);
        
        const normalizedMail = mail?.toLowerCase();
        
        if (!normalizedMail || !code) {
            return res.status(400).json({
                success: false,
                message: "Необходимо указать email и код"
            });
        }
        
        if (codes[normalizedMail] === code) {
            console.log("codeConfirm code is correct");
            delete codes[normalizedMail]; // Удаляем код после успешного подтверждения
            delete lastSentTime[normalizedMail]; // Удаляем время последней отправки
            res.status(200).json({
                success: true,
                message: "Код успешно подтвержден"
            });
        } else {
            console.log("codeConfirm code is incorrect");
            res.status(400).json({
                success: false,
                message: "Неверный код"
            });
        }
    } catch (error) {
        console.log("Ошибка в codeConfirm:", error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const clientRegister = async (req, res) => {
    try {
        const { fullName, phone, mail } = req.body;
        const superAdminId = "66fc01a4803e3f68963c14f3"
        const candidate = await Client.findOne({ phone });

        if (candidate) {
            return res.status(409).json({
                success: false,
                message: "Пользователь с таким номером уже существует",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(req.body.password, salt);

        const doc = new Client({
            fullName,
            password: hash,
            phone,
            mail: mail?.toLowerCase(),
            cart: {
                b12: 0,
                b19: 0,
            },
            franchisee: superAdminId,
            price12: 900,
            price19: 1300,
            dailyWater: 2,
            opForm: "fakt",
            type: true
        });

        const client = await doc.save();

        const accessToken = jwt.sign(
            { client: client._id },
            process.env.SecretKey,
            {
                expiresIn: "30d", // Время жизни access токена (например, 15 минут)
            }
        );

        const refreshToken = jwt.sign(
            { client: client._id },
            process.env.SecretKeyRefresh,
            {
                expiresIn: "30d", // Время жизни refresh токена (например, 30 дней)
            }
        );

        await Client.findByIdAndUpdate(client._id, {
            refreshToken: refreshToken,
        });

        const clientData = {
            fullName: client._doc.fullName,
            phone: client._doc.phone,
            mail: client._doc.mail,
            password: client._doc.password,
            franchisee: client._doc.franchisee,
            addresses: client._doc.addresses,
            status: client._doc.status,
            cart: client._doc.cart,
            bonus: client._doc.bonus,
            subscription: client._doc.subscription,
            chooseTime: client._doc.chooseTime,
            clientType: client._doc.clientType,
            clientBottleType: client._doc.clientBottleType,
            clientBottleCount: client._doc.clientBottleCount,
            clientBottleCredit: client._doc.clientBottleCredit,
            verify: client._doc.verify,
            haveCompletedOrder: client._doc.haveCompletedOrder,
            createdAt: client._doc.createdAt,
            updatedAt: client._doc.updatedAt,
        }

        res.json({ success: true, accessToken, refreshToken: refreshToken, clientData });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const clientLogin = async (req, res) => {
    try {
        const { mail } = req.body;

        console.log("clientLogin req.body: ", req.body);

        const candidate = await Client.findOne({ mail: mail?.toLowerCase() });

        if (!candidate) {
            console.log("clientLogin candidate is not found");
            return res.status(404).json({
                success: false,
                message: "Неверный логин или пароль",
            });
        }

        const isValidPass = await bcrypt.compare(
            req.body.password,
            candidate.password
        );

        if (!isValidPass) {
            console.log("clientLogin isValidPass is false");
            return res.status(404).json({
                success: false,
                message: "Неверный логин или пароль",
            });
        }

        if (candidate.status !== "active") {
            console.log("clientLogin candidate.status is not active");
            return res.status(404).json({
                success: false,
                message: "Ваш аккаунт заблокироан, свяжитесь с вашим франчайзи",
            });
        }


        const clientData = {
            fullName: candidate._doc.fullName,
            phone: candidate._doc.phone,
            mail: candidate._doc.mail,
            password: candidate._doc.password,
            franchisee: candidate._doc.franchisee,
            addresses: candidate._doc.addresses,
            status: candidate._doc.status,
            cart: candidate._doc.cart,
            bonus: candidate._doc.bonus,
            subscription: candidate._doc.subscription,
            chooseTime: candidate._doc.chooseTime,
            expoPushToken: candidate._doc.expoPushToken,
            clientType: candidate._doc.clientType,
            clientBottleType: candidate._doc.clientBottleType,
            clientBottleCount: candidate._doc.clientBottleCount,
            clientBottleCredit: candidate._doc.clientBottleCredit,
            verify: candidate._doc.verify,
            haveCompletedOrder: candidate._doc.haveCompletedOrder,
            createdAt: candidate._doc.createdAt,
            updatedAt: candidate._doc.updatedAt,
        };

        const accessToken = jwt.sign(
            { client: candidate._id },
            process.env.SecretKey,
            {
                expiresIn: "30d", // Время жизни access токена (например, 15 минут)
            }
        );

        const refreshToken2 = jwt.sign(
            { client: candidate._id },
            process.env.SecretKeyRefresh,
            {
                expiresIn: "30d", // Время жизни refresh токена (например, 30 дней)
            }
        );

        await Client.findByIdAndUpdate(candidate._id, {
            refreshToken: refreshToken2,
        });

        res.json({ success: true, accessToken, refreshToken: refreshToken2, clientData });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось авторизоваться",
        });
    }
};

export const updateClientDataMobile = async (req, res) => {
    try {
        const { mail, field, value } = req.body;
        console.log("updateClientDataMobile req.body: ", req.body);

        const client = await Client.findOne({ mail: mail?.toLowerCase() });
        if (!client) {
            return res
                .status(404)
                .json({ success: false, message: "Client not found" });
        }

        const updatedClient = await Client.findByIdAndUpdate(client._id, {
            [field]: value
        }, { new: true });

        const clientData = {
            _id: updatedClient._doc._id,
            fullName: updatedClient._doc.fullName,
            mail: updatedClient._doc.mail,
            avatar: updatedClient._doc.avatar,
            phone: updatedClient._doc.phone,
            notificationPushToken: updatedClient._doc.notificationPushToken,
            balance: updatedClient._doc.balance,
            price12: updatedClient._doc.price12,
            price19: updatedClient._doc.price19,
            status: updatedClient._doc.status,
            cart: updatedClient._doc.cart,
            addresses: updatedClient._doc.addresses,
            createdAt: updatedClient._doc.createdAt,
        }

        res.json({ success: true, message: "Данные успешно изменены", clientData });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(403).json({ message: "Требуется refresh токен" });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.SecretKeyRefresh);

        // Проверка, что refresh токен совпадает с хранимым в базе данных
        const candidate = await Client.findById(decoded.client._id);

        if (!candidate || candidate.refreshToken !== refreshToken) {
            return res.status(403).json({ message: "Неверный refresh токен" });
        }

        // Генерация нового access токена
        const newAccessToken = jwt.sign(
            { client: decoded.client },
            process.env.SecretKey,
            {
                expiresIn: "30d",
            }
        );

        const newRefreshToken = jwt.sign(
            { client: decoded.client },
            process.env.SecretKeyRefresh,
            {
                expiresIn: "30d",
            }
        );

        await Client.findByIdAndUpdate(decoded.client._id, {
            refreshToken: newRefreshToken,
        });

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    } catch (error) {
        return res.status(403).json({ message: "Неверный refresh токен" });
    }
};

export const logOutClient = async (req, res) => {
    const { refreshToken } = req.body;

    try {
        await Client.findOneAndDelete({ refreshToken }, { refreshToken: null });

        res.status(200).json({ message: "Вы вышли из системы" });
    } catch (error) {
        return res.status(403).json({ message: "Неверный refresh токен" });
    }
};

export const updateForgottenPassword = async (req, res) => {
    try {
        const { mail } = req.body;

        const client = await Client.findOne({ mail: mail?.toLowerCase() });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(req.body.password, salt);

        client.password = hash;

        await client.save();

        const {
            password,
            franchisee,
            addresses,
            status,
            refreshToken,
            ...clientData
        } = client._doc;

        const accessToken = jwt.sign(
            { client: clientData },
            process.env.SecretKey,
            {
                expiresIn: "15m", // Время жизни access токена (например, 15 минут)
            }
        );

        const refreshToken2 = jwt.sign(
            { client: clientData },
            process.env.SecretKeyRefresh,
            {
                expiresIn: "30d", // Время жизни refresh токена (например, 30 дней)
            }
        );

        await Client.findByIdAndUpdate(client._id, {
            refreshToken: refreshToken2,
        });

        res.json({ accessToken, refreshToken: refreshToken2 });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const addClientAddress = async (req, res) => {
    try {
        const { mail, name, city, street, house, link } = req.body;

        const client = await Client.findOne({ mail: mail?.toLowerCase() });

        const addressesLenght = client?.addresses?.length

        const address = {
            name: name !== "" ? name : `Адрес ${addressesLenght + 1}`,
            street,
            link,
            house,
        };

        client.addresses.push(address);

        await client.save();

        res.json({
            success: true,
            message: "Адресс успешно добавлен",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const updateClientAddress = async (req, res) => {
    try {
        const { mail, _id, name, street, house, link, phone } = req.body;

        console.log("updateClientAddress", req.body);
        

        // Найти клиента по email
        const client = await Client.findOne({ mail: mail?.toLowerCase() });

        if (!client) {
            return res.status(404).json({
                message: "Клиент не найден",
            });
        }

        // Найти адрес по ID и обновить его
        const addressIndex = client.addresses.findIndex(
            (addr) => addr._id.toString() === _id
        );

        if (addressIndex === -1) {
            return res.status(404).json({
                message: "Адрес не найден",
            });
        }

        // Обновить данные адреса
        client.addresses[addressIndex] = {
            ...client.addresses[addressIndex]._doc, // Сохранение других полей
            name,
            street,
            link,
            house,
            phone
        };

        // Сохранить изменения
        await client.save();

        res.json({
            success: true,
            message: "Адрес успешно обновлен",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getClientAddresses = async (req, res) => {
    try {
        const { mail } = req.body;

        const client = await Client.findOne({ mail: mail?.toLowerCase() });

        const addresses = client.addresses;

        res.json({ addresses });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const addOrderClientMobile = async (req, res) => {
    try {
        const {mail, address, products, clientNotes, date, opForm} = req.body

        const client = await Client.findOne({mail})

        if (!client) {
            return res.json(404).json({
                success: false,
                message: "Не удалось найти клиента"
            })
        }

        const franchisee = User.findOne({role: "superAdmin"})

        const sum =
            Number(products.b12) * Number(client.price12) +
            Number(products.b19) * Number(client.price19);

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`; 

        const order = new Order({
            franchisee: franchisee._id,
            client: client._id,
            address,
            products,
            date: date || {d: todayStr, time: ""},
            sum,
            clientNotes: clientNotes || [],
            opForm
        });

        await order.save();

        // const text = `Адрес: ${address?.actual}\nТелефон: ${client?.phone}\nКол. 12,5л: ${products?.b12}\nКол. 18,9л: ${products?.b19}`
        // const mailOptions = {
        //     from: "info@tibetskaya.kz",
        //     to: "araiuwa_89@mail.ru",
        //     subject: "Клиент добавил заказ через приложение",
        //     text,
        // };
    
        // transporter.sendMail(mailOptions, function (error, info) {
        //     if (error) {
        //         console.log(error);
        //         res.status(500).send("Ошибка при отправке письма");
        //     } else {
        //         console.log("Email sent: " + info.response);
        //         res.status(200).send("Письмо успешно отправлено");
        //     }
        // });

        client.bonus = client.bonus + 50
        await client.save()

        res.json({
            success: true,
            message: "Заказ успешно создан"
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Что-то пошло не так",
        });
    }
}

export const getActiveOrdersMobile = async (req, res) => {
    try {
        const {mail} = req.body;

        const client = await Client.findOne({mail});

        const orders = await Order.find({ client: client._id, status: { $in: ["awaitingOrder", "inLine", "onTheWay"] } })
            .sort({ createdAt: -1 })
            .populate("courierAggregator", "fullName _id point phone")

        if (!orders) {
            return res.status(404).json({
                success: false,
                message: "Не удалось получить заказы или её просто нет("
            })
        }

        res.json({orders})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getClientOrdersMobile = async (req, res) => {
    try {
        // const {clientId, page} = req.body

        // const limit = 5;
        // const skip = (page - 1) * limit

        // const orders = await Order.find({client: clientId})
        //     .sort({ createdAt: -1 })
        //     .skip(skip)
        //     .limit(limit);

        // if (!orders) {
        //     return res.status(404).json({
        //         success: false,
        //         message: "Хз че не так, но заказов нет("
        //     })
        // }

        const {mail} = req.body

        const client = await Client.findOne({mail})

        const orders = await Order.find({client: client._id})
            .sort({ createdAt: -1 })
            .populate("courierAggregator", "fullName _id point phone")

        console.log("orders: ", orders);

        res.json({ orders });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getCourierLocation = async (req, res) => {
    try {
        const { courierId } = req.body;
        const courierAggregator = await CourierAggregator.findById(courierId);
        res.json({ point: courierAggregator.point });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getClientDataMobile = async (req, res) => {
    try {
        const { mail } = req.body;
        const client = await Client.findOne({ mail: mail?.toLowerCase() });
        res.json({ client });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const updateAllClientAddresses = async (req, res) => {
    try {
        // Получить всех клиентов из базы данных
        const clients = await Client.find();

        // Перебрать каждого клиента
        for (const client of clients) {
            // Перебрать адреса клиента и обновить их имена
            client.addresses.forEach((address, index) => {
                address.name = `Адрес ${index + 1}`; // Установить имя как "Адрес 1", "Адрес 2" и т.д.
            });

            // Сохранить обновления для текущего клиента
            await client.save();
        }

        res.json({
            success: true,
            message: "Имена адресов успешно обновлены для всех клиентов",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Что-то пошло не так",
        });
    }
};

export const updateCart = async (req, res) => {
    try {
        const { mail, product, method } = req.body;

        const client = await Client.findOne({ mail: mail?.toLowerCase() });

        if (product === "b12") {
            if (method === "add") {
                client.cart.b12 = client.cart.b12 + 1;
            } else {
                client.cart.b12 =
                    client.cart.b12 - 1 >= 0 ? client.cart.b12 - 1 : 0;
            }
        } else {
            if (method === "add") {
                client.cart.b19 = client.cart.b19 + 1;
            } else {
                client.cart.b19 =
                    client.cart.b19 - 1 >= 0 ? client.cart.b19 - 1 : 0;
            }
        }

        await client.save();

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

export const cleanCart = async (req, res) => {
    try {
        const { mail } = req.body;

        const client = await Client.findOne({ mail: mail?.toLowerCase() });

        client.cart.b12 = 0;
        client.cart.b19 = 0;

        await client.save();

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

export const getCart = async (req, res) => {
    try {
        const { mail } = req.body;
        const client = await Client.findOne({ mail: mail?.toLowerCase() });

        const cart = client.cart;

        res.json({
            success: true,
            cart,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

const userNotifications = {};

export const addBonus = async (req, res) => {
    try {
        const { mail, count, expoPushToken } = req.body;

        const client = await Client.findOne({ mail: mail?.toLowerCase() });
        if (!client) {
            return res
                .status(404)
                .json({ success: false, message: "Client not found" });
        }

        client.bonus = client.bonus + count;
        await client.save();
        const userId = client?._id
        const expoTokens = [expoPushToken]

        const job = scheduleJob(new Date(Date.now() + 60 * 60 * 1000), async () => {
            try {
                const messageTitle = "Пора пить воду"
                const messageBody = "Не забудьте выпить стакан воды!"
                const newStatus = "bonus"
                if (expoTokens.length > 0) {
                    pushNotification(messageTitle, messageBody, expoTokens, newStatus)
                }
                delete userNotifications[userId];
            } catch (error) {
                console.error("Ошибка при отправке уведомления:", error);
            }
        });        

        userNotifications[userId] = job;

        res.json({ success: true, message: "Бонусы были добавлены" });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const expoTokenCheck = async (req, res) => {
    console.log("expoTokenCheck proverks na log");
    
    try {
      console.log("req.body: ", req.body);
  
      // Возвращаем успех после успешной отправки уведомления
      res.json({
        success: true,
      });
    } catch (error) {
      console.error("Error sending push notification:", error);
      res.status(500).json({
        success: false,
        message: "Что-то пошло не так",
        error: error.message,
      });
    }
};

export const getUnreviewedOrder = async (req, res) => {
    try {
        const {mail} = req.body

        const client = await Client.findOne({ mail: mail?.toLowerCase})
        const clientId = client._id
        const order = await Order.findOne({client: clientId, clientReview: 0, status: "delivered"})

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Хз че не так, но заказов нет("
            })
        }

        res.json({ success: true, order });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const addReview = async (req, res) => {
    try {
        const {orderId, rating, notes} = req.body

        const order = await Order.findById(orderId)

        order.clientReview = rating
        order.clientNotes = notes

        await order.save()

        res.json({success: true})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const addPassword = async (req, res) => {
    try {
        const {phone, password} = req.body
        const client = await Client.findOne({phone})
        if (!client) {
            console.log("client not found");
            res.status(403).json({
                success: false,
                message: "client not found",
                error: error.message,
            })
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(req.body.password, salt);

        client.password = hash

        await client.save()

        res.json({
            success: true
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Что-то пошло не так",
          error: error.message,
        });
      }
}
