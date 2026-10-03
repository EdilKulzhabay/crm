export const CALL_ERROR_CODES = Object.freeze({
    VALIDATION: "VALIDATION",
    ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
    CALL_NOT_ALLOWED: "CALL_NOT_ALLOWED",
    BUSY: "BUSY",
    CALL_NOT_FOUND: "CALL_NOT_FOUND",
    INVALID_STATE: "INVALID_STATE",
    RATE_LIMITED: "RATE_LIMITED",
    INTERNAL: "INTERNAL",
});

export class CallError extends Error {
    /**
     * @param {keyof typeof CALL_ERROR_CODES} code
     * @param {string} message сообщение, безопасное для показа пользователю
     */
    constructor(code, message) {
        super(message);
        this.name = "CallError";
        this.code = code;
    }
}

/**
 * Приводит любую ошибку к виду для ack-ответа, не раскрывая внутренние детали.
 * @param {unknown} error
 * @returns {{ code: string, message: string }}
 */
export const toPublicError = (error) => {
    if (error instanceof CallError) {
        return { code: error.code, message: error.message };
    }
    return { code: CALL_ERROR_CODES.INTERNAL, message: "Внутренняя ошибка сервера" };
};
