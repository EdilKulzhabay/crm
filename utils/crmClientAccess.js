import mongoose from "mongoose";
import Client from "../Models/Client.js";
import User from "../Models/User.js";

export class ClientAccessError extends Error {
    /** @param {number} status @param {string} message */
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/**
 * Суперадмин видит всех клиентов, франчайзи (admin) — только своих.
 * @param {{ role?: string, _id?: unknown } | null} user
 * @param {{ franchisee?: unknown } | null} client
 * @returns {boolean}
 */
export function canUserAccessClient(user, client) {
    if (!user || !client) return false;
    if (user.role === "superAdmin") return true;
    return user.role === "admin" && String(client.franchisee) === String(user._id);
}

/**
 * После checkAuth: загружает клиента, к которому у пользователя CRM есть доступ.
 * @param {{ userId?: unknown, userType?: string }} req
 * @param {unknown} clientId
 * @param {string} [select] поля клиента
 * @throws {ClientAccessError}
 */
export async function loadAccessibleClient(req, clientId, select) {
    if (!mongoose.Types.ObjectId.isValid(String(clientId))) {
        throw new ClientAccessError(400, "Некорректный id клиента");
    }
    if (req.userType !== "user") {
        throw new ClientAccessError(403, "Нет доступа");
    }
    const [user, client] = await Promise.all([
        User.findById(req.userId).select("role").lean(),
        Client.findById(clientId).select(select ? `${select} franchisee` : undefined),
    ]);
    if (!client) {
        throw new ClientAccessError(404, "Клиент не найден");
    }
    if (!canUserAccessClient(user, client)) {
        throw new ClientAccessError(403, "Нет доступа к этому клиенту");
    }
    return client;
}
