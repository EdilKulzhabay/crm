import path from "path";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;

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
        const client = new Client({
            authStrategy: new LocalAuth({
                dataPath: getAuthDataPath(),
                clientId: process.env.WWEBJS_CLIENT_ID || "tibetskaya-crm",
            }),
            puppeteer: {
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--no-first-run",
                    "--no-zygote",
                    "--disable-gpu",
                ],
            },
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
