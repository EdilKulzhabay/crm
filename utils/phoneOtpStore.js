import crypto from "crypto";

const DEFAULTS = Object.freeze({
    codeLength: 6,
    codeTtlMs: 5 * 60 * 1000,
    cooldownMs: 60 * 1000,
    maxAttempts: 5,
    verificationTtlMs: 15 * 60 * 1000,
    /** Неверные вводы по телефону суммарно по всем кодам — защита от перебора через повторные запросы */
    failureWindowMs: 60 * 60 * 1000,
    maxFailuresPerWindow: 10,
});

export const OTP_VERIFY_RESULT = Object.freeze({
    OK: "ok",
    INVALID: "invalid",
    EXPIRED: "expired",
    MISSING: "missing",
    TOO_MANY_ATTEMPTS: "too_many_attempts",
});

function randomNumericCode(length) {
    return String(crypto.randomInt(0, 10 ** length)).padStart(length, "0");
}

function safeEqual(a, b) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * In-memory хранилище одноразовых кодов по телефону.
 * Помимо лимита попыток на один код, считает неверные вводы по телефону за окно
 * failureWindowMs: без этого можно было бы перебирать код, запрашивая новый раз в минуту.
 *
 * Почему не переиспользуем словари из MobileController: там у кода нет срока жизни
 * и лимита попыток (6 цифр перебираются), а сами словари общие для всех клиентских
 * сценариев. Здесь коды разделены по назначению (purpose), живут codeTtlMs и
 * сгорают после maxAttempts неверных вводов.
 *
 * Ограничение: состояние живёт в памяти процесса — как и у клиентских OTP.
 * При запуске нескольких инстансов (PM2 cluster) его нужно вынести в Redis.
 *
 * @param {{now?: () => number, generateCode?: (length: number) => string} & Partial<typeof DEFAULTS>} options
 */
export function createPhoneOtpStore(options = {}) {
    const config = { ...DEFAULTS, ...options };
    const now = options.now ?? (() => Date.now());
    const generateCode = options.generateCode ?? randomNumericCode;

    const codes = new Map(); // `${purpose}:${phone}` -> { code, expiresAt, attempts }
    const lastSentAt = new Map(); // `${purpose}:${phone}` -> timestamp
    const sendingInProgress = new Set(); // `${purpose}:${phone}`
    const verifiedAt = new Map(); // `${purpose}:${phone}` -> timestamp
    const failures = new Map(); // phone -> { count, windowStart }

    const key = (purpose, phone) => `${purpose}:${phone}`;

    function sweepExpired() {
        const current = now();
        for (const [k, entry] of codes) {
            if (entry.expiresAt <= current) codes.delete(k);
        }
        for (const [k, sentAt] of lastSentAt) {
            if (current - sentAt >= config.cooldownMs) lastSentAt.delete(k);
        }
        for (const [phone, entry] of failures) {
            if (current - entry.windowStart >= config.failureWindowMs) failures.delete(phone);
        }
        for (const [k, at] of verifiedAt) {
            if (current - at > config.verificationTtlMs) verifiedAt.delete(k);
        }
    }

    /** Секунд до снятия блокировки по неверным вводам или 0, если телефон не заблокирован. */
    function lockedForSec(phone) {
        const entry = failures.get(phone);
        if (!entry) return 0;
        const elapsed = now() - entry.windowStart;
        if (elapsed >= config.failureWindowMs) {
            failures.delete(phone);
            return 0;
        }
        return entry.count >= config.maxFailuresPerWindow
            ? Math.ceil((config.failureWindowMs - elapsed) / 1000)
            : 0;
    }

    function recordFailure(phone) {
        const entry = failures.get(phone);
        if (!entry || now() - entry.windowStart >= config.failureWindowMs) {
            failures.set(phone, { count: 1, windowStart: now() });
        } else {
            failures.set(phone, { ...entry, count: entry.count + 1 });
        }
    }

    /** Можно ли сейчас отправить код. null — можно, иначе причина отказа. */
    function checkSendAllowed(purpose, phone) {
        const lockedSec = lockedForSec(phone);
        if (lockedSec > 0) {
            return { reason: "locked", retryAfterSec: lockedSec };
        }
        const k = key(purpose, phone);
        if (sendingInProgress.has(k)) {
            return { reason: "in_progress", retryAfterSec: 0 };
        }
        const sentAt = lastSentAt.get(k);
        const elapsed = sentAt == null ? Infinity : now() - sentAt;
        if (elapsed < config.cooldownMs) {
            return {
                reason: "cooldown",
                retryAfterSec: Math.ceil((config.cooldownMs - elapsed) / 1000),
            };
        }
        return null;
    }

    /** Создаёт новый код (прежний код того же назначения перестаёт действовать) и блокирует параллельную отправку. */
    function issue(purpose, phone) {
        sweepExpired();
        const code = generateCode(config.codeLength);
        codes.set(key(purpose, phone), {
            code,
            expiresAt: now() + config.codeTtlMs,
            attempts: 0,
        });
        lastSentAt.set(key(purpose, phone), now());
        sendingInProgress.add(key(purpose, phone));
        return code;
    }

    /** Отправка завершилась. При неудаче код аннулируется, а cooldown снимается. */
    function finishSend(purpose, phone, { delivered }) {
        sendingInProgress.delete(key(purpose, phone));
        if (!delivered) {
            codes.delete(key(purpose, phone));
            lastSentAt.delete(key(purpose, phone));
        }
    }

    function verify(purpose, phone, code) {
        const k = key(purpose, phone);
        if (lockedForSec(phone) > 0) {
            codes.delete(k);
            return OTP_VERIFY_RESULT.TOO_MANY_ATTEMPTS;
        }
        const entry = codes.get(k);
        if (!entry) return OTP_VERIFY_RESULT.MISSING;
        if (entry.expiresAt <= now()) {
            codes.delete(k);
            return OTP_VERIFY_RESULT.EXPIRED;
        }
        if (safeEqual(entry.code, code)) {
            codes.delete(k);
            return OTP_VERIFY_RESULT.OK;
        }
        recordFailure(phone);
        const attempts = entry.attempts + 1;
        if (attempts >= config.maxAttempts || lockedForSec(phone) > 0) {
            codes.delete(k);
            return OTP_VERIFY_RESULT.TOO_MANY_ATTEMPTS;
        }
        codes.set(k, { ...entry, attempts });
        return OTP_VERIFY_RESULT.INVALID;
    }

    /** Отмечает телефон подтверждённым для следующего шага (например, регистрации). */
    function markVerified(purpose, phone) {
        verifiedAt.set(key(purpose, phone), now());
    }

    function isVerified(purpose, phone) {
        const k = key(purpose, phone);
        const at = verifiedAt.get(k);
        if (at == null) return false;
        if (now() - at > config.verificationTtlMs) {
            verifiedAt.delete(k);
            return false;
        }
        return true;
    }

    function clearVerified(purpose, phone) {
        verifiedAt.delete(key(purpose, phone));
    }

    return {
        checkSendAllowed,
        issue,
        finishSend,
        verify,
        markVerified,
        isVerified,
        clearVerified,
    };
}
