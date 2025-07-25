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

    for (let i = 0; i < 4; i++) {
        randomPart += characters.charAt(
            Math.floor(Math.random() * characters.length)
        );
    }

    return randomPart;
};

const codes = {};

export const sendMail = async (req, res) => {
    const { mail } = req.body;

    const candidate = await Client.findOne({ mail: mail?.toLowerCase() });

    if (candidate) {
        return res.status(409).json({
            message: "Пользователь с такой почтой уже существует",
        });
    }

    const confirmCode = generateCode();

    codes[mail] = confirmCode;

    const mailOptions = {
        from: "info@tibetskaya.kz",
        to: mail,
        subject: "Подтвердждение электронной почты",
        text: confirmCode,
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
            res.status(500).send("Ошибка при отправке письма");
        } else {
            console.log("Email sent: " + info.response);
            res.status(200).send("Письмо успешно отправлено");
        }
    });
};

export const sendMailRecovery = async (req, res) => {
    const { mail } = req.body;

    // Проверка наличия кандидата
    const candidate = await Client.findOne({ mail: mail?.toLowerCase() });

    if (!candidate) {
        // Возвращаем ответ, если кандидат не найден
        return res.status(404).json({
            message: "Пользователь с такой почтой не существует",
        });
    }

    // Генерация кода подтверждения
    const confirmCode = generateCode();

    // Сохранение кода подтверждения
    codes[mail] = confirmCode;

    const mailOptions = {
        from: "info@tibetskaya.kz",
        to: mail,
        subject: "Подтвердждение электронной почты",
        text: confirmCode,
    };

    // Отправка письма
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
            res.status(500).send("Ошибка при отправке письма");
        } else {
            console.log("Email sent: " + info.response);
            res.status(200).send("Письмо успешно отправлено");
        }
    });
};

export const codeConfirm = async (req, res) => {
    try {
        const { mail, code } = req.body;
        if (codes[mail] === code) {
            delete codes[mail]; // Удаляем код после успешного подтверждения
            res.status(200).send("Код успешно подтвержден");
        } else {
            res.status(400).send("Неверный код");
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const clientRegister = async (req, res) => {
    try {
        const { phone, mail, type } = req.body;

        const user = await User.findOne({role: "superAdmin"})
        const superAdminId = user._id
        const candidate = await Client.findOne({ phone });

        if (candidate) {
            return res.status(409).json({
                message: "Пользователь с таким номером уже существует",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(req.body.password, salt);

        const doc = new Client({
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
            type
        });

        const client = await doc.save();

        const accessToken = jwt.sign(
            { client: client },
            process.env.SecretKey,
            {
                expiresIn: "30d", // Время жизни access токена (например, 15 минут)
            }
        );

        const refreshToken = jwt.sign(
            { client: client },
            process.env.SecretKeyRefresh,
            {
                expiresIn: "30d", // Время жизни refresh токена (например, 30 дней)
            }
        );

        await Client.findByIdAndUpdate(client._id, {
            refreshToken: refreshToken,
        });

        res.json({ accessToken, refreshToken: refreshToken });
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

        const candidate = await Client.findOne({ mail: mail?.toLowerCase() });

        if (!candidate) {
            return res.status(404).json({
                message: "Неверный логин или пароль",
            });
        }

        const isValidPass = await bcrypt.compare(
            req.body.password,
            candidate.password
        );

        if (!isValidPass) {
            return res.status(404).json({
                message: "Неверный логин или пароль",
            });
        }

        if (candidate.status !== "active") {
            return res.status(404).json({
                message: "Ваш аккаунт заблокироан, свяжитесь с вашим франчайзи",
            });
        }

        const {
            password,
            franchisee,
            addresses,
            status,
            refreshToken,
            ...clientData
        } = candidate._doc;

        const accessToken = jwt.sign(
            { client: clientData },
            process.env.SecretKey,
            {
                expiresIn: "30d", // Время жизни access токена (например, 15 минут)
            }
        );

        const refreshToken2 = jwt.sign(
            { client: clientData },
            process.env.SecretKeyRefresh,
            {
                expiresIn: "30d", // Время жизни refresh токена (например, 30 дней)
            }
        );

        await Client.findByIdAndUpdate(candidate._id, {
            refreshToken: refreshToken2,
        });

        res.json({ accessToken, refreshToken: refreshToken2 });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось авторизоваться",
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

export const getClientDataMobile = async (req, res) => {
    try {
        const { mail } = req.body;
        const client = await Client.findOne({ mail: mail?.toLowerCase() });

        const { refreshToken, ...clientData } = client;

        res.json({
            success: true,
            clientData,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const updateClientDataMobile = async (req, res) => {
    try {
        const { mail, field, value } = req.body;

        const client = await Client.findOne({ mail: mail?.toLowerCase() });
        if (!client) {
            return res
                .status(404)
                .json({ success: false, message: "Client not found" });
        }

        if (field === "expoPushToken") {
            // Добавить элемент в массив, если его еще нет
            if (!client.expoPushToken.includes(value)) {
                client.expoPushToken.push(value);
            }
        } else if (field === "expoPushTokenDel") {
            console.log("expoPushTokenDel value = ", value);
            console.log(client.expoPushToken);
            
            
            client.expoPushToken = client.expoPushToken.filter(
                (token) => token !== value
            );

            console.log(client.expoPushToken);
        } else {
            // Обновить любое другое поле
            client[field] = value;
        }

        await client.save();

        res.json({ success: true, message: "Данные успешно изменены" });
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

export const addOrderClientMobile = async (req, res) => {
    try {
        const {clientId, address, products, clientNotes, date, opForm} = req.body

        const client = await Client.findById(clientId)

        if (!client) {
            return res.json(404).json({
                success: false,
                message: "Не удалось найти клиента"
            })
        }

        const franchiseeId = client.franchisee || ""; 

        const sum =
            Number(products.b12) * Number(client.price12) +
            Number(products.b19) * Number(client.price19);

        let order

        if (franchiseeId !== "") {
            order = new Order({
                franchisee: franchiseeId,
                client: clientId,
                address,
                products,
                date: date || {d: "", time: ""},
                sum,
                clientNotes: clientNotes || [],
                opForm
            });
    
            await order.save();
        } else {
            order = new Order({
                client: clientId,
                address,
                products,
                date: date || {d: "", time: ""},
                sum,
                clientNotes: clientNotes || [],
                opForm
            });
    
            await order.save();
        }

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

        setImmediate(async () => {
            const orderId = order?._id
            try {
            //   await getLocationsLogicQueue(orderId);
              console.log("Обновленные локации после заказа:");
            } catch (error) {
              console.error("Ошибка при получении локаций:", error);
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getLastOrderMobile = async (req, res) => {
    try {
        const {clientId} = req.body;

        const order = await Order.findOne({ client: clientId }).sort({ createdAt: -1 });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Не удалось получить заказ или её просто нет("
            })
        }

        res.json({order})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getClientHistoryMobile = async (req, res) => {
    try {
        const {clientId, page} = req.body

        const limit = 5;
        const skip = (page - 1) * limit

        const orders = await Order.find({client: clientId})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        if (!orders) {
            return res.status(404).json({
                success: false,
                message: "Хз че не так, но заказов нет("
            })
        }

        res.json({ orders });
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
