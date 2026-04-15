/**
 * Пытается извлечь последние 4 цифры карты из тела callback Pay Plus (набор типичных полей).
 */
export function extractPayplusCardLast4(data) {
    if (!data || typeof data !== "object") return null;

    const directKeys = [
        "co_card_last4",
        "co_last4",
        "card_last4",
        "pan_last_4",
        "co_pan_last4",
        "last_4",
        "co_card_pan",
        "card_pan",
    ];
    for (const k of directKeys) {
        const v = data[k];
        if (v == null || v === "") continue;
        const digits = String(v).replace(/\D/g, "");
        if (digits.length >= 4) return digits.slice(-4);
    }

    const mask = data.co_card_mask || data.card_mask || data.masked_pan;
    if (mask) {
        const digits = String(mask).replace(/\D/g, "");
        if (digits.length >= 4) return digits.slice(-4);
    }

    return null;
}
