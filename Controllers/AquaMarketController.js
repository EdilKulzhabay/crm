import AquaMarket from "../Models/AquaMarket.js";
import User from "../Models/User.js";

export const addAquaMarket = async (req, res) => {
    try {
        const {franchisee, point, address} = req.body

        const aquaMarket = new AquaMarket({
            franchisee,
            point,
            address
        })

        await aquaMarket.save()

        res.json({
            success: true,
            message: "Аквамаркет успешно добавлен"
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}


export const updateUserData = async (req, res) => {
    try {
        const {id, changeField, changeData} = req.body

        const user = await User.findById(id)

        if (!user) {
            return res.json({
                success: false,
                message: "Не получилось найти франчайзи"
            })
        }

        if (changeField === "notificationPushTokensAdd") {
            const token = changeData.trim(); // Убираем пробелы
            if (!user.notificationPushTokens.includes(token)) {
                user.notificationPushTokens.push(token);
                await user.save();
                return res.json({
                    success: true,
                    message: "Токен успешно добавлен"
                });
            } else {
                return res.json({
                    success: false,
                    message: "Токен уже существует"
                });
            }
        }

        if (changeField === "notificationPushTokensDelete") {
            const token = changeData.trim();
            if (user.notificationPushTokens.includes(token)) {
                user.notificationPushTokens = user.notificationPushTokens.filter((t) => t !== token);
                await user.save();
                return res.json({
                    success: true,
                    message: "Токен успешно удален"
                });
            } else {
                return res.json({
                    success: false,
                    message: "Токен не найден"
                });
            }
        }

        user[changeField] = changeData

        await user.save()

        res.json({
            success: true,
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