/**
 * Ссылка на точку в 2ГИС, которую админ вставляет в карточку мойки.
 * Клиентское приложение открывает её по нажатию на адрес, поэтому принимаем
 * только http(s) на доменах 2ГИС: никаких javascript:, чужих сайтов и фишинга.
 * Примеры: https://2gis.kz/almaty/firm/70000001234567, https://go.2gis.com/abcd1
 */
export const TWO_GIS_URL_MAX_LENGTH = 500;
const TWO_GIS_HOST = /^(?:[a-z0-9-]+\.)*2gis\.(?:kz|ru|com|kg|uz|ae|az|am|ge|by)$/;

/** @returns {string | null} "" — ссылки нет; null — ссылка некорректна; иначе нормализованный URL */
export function normalizeTwoGisUrl(value) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return "";
    if (text.length > TWO_GIS_URL_MAX_LENGTH) return null;
    let url;
    try {
        url = new URL(text);
    } catch {
        return null;
    }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    if (!TWO_GIS_HOST.test(url.hostname.toLowerCase())) return null;
    url.protocol = "https:";
    return url.toString();
}
