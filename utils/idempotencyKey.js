import crypto from "crypto";
import { fileURLToPath } from "url";

/**
 * Генерирует ключ идемпотентности — уникальная строка для пометки запроса,
 * чтобы при повторной отправке не выполнять ту же операцию дважды.
 * Формат: UUID v4 (RFC 9562).
 *
 * @returns {string}
 */
export function generateIdempotencyKey() {
    return crypto.randomUUID();
}

/**
 * Альтернатива: случайная hex-строка фиксированной длины (по умолчанию 32 символа = 16 байт).
 *
 * @param {number} [byteLength=16]
 * @returns {string}
 */
export function generateIdempotencyKeyHex(byteLength = 16) {
    return crypto.randomBytes(byteLength).toString("hex");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    console.log(generateIdempotencyKey());
}
