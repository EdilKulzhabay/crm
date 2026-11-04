const ALMATY_UTC_OFFSET = "+05:00";
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Превращает календарные дни Алматы (ГГГГ-ММ-ДД) в границы для запроса по Date-полю.
 * Без явного смещения даты парсились бы в часовом поясе сервера и захватывали чужие часы.
 * @param {unknown} startDay
 * @param {unknown} endDay
 * @returns {{ start: Date, end: Date } | null} null — даты не заданы, некорректны или идут в обратном порядке
 */
export function parseAlmatyDayRange(startDay, endDay) {
    if (!DAY_PATTERN.test(String(startDay)) || !DAY_PATTERN.test(String(endDay))) {
        return null;
    }
    const start = new Date(`${startDay}T00:00:00.000${ALMATY_UTC_OFFSET}`);
    const end = new Date(`${endDay}T23:59:59.999${ALMATY_UTC_OFFSET}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return null;
    }
    return { start, end };
}
