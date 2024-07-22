import Courier from "../Models/Courier.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../Models/User.js";

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

        const courier = await Courier.findById(id);

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
