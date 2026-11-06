/**
 * Счётчик неудачных попыток в памяти процесса (как utils/phoneOtpStore.js — один инстанс).
 * После maxFailures неудач за windowMs ключ блокируется до конца окна.
 * Используется для входа в кабинет мойки (по телефону) и ввода кода купона (по сотруднику):
 * код вводится вручную, и без лимита его можно было бы подбирать.
 */
/** Выше этого числа ключей при новой неудаче удаляем истёкшие — перебор разных телефонов не раздувает память */
const PRUNE_THRESHOLD = 10_000;

export function createAttemptLimiter({ maxFailures, windowMs, now = () => Date.now() }) {
    /** @type {Map<string, { count: number, resetAt: number }>} */
    const failures = new Map();

    const pruneExpired = () => {
        const time = now();
        for (const [key, entry] of failures) {
            if (entry.resetAt <= time) failures.delete(key);
        }
    };

    const current = (key) => {
        const entry = failures.get(key);
        if (entry && entry.resetAt <= now()) {
            failures.delete(key);
            return null;
        }
        return entry ?? null;
    };

    return {
        /** @returns {number} секунд до разблокировки; 0 — можно пробовать */
        retryAfterSeconds(key) {
            const entry = current(key);
            if (!entry || entry.count < maxFailures) return 0;
            return Math.ceil((entry.resetAt - now()) / 1000);
        },
        registerFailure(key) {
            if (failures.size >= PRUNE_THRESHOLD) pruneExpired();
            const entry = current(key);
            failures.set(key, entry ? { ...entry, count: entry.count + 1 } : { count: 1, resetAt: now() + windowMs });
        },
        reset(key) {
            failures.delete(key);
        },
    };
}
