import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Client from "../Models/Client.js";

/**
 * Сессии клиентского приложения: одна запись на устройство в `Client.refreshSessions`.
 *
 * Раньше у клиента был один `Client.refreshToken`, и вход на втором телефоне делал refresh
 * первого недействительным. Теперь каждое устройство обновляет свою сессию. Храним только
 * SHA-256 хэш refresh-токена — утечка базы не даёт готовых токенов.
 *
 * Refresh-токен одноразовый (ротация при каждом обновлении). Если ответ с новой парой
 * потерялся в сети, приложение повторит запрос со старым токеном — его принимаем ещё
 * REFRESH_GRACE_MS после ротации, но не продлеваем это окно повторными обменами.
 */

export const CLIENT_TOKEN_TTL = "30d";
export const MAX_CLIENT_SESSIONS = 10;
export const REFRESH_GRACE_MS = 2 * 60 * 1000;
const MAX_SAVE_ATTEMPTS = 3;
const ACTIVE_CLIENT_STATUS = "active";

export class RefreshRejectedError extends Error {
    constructor(reason) {
        super(`Refresh token rejected: ${reason}`);
        this.name = "RefreshRejectedError";
        this.reason = reason;
    }
}

export function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

/** Клиент из payload токена: `{ client: id }` или старый формат `{ client: { _id } }` */
export function clientIdFromPayload(decoded) {
    const client = decoded?.client;
    return String(client?._id ?? client ?? "");
}

/**
 * Какая сессия предъявлена: действующий токен или предыдущий в окне после ротации.
 * @returns {{ index: number, isPrevious: boolean } | null}
 */
export function findSession(sessions, tokenHash, now) {
    const list = Array.isArray(sessions) ? sessions : [];
    const current = list.findIndex((session) => session?.hash === tokenHash);
    if (current !== -1) {
        return { index: current, isPrevious: false };
    }
    const previous = list.findIndex(
        (session) =>
            session?.previousHash === tokenHash &&
            session.rotatedAt &&
            now - new Date(session.rotatedAt).getTime() <= REFRESH_GRACE_MS,
    );
    return previous === -1 ? null : { index: previous, isPrevious: true };
}

/** Последние по использованию MAX_CLIENT_SESSIONS устройств */
function capSessions(sessions) {
    return [...sessions]
        .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
        .slice(0, MAX_CLIENT_SESSIONS);
}

export function addSession(sessions, tokenHash, now) {
    const date = new Date(now);
    const list = Array.isArray(sessions) ? sessions : [];
    return capSessions([...list, { hash: tokenHash, createdAt: date, lastUsedAt: date }]);
}

/**
 * Новый токен вместо предъявленного. При повторе со старым токеном в окне после ротации
 * `rotatedAt` не сдвигаем, чтобы окно нельзя было продлевать бесконечно.
 */
export function rotateSession(sessions, match, newHash, presentedHash, now) {
    const date = new Date(now);
    return sessions.map((session, index) => {
        if (index !== match.index) {
            return session;
        }
        return {
            ...session,
            hash: newHash,
            previousHash: presentedHash,
            rotatedAt: match.isPrevious ? session.rotatedAt : date,
            lastUsedAt: date,
        };
    });
}

export function removeSession(sessions, tokenHash) {
    const list = Array.isArray(sessions) ? sessions : [];
    return list.filter((session) => session?.hash !== tokenHash && session?.previousHash !== tokenHash);
}

/**
 * `jwtid` обязателен: без него два токена одного клиента, выданные в одну секунду
 * (вход на двух устройствах, ротация сразу после входа), совпадали бы байт в байт —
 * и сессии разных устройств слились бы в одну.
 */
function signTokens(clientId) {
    const payload = { client: clientId };
    return {
        accessToken: jwt.sign(payload, process.env.SecretKey, {
            expiresIn: CLIENT_TOKEN_TTL,
            jwtid: crypto.randomUUID(),
        }),
        refreshToken: jwt.sign(payload, process.env.SecretKeyRefresh, {
            expiresIn: CLIENT_TOKEN_TTL,
            jwtid: crypto.randomUUID(),
        }),
    };
}

