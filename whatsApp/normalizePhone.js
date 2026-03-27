/** Маска для логов: без полного номера */
export function maskPhoneForLog(digits) {
    const s = digits == null ? "" : String(digits).replace(/\D/g, "");
    if (s.length < 4) return "***";
    return `${s.slice(0, 1)}***${s.slice(-4)}`;
}

/** Маска email для логов */
export function maskEmailForLog(email) {
    if (email == null || email === "") return "***";
    const m = String(email);
    const at = m.indexOf("@");
    if (at < 1) return "***";
    return `${m[0]}***${m.slice(at)}`;
}

/**
 * Нормализация номера для WhatsApp (Meta): только цифры, формат 7XXXXXXXXXX (11 цифр для KZ/RU).
 */
export function normalizePhoneForWhatsApp(raw) {
    if (raw == null || raw === "") return null;
    let d = String(raw).replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("8")) {
        d = "7" + d.slice(1);
    }
    if (d.length === 10) {
        d = "7" + d;
    }
    if (d.length === 11 && d.startsWith("7")) {
        return d;
    }
    return d.length >= 10 ? d : null;
}

/**
 * Сравнение номеров с учётом разного форматирования в БД.
 */
export function phonesMatch(stored, normalizedTarget) {
    const a = normalizePhoneForWhatsApp(stored);
    const b = normalizePhoneForWhatsApp(normalizedTarget);
    if (!a || !b) return false;
    return a === b;
}
