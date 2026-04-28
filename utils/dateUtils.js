/**
 * Получает текущую дату в формате YYYY-MM-DD для часового пояса Алматы
 */
export function getTodayAlmaty() {
    const now = new Date();
    // Казахстан (Алматы): UTC+5
    const almatyTime = new Date(now.getTime() + (5 * 60 * 60 * 1000));
    return almatyTime.toISOString().split('T')[0];
}

/**
 * Получает дату в формате YYYY-MM-DD для часового пояса Алматы
 */
export function getDateAlmaty(date = null) {
    let dt;
    if (date) {
        dt = (date instanceof Date) ? date : new Date(date);
    } else {
        dt = new Date();
    }
    const almatyTime = new Date(dt.getTime() + (5 * 60 * 60 * 1000));
    return almatyTime.toISOString().split('T')[0];
}

/**
 * Текущий час (0–23) в логике «Алматы», согласованно с getDateAlmaty (UTC+5).
 */
export function getHourAlmaty(date = null) {
    let dt;
    if (date) {
        dt = date instanceof Date ? date : new Date(date);
    } else {
        dt = new Date();
    }
    const almatyTime = new Date(dt.getTime() + (5 * 60 * 60 * 1000));
    return almatyTime.getUTCHours();
}