/**
 * Счётчик с фиксированным окном. Живёт в рамках одного сокета, поэтому хранить ключи не нужно.
 * @param {{ limit: number, windowMs: number, now?: () => number }} options
 * @returns {() => boolean} true, если действие разрешено
 */
export const createRateLimiter = ({ limit, windowMs, now = Date.now }) => {
    let windowStart = now();
    let count = 0;

    return () => {
        const current = now();
        if (current - windowStart >= windowMs) {
            windowStart = current;
            count = 0;
        }
        count += 1;
        return count <= limit;
    };
};

/**
 * Лимит по ключу (участнику), переживающий переподключения сокета:
 * иначе ограничение обходится reconnect'ом после каждой пачки запросов.
 * Истёкшие ключи удаляются при обращении, так что Map не растёт бесконечно.
 * @param {{ limit: number, windowMs: number, now?: () => number }} options
 * @returns {(key: string) => boolean}
 */
export const createKeyedRateLimiter = ({ limit, windowMs, now = Date.now }) => {
    /** @type {Map<string, { windowStart: number, count: number }>} */
    const windows = new Map();

    const evictExpired = (current) => {
        windows.forEach((entry, key) => {
            if (current - entry.windowStart >= windowMs) windows.delete(key);
        });
    };

    return (key) => {
        const current = now();
        evictExpired(current);

        const entry = windows.get(key) ?? { windowStart: current, count: 0 };
        entry.count += 1;
        windows.set(key, entry);
        return entry.count <= limit;
    };
};
