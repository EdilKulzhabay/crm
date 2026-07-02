import User from "../Models/User.js";
import AquaMarket from "../Models/AquaMarket.js";
import AquaMarketHistory from "../Models/AquaMarketHistory.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import ApiPayInvoice from "../Models/ApiPayInvoice.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createQrInvoice as apipayCreateQrInvoice, getInvoice as apipayGetInvoice } from "../utils/apipay.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const verifyFranchiseeToken = async (req) => {
    const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");
    if (!token) throw Object.assign(new Error("Нет токена"), { statusCode: 403 });
    const decoded = jwt.verify(token, process.env.SecretKey);
    const user = await User.findById(decoded._id).select("-password");
    if (!user) throw Object.assign(new Error("Пользователь не найден"), { statusCode: 404 });
    return user;
};

const verifyAquaMarketToken = async (req) => {
    const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");
    if (!token) throw Object.assign(new Error("Нет токена"), { statusCode: 403 });
    const decoded = jwt.verify(token, process.env.SecretKey);
    const aquaMarket = await AquaMarket.findById(decoded._id).select("-password");
    if (!aquaMarket) throw Object.assign(new Error("Аквамаркет не найден"), { statusCode: 404 });
    return aquaMarket;
};

// Убирает из FIFO-очереди курьера полные бутыли, ранее выданные ИМЕННО этим аквамаркетом
// (если курьер возвращает их обратно тому же аквамаркету — они не были и не будут реализованы).
const refundBottleQueueForMarket = (queue, aquaMarketId, refundB12, refundB19) => {
    let remainB12 = refundB12;
    let remainB19 = refundB19;

    const workQueue = (queue || []).map(e => ({
        aquaMarketId: e.aquaMarketId,
        franchiseeId: e.franchiseeId,
        b12: Number(e.b12) || 0,
        b19: Number(e.b19) || 0,
    }));

    for (const entry of workQueue) {
        if (remainB12 <= 0 && remainB19 <= 0) break;
        if (String(entry.aquaMarketId) !== String(aquaMarketId)) continue;

        const take12 = Math.min(remainB12, entry.b12);
        const take19 = Math.min(remainB19, entry.b19);
        entry.b12 -= take12;
        entry.b19 -= take19;
        remainB12 -= take12;
        remainB19 -= take19;
    }

    return {
        newQueue: workQueue.filter(e => e.b12 > 0 || e.b19 > 0),
        unmatchedB12: remainB12,
        unmatchedB19: remainB19,
    };
};

// ─── Franchisee ──────────────────────────────────────────────────────────────

