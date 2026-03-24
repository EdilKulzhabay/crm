import path from "path";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;

/** Версия WA Web (должна совпадать с архивом wppconnect / см. whatsapp-web.js DefaultOptions) */
const DEFAULT_WEB_VERSION = "2.3000.1017054665";

/** Папка сессии относительно корня CRM (или WWEBJS_AUTH_PATH в .env) */
function getAuthDataPath() {
    if (process.env.WWEBJS_AUTH_PATH) {
        return path.isAbsolute(process.env.WWEBJS_AUTH_PATH)
            ? process.env.WWEBJS_AUTH_PATH
            : path.join(process.cwd(), process.env.WWEBJS_AUTH_PATH);
    }
    return path.join(process.cwd(), ".wwebjs_auth");
}

let clientPromise = null;

/**
 * Запускает браузер и WhatsApp Web. При первом входе в консоли появится QR-код.
 * Сессия сохраняется в папке .wwebjs_auth (см. WWEBJS_AUTH_PATH).
 * @returns {Promise<import('whatsapp-web.js').Client>}
 */
export function startWhatsAppWebClient() {
    if (clientPromise) {
        return clientPromise;
    }

    clientPromise = new Promise((resolve, reject) => {
        const puppeteerOpts = {
            headless: true,
            defaultViewport: null,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
                "--window-size=1920,1080",
            ],
        };
        // Системный Chrome/Chromium (рекомендуется на сервере): PUPPETEER_EXECUTABLE_PATH
        if (process.env.PUPPETEER_EXECUTABLE_PATH?.trim()) {
            puppeteerOpts.executablePath =
                process.env.PUPPETEER_EXECUTABLE_PATH.trim();
        }

        const client = new Client({
            authStrategy: new LocalAuth({
                dataPath: getAuthDataPath(),
                clientId: process.env.WWEBJS_CLIENT_ID || "tibetskaya-crm",
            }),
            // Стабильная подгрузка index.html под версию WA Web (меньше срывов inject при навигации)
            webVersion: process.env.WWEBJS_WEB_VERSION || DEFAULT_WEB_VERSION,
            webVersionCache: {
                type: "remote",
                remotePath:
                    process.env.WWEBJS_WEB_VERSION_REMOTE_PATH ||
                    "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html",
            },
            // Дольше ждём загрузку после скана QR (слабый VPS / долгий первый старт)
            authTimeoutMs:
                Number(process.env.WWEBJS_AUTH_TIMEOUT_MS) || 180000,
            qrMaxRetries: Number(process.env.WWEBJS_QR_MAX_RETRIES) || 5,
            takeoverOnConflict:
                process.env.WWEBJS_TAKEOVER_ON_CONFLICT !== "false",
            takeoverTimeoutMs:
                Number(process.env.WWEBJS_TAKEOVER_TIMEOUT_MS) || 15000,
            bypassCSP: true,
            userAgent:
                process.env.WWEBJS_USER_AGENT ||
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            puppeteer: puppeteerOpts,
        });

        client.on("qr", (qr) => {
            console.log(
                "\n========== WhatsApp Web: отсканируйте QR в приложении WhatsApp ==========\n"
            );
            qrcode.generate(qr, { small: true });
            console.log(
                "\nТелефон → Настройки → Связанные устройства → Привязка устройства\n"
            );
        });

        client.on("loading_screen", (percent, message) => {
            console.log(`[WhatsApp Web] Загрузка: ${percent}% — ${message || ""}`);
        });

        client.on("authenticated", () => {
            console.log("[WhatsApp Web] Аутентификация успешна, сессия сохранена");
        });

        client.on("ready", () => {
            console.log("[WhatsApp Web] Клиент готов, можно отправлять сообщения");
            resolve(client);
        });

        client.on("auth_failure", (msg) => {
            console.error("[WhatsApp Web] Ошибка авторизации:", msg);
            clientPromise = null;
            reject(new Error(String(msg)));
        });

        client.on("disconnected", (reason) => {
            console.warn("[WhatsApp Web] Соединение разорвано:", reason);
            clientPromise = null;
        });

        client.initialize().catch((err) => {
            console.error("[WhatsApp Web] initialize:", err);
            clientPromise = null;
            reject(err);
        });
    });

    return clientPromise;
}

/**
 * Ожидание готовности с таймаутом (пока не отсканирован QR).
 */
export async function sendWhatsAppText(phoneDigits, text) {
    const timeoutMs = Number(process.env.WHATSAPP_READY_TIMEOUT_MS) || 300000;

    const client = await Promise.race([
        startWhatsAppWebClient(),
        new Promise((_, reject) =>
            setTimeout(
                () =>
                    reject(
                        new Error(
                            "Таймаут ожидания WhatsApp: отсканируйте QR в консоли сервера или проверьте WWEBJS_AUTH_PATH"
                        )
                    ),
                timeoutMs
            )
        ),
    ]);

    const jid = `${phoneDigits}@c.us`;
    await client.sendMessage(jid, text);
}

/**
 * Корректное завершение (например при остановке процесса).
 */
export async function shutdownWhatsAppWeb() {
    if (!clientPromise) return;
    try {
        const client = await Promise.race([
            clientPromise,
            new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);
        if (client && typeof client.destroy === "function") {
            await client.destroy();
        }
    } catch {
        /* ignore */
    }
    clientPromise = null;
}
