import mongoose from "mongoose";
import Client from "../Models/Client.js";
import ClientNotificationLog from "../Models/ClientNotificationLog.js";

/** Дата/время «как на часах» в UTC+5: к моменту UTC прибавляем 5 ч и читаем UTC-компоненты. */
export function formatSentAtLocalPlus5(date = new Date()) {
    const shifted = new Date(date.getTime() + 5 * 60 * 60 * 1000);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
    const d = String(shifted.getUTCDate()).padStart(2, "0");
    const h = String(shifted.getUTCHours()).padStart(2, "0");
    const min = String(shifted.getUTCMinutes()).padStart(2, "0");
    const s = String(shifted.getUTCSeconds()).padStart(2, "0");
    return `${y}-${m}-${d}T${h}:${min}:${s}+05:00`;
}

export function mapNewStatusToNotificationType(newStatus) {
    const s = String(newStatus || "").toLowerCase();
    if (s === "couriernearby") return "courierNearby";
    if (s === "newsupportmessage") return "support";
    if (s === "balancetopupsuccess") return "other";
    if (s === "sendnotification" || s === "sendnotificationtoclients") {
        return "other";
    }
    return "orderStatus";
}

function extractOrderId(data) {
    if (!data) return null;
    const raw = data.orderId ?? data._id;
    if (raw == null) return null;
    const str = String(raw);
    if (!mongoose.Types.ObjectId.isValid(str)) return null;
    return new mongoose.Types.ObjectId(str);
}

export async function findClientIdsByPushTokens(tokens) {
    const uniq = [...new Set((tokens || []).filter((t) => typeof t === "string" && t.trim()))];
    if (uniq.length === 0) return [];

    const clients = await Client.find({
        $or: [
            { notificationPushToken: { $in: uniq } },
            { notificationPushTokens: { $in: uniq } },
        ],
    })
        .select("_id")
        .lean();

    return [...new Set(clients.map((c) => String(c._id)))];
}

/**
 * Сохраняет записи в журнал: один документ на клиента за один вызов push.
 */
export async function persistClientNotificationLogs({
    clientId,
    validTokens,
    title,
    messageBody,
    newStatus,
    data,
    successCount,
    errorCount,
}) {
    try {
        const sentAt = new Date();
        const sentAtLocalPlus5 = formatSentAtLocalPlus5(sentAt);
        const notificationType = mapNewStatusToNotificationType(newStatus);
        const pushChannel = String(newStatus || "");
        const orderId = extractOrderId(data);
        const tokenCount = Array.isArray(validTokens) ? validTokens.length : 0;

        const base = {
            title,
            messageBody,
            notificationType,
            pushChannel,
            orderId,
            sentAt,
            sentAtLocalPlus5,
            successCount: Number(successCount) || 0,
            errorCount: Number(errorCount) || 0,
            tokenCount,
        };

        const clientIds = new Set();
        if (clientId != null && mongoose.Types.ObjectId.isValid(String(clientId))) {
            clientIds.add(String(clientId));
        }
        if (clientIds.size === 0 && tokenCount > 0) {
            const resolved = await findClientIdsByPushTokens(validTokens);
            resolved.forEach((id) => clientIds.add(id));
        }

        if (clientIds.size === 0) {
            await ClientNotificationLog.create({
                ...base,
                client: null,
            });
            return;
        }

        const docs = [...clientIds].map((id) => ({
            ...base,
            client: new mongoose.Types.ObjectId(id),
        }));
        await ClientNotificationLog.insertMany(docs, { ordered: false });
    } catch (err) {
        console.error(
            "[persistClientNotificationLogs] не критично:",
            err?.message || err
        );
    }
}
