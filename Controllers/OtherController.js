import User from "../Models/User.js";
import Courier from "../Models/Courier.js";

export const getAllUsersNCouriers = async (req, res) => {
    try {
        const users = await User.find();

        if (!users) {
            res.status(409).json({
                message: "Не удалось получить пользователей",
            });
        }

        const couriers = await Courier.find();

        if (!couriers) {
            res.status(409).json({
                message: "Не удалось получить курьеров",
            });
        }

        res.json([...users, ...couriers]);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const id = req.userId;

        const user = await User.findById(id);

        if (user.role !== "superAdmin") {
            res.json({
                success: false,
                message: "Не достаточно прав",
            });
        }

        const { userId } = req.body;

        const delRes = await User.findByIdAndDelete(userId);

        if (!delRes) {
            return res.json({
                success: false,
                message: "Не удалось удалить пользователя",
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

export const deleteCourier = async (req, res) => {
    try {
        const id = req.userId;

        const user = await User.findById(id);

        if (user.role !== "superAdmin") {
            res.json({
                success: false,
                message: "Не достаточно прав",
            });
        }

        const { userId } = req.body;

        const delRes = await Courier.findByIdAndDelete(userId);

        if (!delRes) {
            return res.json({
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
