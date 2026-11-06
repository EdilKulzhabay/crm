import User from "../Models/User.js";
import MobileAppSettings, {
    DEFAULT_MAINTENANCE_MESSAGE,
    MAINTENANCE_MESSAGE_MAX_LENGTH,
} from "../Models/MobileAppSettings.js";

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

export const getAppVersionSettings = async (req, res) => {
    try {
        const admin = await requireSuperAdmin(req, res);
        if (!admin) return;

        let doc = await MobileAppSettings.findOne();
        if (!doc) {
            doc = await MobileAppSettings.create({});
        }

        res.json({
            success: true,
            latestAppVersion: doc.latestAppVersion || "",
            latestCourierAppVersion: doc.latestCourierAppVersion || "",
            ...serializeMaintenance(doc),
        });
    } catch (e) {
        console.error("getAppVersionSettings", e);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
};

export const setAppVersionSettings = async (req, res) => {
    try {
        const admin = await requireSuperAdmin(req, res);
        if (!admin) return;

        const hasClientVersion = req.body.latestAppVersion !== undefined;
        const hasCourierVersion = req.body.latestCourierAppVersion !== undefined;

        if (!hasClientVersion && !hasCourierVersion) {
            return res.status(400).json({
                success: false,
                message: "Укажите версию приложения",
            });
        }

        const update = {};
        if (hasClientVersion) {
            const latestAppVersion = String(req.body.latestAppVersion || "").trim();
            if (!latestAppVersion) {
                return res.status(400).json({
                    success: false,
                    message: "Укажите версию клиентского приложения",
                });
            }
            update.latestAppVersion = latestAppVersion;
        }
        if (hasCourierVersion) {
            const latestCourierAppVersion = String(req.body.latestCourierAppVersion || "").trim();
            if (!latestCourierAppVersion) {
                return res.status(400).json({
                    success: false,
                    message: "Укажите версию приложения курьера",
                });
            }
            update.latestCourierAppVersion = latestCourierAppVersion;
        }

        const doc = await MobileAppSettings.findOneAndUpdate(
            {},
            { $set: update },
            { new: true, upsert: true }
        );

        res.json({
            success: true,
            latestAppVersion: doc.latestAppVersion,
            latestCourierAppVersion: doc.latestCourierAppVersion,
        });
    } catch (e) {
        console.error("setAppVersionSettings", e);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
};

function serializeMaintenance(doc) {
    return {
        maintenanceEnabled: doc?.maintenanceEnabled === true,
        maintenanceMessage: doc?.maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE,
    };
}

/**
 * GET /getMaintenanceStatusMobile — без авторизации: модалку показываем и на экране входа.
 * Ответ: { success, enabled, message }
 */
export const getMaintenanceStatusMobile = async (req, res) => {
    try {
        const doc = await MobileAppSettings.findOne().select("maintenanceEnabled maintenanceMessage").lean();
        const { maintenanceEnabled, maintenanceMessage } = serializeMaintenance(doc);
        res.json({ success: true, enabled: maintenanceEnabled, message: maintenanceMessage });
    } catch (e) {
        console.error("getMaintenanceStatusMobile", e);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
};

/**
 * POST /setMaintenanceSettings { enabled: boolean, message?: string } — только суперадмин.
 * Пустой текст — стандартный «Ведутся технические работы, попробуйте через 15 мин».
 */
export const setMaintenanceSettings = async (req, res) => {
    try {
        const admin = await requireSuperAdmin(req, res);
        if (!admin) return;

        const { enabled, message } = req.body || {};
        if (typeof enabled !== "boolean") {
            return res.status(400).json({ success: false, message: "Укажите, включены ли технические работы" });
        }
        if (message !== undefined && typeof message !== "string") {
            return res.status(400).json({ success: false, message: "Текст сообщения должен быть строкой" });
        }
        const trimmed = (message ?? "").trim();
        if (trimmed.length > MAINTENANCE_MESSAGE_MAX_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Текст не длиннее ${MAINTENANCE_MESSAGE_MAX_LENGTH} символов`,
            });
        }

        const update = { maintenanceEnabled: enabled };
        if (message !== undefined) update.maintenanceMessage = trimmed || DEFAULT_MAINTENANCE_MESSAGE;

        const doc = await MobileAppSettings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
        console.log(`[maintenance] ${admin.fullName || admin._id}: ${enabled ? "включены" : "выключены"}`);
        res.json({ success: true, ...serializeMaintenance(doc) });
    } catch (e) {
        console.error("setMaintenanceSettings", e);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
};
