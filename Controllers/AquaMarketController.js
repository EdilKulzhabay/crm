import AquaMarket from "../Models/AquaMarket.js";
import AquaMarketHistory from "../Models/AquaMarketHistory.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import User from "../Models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const addAquaMarket = async (req, res) => {
    try {
        const {franchisee, point, address, link, userName, password} = req.body
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const aquaMarket = new AquaMarket({
            franchisee,
            point,
            address,
            link,
            userName,
            password: hash
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

export const getAquaMarkets = async (req, res) => {
    try {
        const { franchiseeId } = req.body

        const user = await User.findById(franchiseeId)

        const filter = {}

        if (user.role === "admin") {
            filter.franchisee = user._id
        }

        const aquaMarkets = await AquaMarket.find(filter)

        res.json({
            success: true,
            aquaMarkets
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const getAquaMarketData = async (req, res) => {
    try {
        const { aquaMarketId } = req.body
        console.log(req.body)
        const aquaMarket = await AquaMarket.findById(aquaMarketId)

        res.json({
            success: true,
            aquaMarket
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const updateAquaMarketData = async (req, res) => {
    try {
        const { aquaMarketId, changeField, changeData } = req.body

        const aquaMarket = await AquaMarket.findById(aquaMarketId)

        if (!aquaMarket) {
            return res.json({
                success: false,
                message: "Аквамаркет не найден"
            })
        }

        if (changeField === "password") {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(changeData, salt);
            changeData = hash;
        }

        const updateResult = await AquaMarket.updateOne({_id: aquaMarketId}, { $set: {
            [changeField]: changeData
        } })

        if (updateResult.modifiedCount > 0) {
            return res.json({
                success: true,
                message: "Аквамаркет успешно обновлен"
            })
        }

        return res.json({
            success: false,
            message: "Не удалось обновить аквамаркет"
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const deleteAquaMarket = async (req, res) => {
    try {
        const { aquaMarketId } = req.body

        const aquaMarket = await AquaMarket.findById(aquaMarketId)

        if (!aquaMarket) {
            return res.json({
                success: false,
                message: "Аквамаркет не найден"
            })
        }

        const deleteResult = await AquaMarket.deleteOne({_id: aquaMarketId})

        if (deleteResult.deletedCount > 0) {
            return res.json({
                success: true,
                message: "Аквамаркет успешно удален"
            })
        }

        return res.json({
            success: false,
            message: "Не удалось удалить аквамаркет"
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const getAquaMarketHistory = async (req, res) => {
    try {
        const { aquaMarketId, startDate, endDate } = req.body

        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);

        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);

        const aquaMarketHistory = await AquaMarketHistory.find({aquaMarket: aquaMarketId, createdAt: {
            $gte: sDate,
            $lte: eDate
        }})
        .populate("aquaMarket")
        .populate("courierAggregator")

        res.json({
            success: true,
            aquaMarketHistory
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const aquaMarketAction = async (req, res) => {
    try {
        const { aquaMarketId, actionType, bottles, courierAggregatorId } = req.body

        const aquaMarket = await AquaMarket.findById(aquaMarketId)

        if (!aquaMarket) {
            return res.json({
                success: false,
                message: "Аквамаркет не найден"
            })
        }

        const courierAggregator = await CourierAggregator.findById(courierAggregatorId)

        if (!courierAggregator) {
            return res.json({
                success: false,
                message: "Курьер не найден"
            })
        }

        if (actionType === "giving") {
            await AquaMarket.updateOne({_id: aquaMarketId}, { $set: {
                full: {
                    b12: aquaMarket.full.b12 - Number(bottles.b12),
                    b19: aquaMarket.full.b19 - Number(bottles.b19)
                }
            } })
            await CourierAggregator.updateOne({_id: courierAggregatorId}, { $set: {
                capacity12: courierAggregator.capacity12 + Number(bottles.b12),
                capacity19: courierAggregator.capacity19 + Number(bottles.b19)
            } })
        } else {
            await AquaMarket.updateOne({_id: aquaMarketId}, { $set: {
                empty: {
                    b12: aquaMarket.empty.b12 + Number(bottles.b12),
                    b19: aquaMarket.empty.b19 + Number(bottles.b19)
                }
            } })
        }

        const history = new AquaMarketHistory({
            aquaMarket: aquaMarket._id,
            actionType,
            bottles,
            courierAggregator: courierAggregator._id
        })

        await history.save()

        res.json({
            success: true,
            message: "Действие успешно выполнено"
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}

export const aquaMarketFill = async (req, res) => {
    try {
        const { aquaMarketId, bottles } = req.body
        console.log(req.body)

        const aquaMarket = await AquaMarket.findById(aquaMarketId)

        if (!aquaMarket) {
            return res.json({
                success: false,
                message: "Аквамаркет не найден"
            })
        }

        const fullBottles = {
            b12: Number(bottles.b12) + Number(aquaMarket.full.b12),
            b19: Number(bottles.b19) + Number(aquaMarket.full.b19)
        }

        const aquaMarketUpdateRes = await AquaMarket.updateOne({_id: aquaMarketId}, { $set: { full: fullBottles } })

        const history = new AquaMarketHistory({
            aquaMarket: aquaMarket._id,
            actionType: "fill",
            bottles: bottles,
            courierAggregator: null
        })

        await history.save()

        if (aquaMarketUpdateRes.modifiedCount > 0) {
            return res.json({
                success: true,
                message: "Аквамаркет успешно заполнен"
            })
        } else {
            return res.json({
                success: false,
                message: "Не удалось заполнить аквамаркет"
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

export const aquaMarketLogin = async (req, res) => {
    try {
        const { userName, password } = req.body

        const aquaMarket = await AquaMarket.findOne({userName})

        if (!aquaMarket) {
            return res.status(404).json({
                success: false,
                message: "Неверный логин или пароль"
            })
        }

        const isValidPass = await bcrypt.compare(password, aquaMarket.password);

        if (!isValidPass) {
            return res.status(404).json({
                success: false,
                message: "Неверный логин или пароль"
            })
        }

        const token = jwt.sign({ _id: aquaMarket._id, role: "aquaMarket" }, process.env.SecretKey, {
            expiresIn: "30d",
        });

        const aquaMarketData = {
            _id: aquaMarket._id,
            userName: aquaMarket.userName,
            franchisee: aquaMarket.franchisee,
            point: aquaMarket.point,
            address: aquaMarket.address,
            link: aquaMarket.link,
            empty: aquaMarket.empty,
            full: aquaMarket.full,
            booked: aquaMarket.booked,
            dispensedBottlesKol: aquaMarket.dispensedBottlesKol,
        }

        res.json({
            success: true,
            message: "Аквамаркет успешно вышел",
            token,
            aquaMarketData
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Ошибка на стороне сервера"
        })
    }
}