/**
 * Получает текущую дату в формате YYYY-MM-DD для часового пояса Алматы
 */
export function getTodayAlmaty() {
    const now = new Date();
    // Добавляем 6 часов для перевода UTC в время Алматы (UTC+6)
    const almatyTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
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
    // Алматы UTC+6
    const almatyTime = new Date(dt.getTime() + (6 * 60 * 60 * 1000));
    return almatyTime.toISOString().split('T')[0];
} 