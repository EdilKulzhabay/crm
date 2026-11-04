import AquaMarket from "../Models/AquaMarket.js";
import AquaMarketHistory from "../Models/AquaMarketHistory.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import Order from "../Models/Order.js";
import User from "../Models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getTodayAlmaty } from "../utils/dateUtils.js";
import { parseAlmatyDayRange } from "../utils/almatyDateRange.js";

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
            { $group: {
                _id: "$aquaMarket",
                count: { $sum: 1 },
                b12: { $sum: "$bottles.b12" },
                b19: { $sum: "$bottles.b19" }
            } }
        ])
        const givingCountByAquaMarket = givingCounts.reduce((acc, item) => {
            acc[item._id.toString()] = {
                count: item.count,
                b12: item.b12 || 0,
                b19: item.b19 || 0
            }
            return acc
        }, {})

        const aquaMarketsWithGivingCount = aquaMarkets.map((aquaMarket) => {
            const giving = givingCountByAquaMarket[aquaMarket._id.toString()]
            return {
                ...aquaMarket.toObject(),
                givingCount: giving?.count || 0,
                givenBottlesToday: { b12: giving?.b12 || 0, b19: giving?.b19 || 0 }
            }
        })

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

        // Бутыли отданы/приняты у этого курьера — убираем ВСЕ остановки "аквамаркет" на этот
        // aquaMarketId из его очереди (не только первую по индексу — если курьера по ошибке
        // отправляли в один и тот же аквамаркет несколько раз, дубликаты не должны оставаться висеть).
        const isMatchingAquaMarketStop = (o) =>
            o.stopType === "aquaMarket" && String(o.aquaMarketId) === String(aquaMarketId)

        const hadMatchingStop = courierAggregator.orders.some(isMatchingAquaMarketStop)

        if (hadMatchingStop) {
            const wasActiveStopRemoved = isMatchingAquaMarketStop(courierAggregator.orders[0])
            const remainingOrders = courierAggregator.orders.filter((o) => !isMatchingAquaMarketStop(o))
            const nextStop = remainingOrders.length > 0 ? remainingOrders[0] : null

            const stopUpdateOps = {
                $pull: { orders: { stopType: "aquaMarket", aquaMarketId: aquaMarketId } }
            }
            if (wasActiveStopRemoved) {
                stopUpdateOps.$set = { order: nextStop }
                if (nextStop && nextStop.stopType !== "aquaMarket" && nextStop.orderId) {
                    await Order.updateOne({ _id: nextStop.orderId }, { $set: { status: "onTheWay" } })
                }
            }

            const pullResult = await CourierAggregator.updateOne({ _id: courierAggregatorId }, stopUpdateOps)
            if (pullResult.modifiedCount === 0) {
                console.log(`[aquaMarketAction] courier=${courierAggregatorId} aquaMarket=${aquaMarketId}: остановка была найдена в снимке очереди, но updateOne ничего не изменил (modifiedCount=0) — вероятна гонка с параллельным изменением очереди этого курьера`)
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

/** Курьер выносит полные (giving) и сдаёт пустые — при выдаче или отдельной приёмкой (receiving) */
const GIVING_ANALYTICS_ACTIONS = ["giving", "receiving"];

const sumIfAction = (action, field) => ({
    $sum: { $cond: [{ $eq: ["$actionType", action] }, { $ifNull: [field, 0] }, 0] },
});

/**
 * Агрегация выдачи бутылей курьерам: одна строка на пару «аквамаркет + курьер».
 * @param {{ start: Date, end: Date }} range
 */
export function buildAquaMarketGivingPipeline({ start, end }) {
    return [
        {
            $match: {
                actionType: { $in: GIVING_ANALYTICS_ACTIONS },
                createdAt: { $gte: start, $lte: end },
            },
        },
        {
            $group: {
                _id: { aquaMarket: "$aquaMarket", courier: "$courierAggregator" },
                givingCount: { $sum: { $cond: [{ $eq: ["$actionType", "giving"] }, 1, 0] } },
                fullB12: sumIfAction("giving", "$bottles.b12"),
                fullB19: sumIfAction("giving", "$bottles.b19"),
                emptyFromGivingB12: sumIfAction("giving", "$emptyBottles.b12"),
                emptyFromGivingB19: sumIfAction("giving", "$emptyBottles.b19"),
                emptyFromReceivingB12: sumIfAction("receiving", "$bottles.b12"),
                emptyFromReceivingB19: sumIfAction("receiving", "$bottles.b19"),
            },
        },
        { $lookup: { from: "aquamarkets", localField: "_id.aquaMarket", foreignField: "_id", as: "aquaMarket" } },
        { $lookup: { from: "courieraggregators", localField: "_id.courier", foreignField: "_id", as: "courier" } },
        {
            $project: {
                _id: 0,
                aquaMarketId: "$_id.aquaMarket",
                aquaMarketAddress: { $arrayElemAt: ["$aquaMarket.address", 0] },
                courierId: "$_id.courier",
                courierName: { $arrayElemAt: ["$courier.fullName", 0] },
                givingCount: 1,
                full: { b12: "$fullB12", b19: "$fullB19" },
                empty: {
                    b12: { $add: ["$emptyFromGivingB12", "$emptyFromReceivingB12"] },
                    b19: { $add: ["$emptyFromGivingB19", "$emptyFromReceivingB19"] },
                },
            },
        },
    ];
}

const emptyTotals = () => ({ givingCount: 0, full: { b12: 0, b19: 0 }, empty: { b12: 0, b19: 0 } });

const addTotals = (acc, row) => ({
    givingCount: acc.givingCount + row.givingCount,
    full: { b12: acc.full.b12 + row.full.b12, b19: acc.full.b19 + row.full.b19 },
    empty: { b12: acc.empty.b12 + row.empty.b12, b19: acc.empty.b19 + row.empty.b19 },
});

/**
 * Сворачивает строки «аквамаркет + курьер» в список аквамаркетов с разбивкой по курьерам.
 * Аквамаркеты и курьеры — по убыванию вывезенных полных бутылей.
 */
export function summarizeAquaMarketGiving(rows) {
    const byMarket = new Map();
    for (const row of rows) {
        const key = String(row.aquaMarketId);
        const market = byMarket.get(key) || {
            aquaMarketId: row.aquaMarketId,
            address: row.aquaMarketAddress || "Аквамаркет удалён",
            totals: emptyTotals(),
            couriers: [],
        };
        const courier = {
            courierId: row.courierId,
            courierName: row.courierName || (row.courierId ? "Курьер удалён" : "Без курьера"),
            givingCount: row.givingCount,
            full: row.full,
            empty: row.empty,
        };
        byMarket.set(key, {
            ...market,
            totals: addTotals(market.totals, row),
            couriers: [...market.couriers, courier],
        });
    }

    const fullTotal = (item) => item.full.b12 + item.full.b19;
    const aquaMarkets = [...byMarket.values()]
        .map((m) => ({ ...m, couriers: [...m.couriers].sort((a, b) => fullTotal(b) - fullTotal(a)) }))
        .sort((a, b) => fullTotal(b.totals) - fullTotal(a.totals));

    return { aquaMarkets, totals: rows.reduce(addTotals, emptyTotals()) };
}

/**
 * POST /getAquaMarketGivingAnalytics { startDate, endDate } — дни Алматы ГГГГ-ММ-ДД, только суперадмин.
 */
export const getAquaMarketGivingAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.body || {};
        const range = parseAlmatyDayRange(startDate, endDate);
        if (!range) {
            return res.status(400).json({
                success: false,
                message: "Укажите период в формате ГГГГ-ММ-ДД (начало не позже конца)",
            });
        }

        const rows = await AquaMarketHistory.aggregate(buildAquaMarketGivingPipeline(range));
        return res.json({ success: true, ...summarizeAquaMarketGiving(rows) });
    } catch (error) {
        console.error("[getAquaMarketGivingAnalytics]", error?.message || error);
        return res.status(500).json({ success: false, message: "Ошибка на стороне сервера" });
    }
};
