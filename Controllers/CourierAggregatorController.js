import CourierAggregator from "../Models/CourierAggregator.js";
import User from "../Models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const getMeAggregate = async(req, res) => {
    try {
        const id = req.userId
        const role = req.role

        console.log("we in getMeAggregate id = ", id, " role = ", role);
        

        if (role === "user") {
            const user = await User.findById(id)

            if (!user) {
                return res.json({
                    success: false,
                    message: "Не смогли найти пользователя"
                })
            }

            return res.json({
                success: true,
                userData: user
            })
        } else {
            const courier = await CourierAggregator.findById(id)

            if (!courier) {
                return res.json({
                    success: false,
                    message: "Не смогли найти курьера"
                })
            }

            return res.json({
                success: true,
                userData: courier
            })
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const aggregatorLogin = async(req, res) => {
    try {
        const {mail, password} = req.body

        const courier = await CourierAggregator.findOne({mail})

        if (!courier) {

            const user = await User.findOne({userName: mail})

            if (!user) {
                return res.status(404).json({ 
                    message: "Неверный логин или пароль",
                    success: false
                });
            }

            const isValidPass = await bcrypt.compare(password, user.password);

            if (!isValidPass) {
                return res.status(404).json({
                    message: "Неверный логин или пароль",
                    success: false
                });
            }
    
            if (user.status !== "active") {
                return res.status(404).json({
                    message: "Ваш аккаунт заблокироан, свяжитесь с вашим франчайзи",
                    success: false
                });
            }

            const token = jwt.sign({ _id: user._id, role: "user" }, process.env.SecretKey, {
                expiresIn: "30d",
            });

            const role = "user";

            return res.status(200).json({
                token, 
                role,
                userData: user,
                success: true,
                message: "Вы успешно авторизовались"
            });
        }

        const isValidPass = await bcrypt.compare(password, courier.password);

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

        const role = "courier";

        res.status(200).json({
            token, 
            role,
            userData: courier,
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
        const { mail, fullName, password, phone } = req.body;

        console.log("courierAggregatorRegister req.body = ", req.body);
        

        const candidate = await CourierAggregator.findOne({ mail });

        if (candidate) {
            return res.status(409).json({
                message: "Пользователь с таким номером уже существует",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const doc = new CourierAggregator({
            fullName,
            password: hash,
            mail,
            phone
        });

        const courier = await doc.save();

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

        console.log("we in updateCourierAggregatorData req.body = ", req.body);
        

        const courier = await CourierAggregator.findById(id)

        if (!courier) {
            return res.status(404).json({
                message: "Не получилось найти курьера",
                success: false
            });
        }

        if (changeField === "notificationPushTokensAdd") {
            const token = changeData.trim(); // Убираем пробелы
            console.log("we in if in updateCourierAggregatorData");
            
            if (!courier.notificationPushTokens.includes(token)) {
                courier.notificationPushTokens.push(token);
                await courier.save();
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
            if (courier.notificationPushTokens.includes(token)) {
                courier.notificationPushTokens = courier.notificationPushTokens.filter((t) => t !== token);
                await courier.save();
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

        courier[changeField] = changeData
        await courier.save()

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
