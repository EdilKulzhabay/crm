import User from "../Models/User.js";
import InvoiceGlobalCounter from "../Models/InvoiceGlobalCounter.js";

const KEY = "global";

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

/** Текущее значение «следующий номер счёта» (то, что уйдёт в следующий PDF). */
export const getInvoiceGlobalCounter = async (req, res) => {
    try {
        const admin = await requireSuperAdmin(req, res);
        if (!admin) return;

        const doc = await InvoiceGlobalCounter.findOne({ key: KEY });
        const value = doc ? String(doc.value ?? "1").trim() || "1" : "1";
        res.json({ success: true, value });
    } catch (e) {
        console.error("getInvoiceGlobalCounter", e);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
};

/** Задать следующий номер счёта вручную (редактирует суперадмин). */
export const setInvoiceGlobalCounter = async (req, res) => {
    try {
        const admin = await requireSuperAdmin(req, res);
        if (!admin) return;

        let { value } = req.body;
        value = String(value ?? "").trim();
        if (!value) {
            return res.status(400).json({
                success: false,
                message: "Укажите непустой номер",
            });
        }

        const doc = await InvoiceGlobalCounter.findOneAndUpdate(
            { key: KEY },
            { $set: { value } },
            { upsert: true, new: true }
        );
        res.json({ success: true, value: doc.value });
    } catch (e) {
        console.error("setInvoiceGlobalCounter", e);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
};
