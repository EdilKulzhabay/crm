import CourierAggregator from "../Models/CourierAggregator.js";
import User from "../Models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const aggregatorLogin = async(req, res) => {
    try {
        const {mail, password} = req.body

        console.log("aggregatorLogin req.body = ", req.body);
        

        const courier = await CourierAggregator.findOne({mail})

        if (courier) {
            console.log("courier = ", courier);
            
        }

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

            const token = jwt.sign({ _id: user._id }, process.env.SecretKey, {
                expiresIn: "30d",
            });

            const role = "user";

            return res.status(200).json({
                token, 
                role,
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

        if (courier.status !== "active") {
            return res.status(404).json({
                message: "Ваш аккаунт заблокироан, свяжитесь с вашим франчайзи",
                success: false
            });
        }

        const token = jwt.sign({ _id: courier._id }, process.env.SecretKey, {
            expiresIn: "30d",
        });

        const role = "courier";

        res.status(200).json({
            token, 
            role,
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