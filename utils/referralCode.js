import Client from "../Models/Client.js";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomPart(len) {
    let s = "";
    for (let i = 0; i < len; i++) {
        s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    }
    return s;
}

/**
 * Нормализация ввода: только латиница A–Z, 12 букв → формат XXXX-XXXX-XXXX
 */
export function normalizeReferralCodeInput(raw) {
    if (!raw || typeof raw !== "string") {
        return null;
    }
    const letters = raw.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (letters.length !== 12) {
        return null;
    }
    return `${letters.slice(0, 4)}-${letters.slice(4, 8)}-${letters.slice(8, 12)}`;
}

export async function generateUniqueReferralCode() {
    for (let attempt = 0; attempt < 100; attempt++) {
        const code = `${randomPart(4)}-${randomPart(4)}-${randomPart(4)}`;
        const exists = await Client.exists({ referralCode: code });
        if (!exists) {
            return code;
        }
    }
    throw new Error("Не удалось сгенерировать уникальный реферальный код");
}
