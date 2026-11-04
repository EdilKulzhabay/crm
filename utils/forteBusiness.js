import axios from "axios";

/**
 * Клиент ForteBusiness API (fincore): выписка и баланс расчётного счёта компании.
 * Документация: «API ver 4.docx» и fincoreapi.json. Используем только чтение — переводы не отправляем.
 *
 * Особенности, проверенные на боевом шлюзе (02.11.2026):
 * - ключ шлюза передаётся в заголовке X-Gravitee-Api-Key (без него /auth/login отвечает 401);
 * - токен живёт 10 минут, срок берём из JWT exp;
 * - даты в /account-history строго dd.mm.yyyy, иначе 404 «incorrect dateFrom format»;
 * - страницы /account-history нумеруются с 0.
 */

const DEFAULT_BASE_URL = "https://gravitee-api-gateway.forte.kz/fincore";
const API_KEY_HEADER = "X-Gravitee-Api-Key";
const REQUEST_TIMEOUT_MS = 20_000;
/** Обновляем токен заранее, чтобы он не истёк посреди постраничной загрузки */
const TOKEN_REFRESH_MARGIN_MS = 60_000;
/** Если в токене нет exp — считаем, что он живёт как задокументировано (10 мин) */
const FALLBACK_TOKEN_TTL_MS = 10 * 60_000;
export const HISTORY_PAGE_SIZE = 100;
/** Защита от бесконечного цикла, если банк вернёт неверный total */
const MAX_HISTORY_PAGES = 50;
const ALMATY_TZ = "Asia/Almaty";

export class ForteBusinessError extends Error {
    /** @param {string} message @param {{ status?: number }} [details] */
    constructor(message, { status } = {}) {
        super(message);
        this.name = "ForteBusinessError";
        this.status = status;
    }
}

/**
 * @typedef {{ baseUrl: string, clientId: number, clientSecret: string, apiKey: string, accountNumber: string }} ForteBusinessConfig
 */

/**
 * Настройки из env. null — интеграция не настроена (сверка с выпиской отключена).
 * @param {Record<string, string | undefined>} [env]
 * @returns {ForteBusinessConfig | null}
 */
export function readForteBusinessConfig(env = process.env) {
    const clientId = Number(env.FORTE_BUSINESS_CLIENT_ID);
    const clientSecret = env.FORTE_BUSINESS_CLIENT_SECRET?.trim();
    const apiKey = env.FORTE_BUSINESS_API_KEY?.trim();
    const accountNumber = env.FORTE_BUSINESS_ACCOUNT?.trim();
    if (!Number.isInteger(clientId) || clientId <= 0 || !clientSecret || !apiKey || !accountNumber) {
        return null;
    }
    return {
        baseUrl: (env.FORTE_BUSINESS_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ""),
        clientId,
        clientSecret,
        apiKey,
        accountNumber,
    };
}

const forteDateFormat = new Intl.DateTimeFormat("ru-RU", {
    timeZone: ALMATY_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
});

/** Дата для fincore: dd.mm.yyyy по Алматы */
export function formatForteDate(date) {
    return forteDateFormat.format(date);
}

/** Время истечения JWT в мс; null — не JWT или нет exp */
function readJwtExpiryMs(token) {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        return Number.isFinite(payload?.exp) ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
}

function describeError(status, data) {
    const message = typeof data === "object" && data ? data.message || data.error : data;
    return `ForteBusiness ${status}: ${String(message || "ошибка запроса").slice(0, 200)}`;
}

/**
 * @param {ForteBusinessConfig} config
 * @param {{ http?: { request: Function }, now?: () => number }} [deps]
 */
export function createForteBusinessClient(config, { http = axios, now = Date.now } = {}) {
    let token = null;
    let tokenExpiresAt = 0;
    let pendingLogin = null;

    const send = (method, path, { params, data, authToken } = {}) =>
        http.request({
            method,
            url: config.baseUrl + path,
            params,
            data,
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
                "Content-Type": "application/json",
                [API_KEY_HEADER]: config.apiKey,
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            validateStatus: () => true,
        });

    async function login() {
        const res = await send("POST", "/auth/login", {
            data: { clientId: config.clientId, clientSecret: config.clientSecret },
        });
        const newToken = res.data?.token;
        if (res.status !== 200 || typeof newToken !== "string" || !newToken) {
            throw new ForteBusinessError(describeError(res.status, res.data), { status: res.status });
        }
        token = newToken;
        tokenExpiresAt = (readJwtExpiryMs(newToken) ?? now() + FALLBACK_TOKEN_TTL_MS) - TOKEN_REFRESH_MARGIN_MS;
        return token;
    }

    /** Один вход на все параллельные запросы */
    function getToken() {
        if (token && now() < tokenExpiresAt) return Promise.resolve(token);
        pendingLogin ??= login().finally(() => {
            pendingLogin = null;
        });
        return pendingLogin;
    }

    async function authorizedGet(path, params) {
        for (let attempt = 0; attempt < 2; attempt++) {
            const res = await send("GET", path, { params, authToken: await getToken() });
            if (res.status === 401 && attempt === 0) {
                token = null; // банк мог отозвать токен раньше срока — входим заново один раз
                continue;
            }
            if (res.status !== 200) {
                throw new ForteBusinessError(describeError(res.status, res.data), { status: res.status });
            }
            return res.data;
        }
        throw new ForteBusinessError("ForteBusiness: повторная авторизация не помогла", { status: 401 });
    }

    return {
        accountNumber: config.accountNumber,

        /** @returns {Promise<number>} остаток на счёте */
        async getAccountBalance() {
            const data = await authorizedGet("/account-balance", { accountNumber: config.accountNumber });
            return Number(data?.balance);
        },

        /**
         * Все операции по счёту за период (обе стороны), постранично.
         * @param {{ from: Date, to: Date }} period
         * @returns {Promise<object[]>}
         */
        async listAccountHistory({ from, to }) {
            const all = [];
            // Страницы нумеруются с 0 (проверено на боевом API; в документации не указано)
            for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
                const data = await authorizedGet("/account-history", {
                    accountNumber: config.accountNumber,
                    dateFrom: formatForteDate(from),
                    dateTo: formatForteDate(to),
                    page,
                    size: HISTORY_PAGE_SIZE,
                });
                const list = Array.isArray(data?.list) ? data.list : [];
                all.push(...list);
                const total = Number(data?.total) || 0;
                if (list.length === 0 || all.length >= total) return all;
            }
            throw new ForteBusinessError(`ForteBusiness: выписка длиннее ${MAX_HISTORY_PAGES} страниц`);
        },
    };
}

/** Входящая и не удалённая операция по нашему счёту */
export function isIncomingTransaction(tx, accountNumber) {
    if (Number(tx?.isCredit) !== 1 || Number(tx?.isDeleted) === 1) return false;
    if (!(Number(tx?.amount) > 0)) return false;
    return !tx.receiverAccount || tx.receiverAccount === accountNumber;
}
