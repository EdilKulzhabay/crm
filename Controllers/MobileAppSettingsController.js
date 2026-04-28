import User from "../Models/User.js";
import MobileAppSettings from "../Models/MobileAppSettings.js";

const DEFAULT_HOUR = 19;

async function requireSuperAdmin(req, res) {
    const user = await User.findById(req.userId);
    if (!user || user.role !== "superAdmin") {
        res.status(403).json({
            success: false,
            message: "Доступ только для суперадмина",
        });
        return null;
    }
    return user;
}

export const getMobileOrderCutoffSettings = async (req, res) => {
    try {
        const admin = await requireSuperAdmin(req, res);
        if (!admin) return;

        let doc = await MobileAppSettings.findOne();
        if (!doc) {
            doc = await MobileAppSettings.create({ orderSameDayUntilHour: DEFAULT_HOUR });
        }
        const h = Number(doc.orderSameDayUntilHour);
        const orderSameDayUntilHour =
            Number.isFinite(h) && h >= 0 && h <= 23 ? Math.floor(h) : DEFAULT_HOUR;

        res.json({ success: true, orderSameDayUntilHour });
    } catch (e) {
        console.error("getMobileOrderCutoffSettings", e);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
};

export const setMobileOrderCutoffSettings = async (req, res) => {
    try {
        const admin = await requireSuperAdmin(req, res);
        if (!admin) return;

        let { orderSameDayUntilHour } = req.body;
        orderSameDayUntilHour = Number(orderSameDayUntilHour);
        if (
            !Number.isFinite(orderSameDayUntilHour) ||
            orderSameDayUntilHour < 0 ||
            orderSameDayUntilHour > 23
        ) {
            return res.status(400).json({
                success: false,
                message: "Укажите час от 0 до 23",
            });
        }
        orderSameDayUntilHour = Math.floor(orderSameDayUntilHour);

        let doc = await MobileAppSettings.findOneAndUpdate(
            {},
            { $set: { orderSameDayUntilHour } },
            { new: true, upsert: true }
        );

        res.json({
            success: true,
            orderSameDayUntilHour: doc.orderSameDayUntilHour,
        });
    } catch (e) {
        console.error("setMobileOrderCutoffSettings", e);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
};