export const franchiseeLogin = async (req, res) => {
    try {
        const { mail, password } = req.body;
        const candidate = await User.findOne({ mail });
        if (!candidate) return res.status(400).json({ success: false, message: "Неверный логин или пароль" });
        const isValidPass = await bcrypt.compare(password, candidate.password);
        if (!isValidPass) return res.status(400).json({ success: false, message: "Неверный логин или пароль" });
        if (candidate.status !== "active") return res.status(403).json({ success: false, message: "Аккаунт заблокирован" });
        const token = jwt.sign({ _id: candidate._id }, process.env.SecretKey, { expiresIn: "30d" });
        const { password: _, ...userData } = candidate.toObject();
        return res.json({ success: true, token, userData });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};

export const getFranchiseeData = async (req, res) => {
    try {
        const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");
        if (!token) return res.status(403).json({ success: false, message: "Нет доступа" });
        const decoded = jwt.verify(token, process.env.SecretKey);
        const user = await User.findById(decoded._id).select("-password");
        if (!user) return res.status(404).json({ success: false, message: "Пользователь не найден" });
        return res.json({ success: true, userData: user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};

// ─── AquaMarket Auth ─────────────────────────────────────────────────────────

export const aquaMarketLogin = async (req, res) => {
    try {
        const { userName, password } = req.body;
        const candidate = await AquaMarket.findOne({ userName });
        if (!candidate) return res.status(400).json({ success: false, message: "Неверный логин или пароль" });
        const isValidPass = await bcrypt.compare(password, candidate.password);
        if (!isValidPass) return res.status(400).json({ success: false, message: "Неверный логин или пароль" });
        const token = jwt.sign({ _id: candidate._id }, process.env.SecretKey, { expiresIn: "30d" });
        const { password: _, ...userData } = candidate.toObject();
        return res.json({ success: true, token, userData });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};

export const getAquaMarketData = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        console.log("[getAquaMarketData] header:", authHeader);
        const token = (authHeader || "").replace(/Bearer\s?/, "");
        if (!token) return res.status(403).json({ success: false, message: "Нет доступа" });
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.SecretKey);
        } catch (jwtErr) {
            console.error("[getAquaMarketData] JWT verify error:", jwtErr.message);
            return res.status(403).json({ success: false, message: "Неверный токен" });
        }
        console.log("[getAquaMarketData] decoded._id:", decoded._id);
        const aquaMarket = await AquaMarket.findById(decoded._id).select("-password");
        console.log("[getAquaMarketData] found:", aquaMarket?._id ?? "NOT FOUND");
        if (!aquaMarket) return res.status(404).json({ success: false, message: "Аквамаркет не найден" });
        return res.json({ success: true, userData: aquaMarket });
    } catch (error) {
        console.error("[getAquaMarketData] error:", error.message);
        return res.status(500).json({ success: false, message: "Что-то пошло не так" });
    }
};

// ─── AquaMarket — Couriers ────────────────────────────────────────────────────

export const getAquaMarketCouriers = async (req, res) => {
    try {
        const aquaMarket = await verifyAquaMarketToken(req);
        const couriers = await CourierAggregator.find({onTheLine: true})
            .select("_id fullName firstName lastName onTheLine")
            .lean();
        return res.json({ success: true, couriers });
    } catch (error) {
        const code = error.statusCode || 500;
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

// ─── AquaMarket — Release (Отпустить) ─────────────────────────────────────────

export const releaseBottles = async (req, res) => {
    try {
        const aquaMarket = await verifyAquaMarketToken(req);
        const { courierId, giveFull = { b12: 0, b19: 0 }, receiveEmpty = { b12: 0, b19: 0 } } = req.body;

        const totalGiveFull = (giveFull.b12 || 0) + (giveFull.b19 || 0);
        if (totalGiveFull === 0 && (receiveEmpty.b12 || 0) + (receiveEmpty.b19 || 0) === 0) {
            return res.status(400).json({ success: false, message: "Укажите количество бутылей" });
        }

        if ((giveFull.b12 || 0) > (aquaMarket.full?.b12 || 0) || (giveFull.b19 || 0) > (aquaMarket.full?.b19 || 0)) {
            return res.status(400).json({ success: false, message: "Недостаточно полных бутылей на складе" });
        }

        await AquaMarket.findByIdAndUpdate(aquaMarket._id, {
            $inc: {
                "full.b12": -(giveFull.b12 || 0),
                "full.b19": -(giveFull.b19 || 0),
                "empty.b12": (receiveEmpty.b12 || 0),
                "empty.b19": (receiveEmpty.b19 || 0),
                dispensedBottlesKol: (giveFull.b12 || 0) + (giveFull.b19 || 0),
            }
        });

        if (courierId) {
            const courierUpdate = {
                $inc: {
                    capacity12: (giveFull.b12 || 0),
                    capacity19: (giveFull.b19 || 0),
                }
            };
            if (totalGiveFull > 0) {
                // Кладём выданные полные бутыли в FIFO-очередь курьера, чтобы при доставке
                // клиенту их можно было привязать к этому аквамаркету и посчитать в "реализованные".
                courierUpdate.$push = {
                    bottleQueue: {
                        aquaMarketId: aquaMarket._id,
                        franchiseeId: aquaMarket.franchisee,
                        b12: giveFull.b12 || 0,
                        b19: giveFull.b19 || 0,
                    }
                };
            }
            console.log(`[releaseBottles] aquaMarket=${aquaMarket._id} gave courier=${courierId} b12=${giveFull.b12 || 0} b19=${giveFull.b19 || 0} full bottles -> pushed to bottleQueue; received back empty b12=${receiveEmpty.b12 || 0} b19=${receiveEmpty.b19 || 0}`);
            await CourierAggregator.findByIdAndUpdate(courierId, courierUpdate);
        }

        await AquaMarketHistory.create({
            aquaMarket: aquaMarket._id,
            actionType: "giving",
            bottles: { b12: giveFull.b12 || 0, b19: giveFull.b19 || 0 },
            emptyBottles: { b12: receiveEmpty.b12 || 0, b19: receiveEmpty.b19 || 0 },
            courierAggregator: courierId || null,
        });

        const updated = await AquaMarket.findById(aquaMarket._id).select("-password");
        return res.json({ success: true, userData: updated });
    } catch (error) {
        const code = error.statusCode || 500;
        console.error("[releaseBottles]", error.message);
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

// ─── AquaMarket — Accept (Приемка) ───────────────────────────────────────────

export const acceptBottles = async (req, res) => {
    try {
        const aquaMarket = await verifyAquaMarketToken(req);
        const { courierId, receiveFull = { b12: 0, b19: 0 }, receiveEmpty = { b12: 0, b19: 0 } } = req.body;

        const total = (receiveFull.b12 || 0) + (receiveFull.b19 || 0) + (receiveEmpty.b12 || 0) + (receiveEmpty.b19 || 0);
        if (total === 0) return res.status(400).json({ success: false, message: "Укажите количество бутылей" });

        await AquaMarket.findByIdAndUpdate(aquaMarket._id, {
            $inc: {
                "full.b12": (receiveFull.b12 || 0),
                "full.b19": (receiveFull.b19 || 0),
                "empty.b12": (receiveEmpty.b12 || 0),
                "empty.b19": (receiveEmpty.b19 || 0),
            }
        });

        if (courierId) {
            const totalReceiveFull = (receiveFull.b12 || 0) + (receiveFull.b19 || 0);
            const courierUpdate = {
                $inc: {
                    capacity12: -(receiveFull.b12 || 0),
                    capacity19: -(receiveFull.b19 || 0),
                }
            };

            if (totalReceiveFull > 0) {
                // Если курьер возвращает полные бутыли ИМЕННО тому аквамаркету, у которого их взял,
                // они не были реализованы — убираем их из FIFO-очереди, чтобы не засчитались при доставке.
                const courier = await CourierAggregator.findById(courierId).select("bottleQueue");
                const refund = refundBottleQueueForMarket(courier?.bottleQueue || [], aquaMarket._id, receiveFull.b12 || 0, receiveFull.b19 || 0);
                courierUpdate.$set = { bottleQueue: refund.newQueue };
                if (refund.unmatchedB12 > 0 || refund.unmatchedB19 > 0) {
                    console.warn(`[acceptBottles] aquaMarket=${aquaMarket._id} took back full bottles from courier=${courierId}, but bottleQueue has no matching entries for b12=${refund.unmatchedB12} b19=${refund.unmatchedB19} (likely bottles taken from a different aquaMarket, so realized not affected for those)`);
                }
            }

            console.log(`[acceptBottles] aquaMarket=${aquaMarket._id} received from courier=${courierId} full b12=${receiveFull.b12 || 0} b19=${receiveFull.b19 || 0} (removed from bottleQueue if matched to this market), empty b12=${receiveEmpty.b12 || 0} b19=${receiveEmpty.b19 || 0}`);
            await CourierAggregator.findByIdAndUpdate(courierId, courierUpdate);
        }

        await AquaMarketHistory.create({
            aquaMarket: aquaMarket._id,
            actionType: "receiving",
            bottles: { b12: receiveFull.b12 || 0, b19: receiveFull.b19 || 0 },
            emptyBottles: { b12: receiveEmpty.b12 || 0, b19: receiveEmpty.b19 || 0 },
            courierAggregator: courierId || null,
        });

        const updated = await AquaMarket.findById(aquaMarket._id).select("-password");
        return res.json({ success: true, userData: updated });
    } catch (error) {
        const code = error.statusCode || 500;
        console.error("[acceptBottles]", error.message);
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

// ─── AquaMarket — Самовывоз (Pickup) ─────────────────────────────────────────

export const createPickupQr = async (req, res) => {
    try {
        const aquaMarket = await verifyAquaMarketToken(req);
        const { amount } = req.body;

        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Укажите сумму оплаты" });
        }

        const { status, data } = await apipayCreateQrInvoice({ amount: Number(amount) });

        if (status < 200 || status >= 300) {
            return res.status(502).json({ success: false, message: data?.message || "Ошибка при создании QR-счёта" });
        }

        await ApiPayInvoice.create({
            apipayInvoiceId: data.id,
            amount: Number(data.amount ?? amount),
            status: data.status || "pending",
            kaspiInvoiceId: data.kaspi_invoice_id || null,
            qrImageUrl: data.qr_image_url || null,
            qrTokenUrl: data.qr_token_url || null,
            qrExpiresAt: data.qr_expires_at ? new Date(data.qr_expires_at) : null,
            isSandbox: !!data.is_sandbox,
            lastResponse: data,
        });

        return res.status(201).json({
            success: true,
            invoiceId: data.id,
            qrImageUrl: data.qr_image_url,
            amount: Number(data.amount ?? amount),
        });
    } catch (error) {
        const code = error.statusCode || 500;
        console.error("[createPickupQr]", error.message);
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

export const checkPickupQr = async (req, res) => {
    try {
        await verifyAquaMarketToken(req);
        const { invoiceId } = req.body;
        if (!invoiceId) return res.status(400).json({ success: false, message: "Укажите invoiceId" });

        const { status, data } = await apipayGetInvoice(invoiceId);
        if (status < 200 || status >= 300) {
            return res.status(502).json({ success: false, message: "Ошибка при проверке оплаты" });
        }

        const paid = data?.status === "paid" || data?.status === "completed";
        return res.json({ success: true, paid, status: data?.status });
    } catch (error) {
        const code = error.statusCode || 500;
        console.error("[checkPickupQr]", error.message);
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

export const completePickup = async (req, res) => {
    try {
        const aquaMarket = await verifyAquaMarketToken(req);
        const {
            giveFull = { b12: 0, b19: 0 },
            receiveEmpty = { b12: 0, b19: 0 },
            amount = 0,
            paymentType = "cash",
        } = req.body;

        if ((giveFull.b12 || 0) > (aquaMarket.full?.b12 || 0) || (giveFull.b19 || 0) > (aquaMarket.full?.b19 || 0)) {
            return res.status(400).json({ success: false, message: "Недостаточно полных бутылей на складе" });
        }

        await AquaMarket.findByIdAndUpdate(aquaMarket._id, {
            $inc: {
                "full.b12": -(giveFull.b12 || 0),
                "full.b19": -(giveFull.b19 || 0),
                "empty.b12": (receiveEmpty.b12 || 0),
                "empty.b19": (receiveEmpty.b19 || 0),
                dispensedBottlesKol: (giveFull.b12 || 0) + (giveFull.b19 || 0),
            }
        });

        await AquaMarketHistory.create({
            aquaMarket: aquaMarket._id,
            actionType: "pickup",
            bottles: { b12: giveFull.b12 || 0, b19: giveFull.b19 || 0 },
            emptyBottles: { b12: receiveEmpty.b12 || 0, b19: receiveEmpty.b19 || 0 },
            amount: Number(amount),
            paymentType,
        });

        const updated = await AquaMarket.findById(aquaMarket._id).select("-password");
        return res.json({ success: true, userData: updated });
    } catch (error) {
        const code = error.statusCode || 500;
        console.error("[completePickup]", error.message);
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

// ─── AquaMarket — Analytics ──────────────────────────────────────────────────

export const getAquaMarketAnalytics = async (req, res) => {
    try {
        const aquaMarket = await verifyAquaMarketToken(req);

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todayHistory = await AquaMarketHistory.find({
            aquaMarket: aquaMarket._id,
            createdAt: { $gte: startOfDay, $lte: endOfDay },
        }).lean();

        const pickups = todayHistory.filter(h => h.actionType === "pickup");
        const todayEarnings = pickups.reduce((sum, h) => sum + (h.amount || 0), 0);
        const todayCash = pickups.filter(h => h.paymentType === "cash").reduce((sum, h) => sum + (h.amount || 0), 0);

        const givingToday = todayHistory.filter(h => h.actionType === "giving");
        const bottlesDispensedToday = givingToday.reduce((sum, h) => sum + (h.bottles?.b12 || 0) + (h.bottles?.b19 || 0), 0);

        return res.json({
            success: true,
            todayEarnings,
            todayCash,
            bottlesDispensedToday,
        });
    } catch (error) {
        const code = error.statusCode || 500;
        console.error("[getAquaMarketAnalytics]", error.message);
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

export const getAquaMarketBottleHistory = async (req, res) => {
    try {
        const aquaMarket = await verifyAquaMarketToken(req);
        const { from, to } = req.query;

        const query = { aquaMarket: aquaMarket._id };
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = toDate;
            }
        }

        const history = await AquaMarketHistory.find(query)
            .sort({ createdAt: -1 })
            .lean();

        const byDay = {};
        history.forEach(h => {
            const day = new Date(h.createdAt).toISOString().slice(0, 10);
            if (!byDay[day]) byDay[day] = 0;
            byDay[day] += (h.bottles?.b12 || 0) + (h.bottles?.b19 || 0);
        });

        const total = Object.values(byDay).reduce((s, v) => s + v, 0);
        const chartData = Object.entries(byDay).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

        return res.json({ success: true, total, chartData, history });
    } catch (error) {
        const code = error.statusCode || 500;
        console.error("[getAquaMarketBottleHistory]", error.message);
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

// ─── Franchisee — Main Data ──────────────────────────────────────────────────

export const getFranchiseeMainData = async (req, res) => {
    try {
        const user = await verifyFranchiseeToken(req);

        const aquaMarkets = await AquaMarket.find({ franchisee: user._id }).select("-password").lean();

        const totals = aquaMarkets.reduce((acc, am) => ({
            fullB12: acc.fullB12 + (am.full?.b12 || 0),
            fullB19: acc.fullB19 + (am.full?.b19 || 0),
            emptyB12: acc.emptyB12 + (am.empty?.b12 || 0),
            emptyB19: acc.emptyB19 + (am.empty?.b19 || 0),
        }), { fullB12: 0, fullB19: 0, emptyB12: 0, emptyB19: 0 });

        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

        const todayHistory = await AquaMarketHistory.find({
            aquaMarket: { $in: aquaMarkets.map(am => am._id) },
            createdAt: { $gte: startOfDay, $lte: endOfDay },
        }).lean();

        const todayEarnings = todayHistory
            .filter(h => h.actionType === "pickup")
            .reduce((s, h) => s + (h.amount || 0), 0);

        const bottlesDispensedToday = todayHistory
            .filter(h => h.actionType === "giving" || h.actionType === "pickup")
            .reduce((s, h) => s + (h.bottles?.b12 || 0) + (h.bottles?.b19 || 0), 0);

        const realizedBottles = aquaMarkets.reduce((acc, am) => ({
            b12: acc.b12 + (am.realized?.b12 || 0),
            b19: acc.b19 + (am.realized?.b19 || 0),
        }), { b12: 0, b19: 0 });

        console.log(`[getFranchiseeMainData] franchisee=${user._id}: summed realized bottles across ${aquaMarkets.length} aquaMarket(s) [${aquaMarkets.map(am => `${am._id}: b12=${am.realized?.b12 || 0}/b19=${am.realized?.b19 || 0}`).join(', ')}] -> total b12=${realizedBottles.b12} b19=${realizedBottles.b19}`);

        return res.json({
            success: true,
            aquaMarkets,
            totals,
            todayEarnings,
            bottlesDispensedToday,
            realizedBottles,
            franchiseeBottles: {
                fullB12: user.fullBottles?.b12 || 0,
                fullB19: user.fullBottles?.b19 || 0,
                emptyB12: user.emptyBottles?.b12 || 0,
                emptyB19: user.emptyBottles?.b19 || 0,
            },
        });
    } catch (error) {
        const code = error.statusCode || 500;
        console.error("[getFranchiseeMainData]", error.message);
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

export const getFranchiseeAnalytics = async (req, res) => {
    try {
        const user = await verifyFranchiseeToken(req);
        const aquaMarkets = await AquaMarket.find({ franchisee: user._id }).select("_id").lean();
        const ids = aquaMarkets.map(am => am._id);

        const { from, to } = req.query;
        const query = { aquaMarket: { $in: ids } };
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) { const d = new Date(to); d.setHours(23,59,59,999); query.createdAt.$lte = d; }
        } else {
            const s = new Date(); s.setHours(0,0,0,0);
            const e = new Date(); e.setHours(23,59,59,999);
            query.createdAt = { $gte: s, $lte: e };
        }

        const history = await AquaMarketHistory.find(query).lean();

        const pickups = history.filter(h => h.actionType === "pickup");
        const todayEarnings = pickups.reduce((s, h) => s + (h.amount || 0), 0);
        const todayCash = pickups.filter(h => h.paymentType === "cash").reduce((s, h) => s + (h.amount || 0), 0);
        const bottlesDispensed = history
            .filter(h => h.actionType === "giving" || h.actionType === "pickup")
            .reduce((s, h) => s + (h.bottles?.b12 || 0) + (h.bottles?.b19 || 0), 0);

        const byDay = {};
        history.forEach(h => {
            const day = new Date(h.createdAt).toISOString().slice(0, 10);
            if (!byDay[day]) byDay[day] = 0;
            byDay[day] += (h.bottles?.b12 || 0) + (h.bottles?.b19 || 0);
        });
        const chartData = Object.entries(byDay).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

        return res.json({ success: true, todayEarnings, todayCash, bottlesDispensed, chartData });
    } catch (error) {
        const code = error.statusCode || 500;
        console.error("[getFranchiseeAnalytics]", error.message);
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

// ─── Franchisee — AquaMarket Action ─────────────────────────────────────────

export const franchiseeAquaMarketAction = async (req, res) => {
    try {
        const user = await verifyFranchiseeToken(req);
        const { aquaMarketId, actionType, bottles } = req.body;

        const aquaMarket = await AquaMarket.findOne({ _id: aquaMarketId, franchisee: user._id });
        if (!aquaMarket) {
            return res.status(404).json({ success: false, message: "Аквамаркет не найден или не принадлежит вам" });
        }

        const b12 = Number(bottles?.b12 || 0);
        const b19 = Number(bottles?.b19 || 0);

        if (b12 === 0 && b19 === 0) {
            return res.status(400).json({ success: false, message: "Укажите количество бутылей" });
        }

        if (actionType === "fill") {
            if (b12 > (user.fullBottles?.b12 || 0) || b19 > (user.fullBottles?.b19 || 0)) {
                return res.status(400).json({ success: false, message: "Недостаточно полных бутылей на складе" });
            }
            await User.findByIdAndUpdate(user._id, {
                $inc: { "fullBottles.b12": -b12, "fullBottles.b19": -b19 }
            });
            await AquaMarket.findByIdAndUpdate(aquaMarketId, {
                $inc: { "full.b12": b12, "full.b19": b19 }
            });
            await AquaMarketHistory.create({
                aquaMarket: aquaMarketId,
                actionType: "franchiseeFill",
                bottles: { b12, b19 },
                franchisee: user._id,
            });
        } else if (actionType === "takeEmpty") {
            if (b12 > (aquaMarket.empty?.b12 || 0) || b19 > (aquaMarket.empty?.b19 || 0)) {
                return res.status(400).json({ success: false, message: "Недостаточно пустых бутылей в аквамаркете" });
            }
            await AquaMarket.findByIdAndUpdate(aquaMarketId, {
                $inc: { "empty.b12": -b12, "empty.b19": -b19 }
            });
            await User.findByIdAndUpdate(user._id, {
                $inc: { "emptyBottles.b12": b12, "emptyBottles.b19": b19 }
            });
            await AquaMarketHistory.create({
                aquaMarket: aquaMarketId,
                actionType: "franchiseeEmptyPickup",
                bottles: { b12, b19 },
                franchisee: user._id,
            });
        } else {
            return res.status(400).json({ success: false, message: "Неверный тип действия" });
        }

        const updatedUser = await User.findById(user._id).select("-password");
        const updatedAquaMarket = await AquaMarket.findById(aquaMarketId).select("-password");
        return res.json({ success: true, userData: updatedUser, aquaMarket: updatedAquaMarket });
    } catch (error) {
        const code = error.statusCode || 500;
        console.error("[franchiseeAquaMarketAction]", error.message);
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

// ─── Franchisee — AquaMarket History ─────────────────────────────────────────

export const getFranchiseeAquaMarketHistory = async (req, res) => {
    try {
        const user = await verifyFranchiseeToken(req);
        const { from, to } = req.query;

        const aquaMarkets = await AquaMarket.find({ franchisee: user._id }).select("_id").lean();
        const ids = aquaMarkets.map(am => am._id);

        const query = {
            aquaMarket: { $in: ids },
            actionType: { $in: ["franchiseeFill", "franchiseeEmptyPickup"] },
        };
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); query.createdAt.$lte = d; }
        }

        const history = await AquaMarketHistory.find(query)
            .populate("aquaMarket", "address userName")
            .sort({ createdAt: -1 })
            .lean();

        return res.json({ success: true, history });
    } catch (error) {
        const code = error.statusCode || 500;
        console.error("[getFranchiseeAquaMarketHistory]", error.message);
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};

// ─── AquaMarket — Toggle Online ──────────────────────────────────────────────

export const toggleAquaMarketOnline = async (req, res) => {
    try {
        const aquaMarket = await verifyAquaMarketToken(req);
        const updated = await AquaMarket.findByIdAndUpdate(
            aquaMarket._id,
            { $set: { onTheLine: !aquaMarket.onTheLine } },
            { new: true }
        ).select("-password");
        return res.json({ success: true, userData: updated });
    } catch (error) {
        const code = error.statusCode || 500;
        return res.status(code).json({ success: false, message: error.message || "Что-то пошло не так" });
    }
};