/**
 * Сохраняет массив сессий, только если его не изменил параллельный запрос
 * (другое устройство или повторный refresh), иначе перечитывает и пересчитывает.
 * @param {(client) => { sessions: object[], extra?: object }} compute — бросает, чтобы отказать
 */
async function updateSessions(clientId, compute) {
    for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
        const client = await Client.findById(clientId)
            .select("refreshSessions refreshSessionsVersion refreshToken status")
            .lean();
        if (!client) {
            throw new RefreshRejectedError("CLIENT_NOT_FOUND");
        }
        const { sessions, extra = {} } = compute(client);
        const version = client.refreshSessionsVersion ?? 0;
        const result = await Client.updateOne(
            {
                _id: clientId,
                ...(version === 0
                    ? { refreshSessionsVersion: { $in: [0, null] } }
                    : { refreshSessionsVersion: version }),
            },
            { $set: { refreshSessions: sessions, refreshSessionsVersion: version + 1, ...extra } },
        );
        if (result.modifiedCount === 1) {
            return;
        }
    }
    throw new Error("Не удалось сохранить сессию клиента: слишком много параллельных изменений");
}

/** Вход или регистрация на новом устройстве */
export async function issueClientSession(clientId) {
    const tokens = signTokens(clientId);
    const tokenHash = hashToken(tokens.refreshToken);
    await updateSessions(clientId, (client) => ({
        sessions: addSession(client.refreshSessions, tokenHash, Date.now()),
    }));
    return tokens;
}

/**
 * Обмен refresh-токена на новую пару. Старый одиночный `Client.refreshToken` (выдан до
 * сессий по устройствам) принимается один раз и превращается в сессию.
 * @throws {RefreshRejectedError} токен недействителен — приложению нужно войти заново
 */
export async function refreshClientSession(refreshToken) {
    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.SecretKeyRefresh);
    } catch (error) {
        throw new RefreshRejectedError(error.name === "TokenExpiredError" ? "EXPIRED" : "INVALID");
    }
    const clientId = clientIdFromPayload(decoded);
    if (!clientId) {
        throw new RefreshRejectedError("INVALID");
    }
    const presentedHash = hashToken(refreshToken);
    const tokens = signTokens(clientId);
    const newHash = hashToken(tokens.refreshToken);

    await updateSessions(clientId, (client) => {
        if (client.status !== ACTIVE_CLIENT_STATUS) {
            throw new RefreshRejectedError("CLIENT_INACTIVE");
        }
        const now = Date.now();
        const match = findSession(client.refreshSessions, presentedHash, now);
        if (match) {
            return { sessions: rotateSession(client.refreshSessions, match, newHash, presentedHash, now) };
        }
        if (client.refreshToken && client.refreshToken === refreshToken) {
            return { sessions: addSession(client.refreshSessions, newHash, now), extra: { refreshToken: null } };
        }
        throw new RefreshRejectedError("UNKNOWN_SESSION");
    });
    return tokens;
}

/** Выход на одном устройстве: отзывает только его сессию. Неизвестный токен — ничего не делает. */
export async function revokeClientSession(refreshToken) {
    // Подпись не проверяем: и с просроченным токеном выход должен отозвать сессию. Удаляется
    // только сессия с хэшем этого же токена, поэтому чужую сессию так не отозвать.
    const clientId = clientIdFromPayload(jwt.decode(refreshToken));
    if (!mongoose.isValidObjectId(clientId)) {
        return;
    }
    const presentedHash = hashToken(refreshToken);
    try {
        await updateSessions(clientId, (client) => ({
            sessions: removeSession(client.refreshSessions, presentedHash),
            extra: client.refreshToken === refreshToken ? { refreshToken: null } : {},
        }));
    } catch (error) {
        if (!(error instanceof RefreshRejectedError)) {
            throw error;
        }
    }
}
