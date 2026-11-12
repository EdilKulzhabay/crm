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

/** E.164 без «+»: код страны не с нуля, всего 8–15 цифр */
const INTERNATIONAL_DIGITS = /^[1-9]\d{7,14}$/;
const KZ_PHONE_LENGTH = 11;

/**
 * Номер, на который можно отправить код входа/регистрации:
 * +7 — ровно 11 цифр (Казахстан/Россия), другие страны — по формату E.164.
 * @param {string | null} phoneNorm результат normalizePhoneForWhatsApp
 */
export function isValidAuthPhone(phoneNorm) {
    if (!phoneNorm) return false;
    if (phoneNorm.startsWith("7")) return phoneNorm.length === KZ_PHONE_LENGTH;
    return INTERNATIONAL_DIGITS.test(phoneNorm);
}

/**
 * Нормализация номера для WhatsApp (Meta): только цифры, формат 7XXXXXXXXXX (11 цифр для KZ/RU);
 * номер другой страны с «+» — цифры в международном формате (например 447946000958).
 */
export function normalizePhoneForWhatsApp(raw) {
    if (raw == null || raw === "") return null;
    const text = String(raw).trim();
    let d = text.replace(/\D/g, "");
    // Номер другой страны в международном формате («+44 20 7946 0958»): казахстанские
    // правила (8→7, 10 цифр → +7) к нему не применяем, иначе испортим код страны.
    // «+8 7XX…» из 11 цифр — опечатка казахстанского номера, её оставляем старым правилам.
    const isKzTypo = d.length === 11 && d.startsWith("8");
    if (text.startsWith("+") && !d.startsWith("7") && !isKzTypo) {
        return INTERNATIONAL_DIGITS.test(d) ? d : null;
    }
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

/**
 * Строит regex для поиска номера в БД independent от форматирования (пробелы/скобки/дефисы
 * между цифрами: "+7 (747) 531-55-58" и т.п.) — между каждой цифрой допускаются любые
 * не-цифровые символы, иначе прямой $regex по цифровой подстроке не находит отформатированные номера.
 */
export function buildPhoneSuffixRegex(digitsOnly) {
    return String(digitsOnly).split("").join("\\D*");
}
