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
