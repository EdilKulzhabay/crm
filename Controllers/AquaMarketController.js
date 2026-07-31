import AquaMarket from "../Models/AquaMarket.js";
import AquaMarketHistory from "../Models/AquaMarketHistory.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import Order from "../Models/Order.js";
import User from "../Models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getTodayAlmaty } from "../utils/dateUtils.js";

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

        const aquaMarkets = await AquaMarket.find(filter).populate("franchisee", "fullName")

        const todayAlmaty = getTodayAlmaty()
        const startOfTodayAlmaty = new Date(`${todayAlmaty}T00:00:00.000+05:00`)
        const endOfTodayAlmaty = new Date(`${todayAlmaty}T23:59:59.999+05:00`)

        const givingCounts = await AquaMarketHistory.aggregate([
            { $match: {
                actionType: "giving",
                createdAt: { $gte: startOfTodayAlmaty, $lte: endOfTodayAlmaty }
            } },
            { $group: { _id: "$aquaMarket", count: { $sum: 1 } } }
        ])
        const givingCountByAquaMarket = givingCounts.reduce((acc, item) => {
            acc[item._id.toString()] = item.count
            return acc
        }, {})

        const aquaMarketsWithGivingCount = aquaMarkets.map((aquaMarket) => ({
            ...aquaMarket.toObject(),
            givingCount: givingCountByAquaMarket[aquaMarket._id.toString()] || 0
        }))

        res.json({
            success: true,
            aquaMarkets: aquaMarketsWithGivingCount
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
        const aquaMarket = await AquaMarket.findById(aquaMarketId).populate("franchisee", "fullName")

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
            const updateRes = await AquaMarket.updateOne({_id: aquaMarketId}, { $set: { password: hash } })
            if (updateRes.modifiedCount > 0) {
                return res.json({
                    success: true,
                    message: "Аквамаркет успешно обновлен"
                })
            }
            return res.json({
                success: false,
                message: "Не удалось обновить аквамаркет"
            })
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

            const b12taken = Number(bottles.b12) || 0
            const b19taken = Number(bottles.b19) || 0

            const queueUpdate = {
                $inc: {
                    capacity12: b12taken,
                    capacity19: b19taken
                }
            }
            if (b12taken > 0 || b19taken > 0) {
                queueUpdate.$push = {
                    bottleQueue: {
                        aquaMarketId: aquaMarket._id,
                        franchiseeId: aquaMarket.franchisee,
                        b12: b12taken,
                        b19: b19taken
                    }
                }
            }
            console.log(`[aquaMarketAction] giving: courier=${courierAggregatorId} took from aquaMarket=${aquaMarketId} b12=${b12taken} b19=${b19taken} -> pushed to bottleQueue`)
            await CourierAggregator.updateOne({_id: courierAggregatorId}, queueUpdate)
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

        // Бутыли отданы/приняты у этого курьера — убираем соответствующую остановку "аквамаркет" из его очереди.
        const stopIndex = courierAggregator.orders.findIndex(
            (o) => o.stopType === "aquaMarket" && String(o.aquaMarketId) === String(aquaMarketId)
        )

        if (stopIndex !== -1) {
            const removedStop = courierAggregator.orders[stopIndex]
            const isActiveStop = stopIndex === 0
            const nextStop = courierAggregator.orders.length > 1 ? courierAggregator.orders[1] : null

            const stopUpdateOps = { $pull: { orders: { _id: removedStop._id } } }
            if (isActiveStop) {
                stopUpdateOps.$set = { order: nextStop }
                if (nextStop && nextStop.stopType !== "aquaMarket" && nextStop.orderId) {
                    await Order.updateOne({ _id: nextStop.orderId }, { $set: { status: "onTheWay" } })
                }
            }

            const pullResult = await CourierAggregator.updateOne({ _id: courierAggregatorId }, stopUpdateOps)
            if (pullResult.modifiedCount === 0) {
                console.log(`[aquaMarketAction] courier=${courierAggregatorId} aquaMarket=${aquaMarketId}: остановка была найдена в снимке очереди (stopIndex=${stopIndex}), но updateOne ничего не изменил (modifiedCount=0) — вероятна гонка с параллельным изменением очереди этого курьера`)
            }
        } else {
            console.log(`[aquaMarketAction] courier=${courierAggregatorId} aquaMarket=${aquaMarketId}: в очереди курьера не найдена остановка stopType="aquaMarket" с этим aquaMarketId — удалять нечего (курьер выбран без постановки в очередь на этот аквамаркет, либо очередь уже была очищена ранее)`)
        }

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

export const getAquaMarketPickupPayments = async (req, res) => {
    try {
        const { startDate, endDate } = req.body

        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);

        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);

        const payments = await AquaMarketHistory.find({
            actionType: "pickup",
            createdAt: { $gte: sDate, $lte: eDate }
        })
        .populate("aquaMarket", "address")
        .sort({ createdAt: -1 })

        const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const cashAmount = payments.filter(p => p.paymentType === "cash").reduce((sum, p) => sum + (p.amount || 0), 0);
        const kaspiAmount = payments.filter(p => p.paymentType === "kaspi").reduce((sum, p) => sum + (p.amount || 0), 0);

        res.json({ success: true, payments, totalAmount, cashAmount, kaspiAmount })
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Ошибка на стороне сервера" })
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