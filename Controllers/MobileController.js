import Client from "../Models/Client.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const transporter = nodemailer.createTransport({
    host: "smtp.mail.ru",
    port: 465, // Или 587 для TLS
    secure: true,
    auth: {
        user: "kzautonex@mail.ru",
        pass: "t89KU4sbMMczanM54GWJ",
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

    const candidate = await Client.findOne({ mail });

    if (candidate) {
        return res.status(409).json({
            message: "Пользователь с такой почтой уже существует",
        });
    }

    const confirmCode = generateCode();

    codes[mail] = confirmCode;

    const mailOptions = {
        from: "kzautonex@mail.ru",
        to: mail,
        subject: "Подтвердждение электронной почты",
        text: confirmCode,
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            //console.log(error);
            res.status(500).send("Ошибка при отправке письма");
        } else {
            //console.log("Email sent: " + info.response);
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
        const { phone, mail } = req.body;

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
            mail,
        });

        const client = await doc.save();

        const token = jwt.sign(
            {
                _id: client._id,
            },
            process.env.SecretKey,
            {
                expiresIn: "30d",
            }
        );

        res.json({ token });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const clientLogin = async (req, res) => {
    try {
        const { mail, password } = req.body;

        const candidate = await Client.findOne({ mail });

        if (!candidate) {
            return res.status(404).json({
                message: "Неверный логин или пароль",
            });
        }

        const isValidPass = await bcrypt.compare(password, candidate.password);

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

        const token = jwt.sign({ _id: candidate._id }, process.env.SecretKey, {
            expiresIn: "30d",
        });

        res.json({ token });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось авторизоваться",
        });
    }
};

export const updateForgottenPassword = async (req, res) => {
    try {
        const { mail } = req.body;

        const client = await Client.findOne({ mail });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(req.body.password, salt);

        client.password = hash;

        await client.save();

        const token = jwt.sign({ _id: client._id }, process.env.SecretKey, {
            expiresIn: "30d",
        });

        res.json({ token });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось авторизоваться",
        });
    }
};

export const addClientAddress = async (req, res) => {
    try {
        const { mail, city, street, house, link } = req.body;

        const client = await Client.findOne({ mail });

        const address = {
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
            message: "Не удалось авторизоваться",
        });
    }
};

export const getClientAddresses = async (req, res) => {
    try {
        const { mail } = req.body;

        const client = await Client.findOne({ mail });

        const addresses = client.addresses;

        res.json({ addresses });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось авторизоваться",
        });
    }
};
