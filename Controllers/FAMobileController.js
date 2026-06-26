import User from "../Models/User.js";
import AquaMarket from "../Models/AquaMarket.js";
import AquaMarketHistory from "../Models/AquaMarketHistory.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import ApiPayInvoice from "../Models/ApiPayInvoice.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createQrInvoice as apipayCreateQrInvoice, getInvoice as apipayGetInvoice } from "../utils/apipay.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const verifyAquaMarketToken = async (req) => {
    const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");
    if (!token) throw Object.assign(new Error("Нет токена"), { statusCode: 403 });
    const decoded = jwt.verify(token, process.env.SecretKey);
    const aquaMarket = await AquaMarket.findById(decoded._id).select("-password");
    if (!aquaMarket) throw Object.assign(new Error("Аквамаркет не найден"), { statusCode: 404 });
    return aquaMarket;
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
        const query = { status: "active" };
        if (aquaMarket.franchisee) query.franchisee = aquaMarket.franchisee;
        const couriers = await CourierAggregator.find(query)
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
