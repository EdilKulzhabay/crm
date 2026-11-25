import Client from "../Models/Client.js";
import Partner from "../Models/Partner.js";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomPart(len) {
    let s = "";
    for (let i = 0; i < len; i++) {
        s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    }
    return s;
}

const CODE_LENGTH = 12;
/** Код в тексте: три группы по 4 латинские буквы/цифры через дефис, не внутри более длинного слова */
const CODE_IN_TEXT = /(?<![A-Z0-9])[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}(?![A-Z0-9])/;

const formatCode = (chars) => `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;

/**
 * Реферальный код (клиента или партнёра): 12 латинских букв и/или цифр → XXXX-XXXX-XXXX.
 * Приложения разрешают вставить пересланное приглашение целиком, а в нём есть и другие цифры
 * («1.», ссылки) — поэтому сначала ищем код в формате с дефисами, иначе берём все буквы и цифры ввода.
 * Сгенерированные коды по-прежнему только из букв; цифры появляются, когда код задаёт суперадмин.
 */
export function normalizeReferralCodeInput(raw) {
    if (!raw || typeof raw !== "string") {
        return null;
    }
    const upper = raw.toUpperCase();
    const found = upper.match(CODE_IN_TEXT);
    if (found) {
        return found[0];
    }
    const chars = upper.replace(/[^A-Z0-9]/g, "");
    return chars.length === CODE_LENGTH ? formatCode(chars) : null;
}

/** Код только из латинских букв (купоны на мойку): 12 букв → XXXX-XXXX-XXXX */
export function normalizeLetterCodeInput(raw) {
    if (!raw || typeof raw !== "string") {
        return null;
    }
    const letters = raw.replace(/[^A-Za-z]/g, "").toUpperCase();
    return letters.length === CODE_LENGTH ? formatCode(letters) : null;
}

function randomReferralCode() {
    return `${randomPart(4)}-${randomPart(4)}-${randomPart(4)}`;
}

export async function generateUniqueReferralCode() {
    for (let attempt = 0; attempt < 100; attempt++) {
        const code = randomReferralCode();
        const exists = await Client.exists({ referralCode: code });
        if (!exists) {
            return code;
        }
    }
    throw new Error("Не удалось сгенерировать уникальный реферальный код");
}

/**
 * Код партнёра в том же формате, что и клиентский, и уникален в обеих коллекциях —
 * чтобы позже клиентская регистрация могла принимать любой из них в одном поле.
 */
export async function generateUniquePartnerReferralCode() {
    for (let attempt = 0; attempt < 100; attempt++) {
        const code = randomReferralCode();
        const [clientHasCode, partnerHasCode] = await Promise.all([
            Client.exists({ referralCode: code }),
            Partner.exists({ referralCode: code }),
        ]);
        if (!clientHasCode && !partnerHasCode) {
            return code;
        }
    }
    throw new Error("Не удалось сгенерировать уникальный код партнёра");
}
