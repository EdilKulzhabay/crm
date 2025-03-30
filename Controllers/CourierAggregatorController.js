import CourierAggregator from "../Models/CourierAggregator.js";
import Order from "../Models/Order.js";
import User from "../Models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import distributionOrdersToFreeCourier from "../utils/distributionOrdersToFreeCourier.js";
import distributionUrgentOrder from "../utils/distributionUrgentOrder.js";
import getLocationsLogicQueue from "../utils/getLocationsLogicQueue.js";

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
                userData: user,
                role: "user"
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
                userData: courier,
                role: "courier"
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
        console.log("aggregatorLogin req.body = ", req.body);
        

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

        if (changeField === "onTheLine" && changeData) {
            await distributionOrdersToFreeCourier(courier._id)
        }

        if (changeField === "onTheLine" && !changeData && courier.orders.length > 0) {
            const orderIds = courier.orders.map(item => item.orderId);
            const orders = await Order.find({ _id: { $in: orderIds } }).sort({ createdAt: 1 })
            courier.orders = []
            await courier.save()
            for (const order of orders) {
                await getLocationsLogicQueue(order._id);
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

export const completeOrderCourierAggregator = async (req, res) => {
    try {
        const {orderId, courierId, b12, b19, opForm} = req.body

        const order = await Order.findById(orderId).populate("client")

        order.status = "delivered"
        order.products.b12 = b12
        order.products.b19 = b19
        order.opForm = opForm
        order.sum = order.client.price12 * b12 + order.client.price19 * price19 || order.sum
        order.courier = courierId

        await order.save()

        const courier = await CourierAggregator.findById(courierId)

        courier.orders.shift();
        courier.balance = courier.balance + b12 * 300 + b19 * 400

        await courier.save();

        res.json({
            success: true,
            message: "Заказ завершен"
        })

        if (courier.orders.length === 0) {
            await distributionOrdersToFreeCourier(courierId)
        } else {
            let nextOrder = await Order.findById(courier.orders[0].orderId)
            await pushNotification(
                "Новый заказ",
                `${order?.products?.b19} бутылей. Забрать из аквамаркета: ${courier.orders[0].aquaMarketAddress}`,
                courier.notificationPushTokens,
                "new Order",
                courier.orders[0].orderId
            );
            await new Promise(resolve => setTimeout(resolve, 60000));
            nextOrder = await Order.findById(courier.orders[0].orderId)
            if (nextOrder.status !== "onTheWay") {
                await distributionUrgentOrder(courier.orders[0].orderId)
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
