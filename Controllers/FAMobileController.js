import User from "../Models/User.js";
import AquaMarket from "../Models/AquaMarket.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// ─── Franchisee ──────────────────────────────────────────────────────────────

export const franchiseeLogin = async (req, res) => {
    try {
        const { mail, password } = req.body;

        const candidate = await User.findOne({ mail });

        if (!candidate) {
            return res.status(400).json({
                success: false,
                message: "Неверный логин или пароль",
            });
        }

        const isValidPass = await bcrypt.compare(password, candidate.password);

        if (!isValidPass) {
            return res.status(400).json({
                success: false,
                message: "Неверный логин или пароль",
            });
        }

        if (candidate.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Аккаунт заблокирован",
            });
        }

        const token = jwt.sign({ _id: candidate._id }, process.env.SecretKey, {
            expiresIn: "30d",
        });

        const { password: _, ...userData } = candidate.toObject();

        return res.json({
            success: true,
            token,
            userData,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Что-то пошло не так",
        });
    }
};

export const getFranchiseeData = async (req, res) => {
    try {
        const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");

        if (!token) {
            return res.status(403).json({ success: false, message: "Нет доступа" });
        }

        const decoded = jwt.verify(token, process.env.SecretKey);
        const user = await User.findById(decoded._id).select("-password");

        if (!user) {
            return res.status(404).json({ success: false, message: "Пользователь не найден" });
        }

        return res.json({ success: true, userData: user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Что-то пошло не так",
        });
    }
};

// ─── AquaMarket ──────────────────────────────────────────────────────────────

export const aquaMarketLogin = async (req, res) => {
    try {
        const { userName, password } = req.body;

        const candidate = await AquaMarket.findOne({ userName });

        if (!candidate) {
            return res.status(400).json({
                success: false,
                message: "Неверный логин или пароль",
            });
        }

        const isValidPass = await bcrypt.compare(password, candidate.password);

        if (!isValidPass) {
            return res.status(400).json({
                success: false,
                message: "Неверный логин или пароль",
            });
        }

        const token = jwt.sign({ _id: candidate._id }, process.env.SecretKey, {
            expiresIn: "30d",
        });

        const { password: _, ...userData } = candidate.toObject();

        return res.json({
            success: true,
            token,
            userData,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Что-то пошло не так",
        });
    }
};

export const getAquaMarketData = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        console.log("[getAquaMarketData] header:", authHeader);

        const token = (authHeader || "").replace(/Bearer\s?/, "");
        if (!token) {
            return res.status(403).json({ success: false, message: "Нет доступа" });
        }

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

        if (!aquaMarket) {
            return res.status(404).json({ success: false, message: "Аквамаркет не найден" });
        }

        return res.json({ success: true, userData: aquaMarket });
    } catch (error) {
        console.error("[getAquaMarketData] error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Что-то пошло не так",
        });
    }
};
