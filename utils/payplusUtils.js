/**
 * Pay Plus (Payplus) — утилиты для подписи и верификации
 * API по умолчанию: https://ventrapay.net | Документация: https://payplus.kz/docs/en/
 *
 * Подпись: sort(params) + secretKey, concat через ":", MD5, Base64
 */

import crypto from "crypto";

/**
 * Генерация подписи для запроса (Deposit iframe)
 * Поля для подписи: merchant, order, amount, currency
 */
export function buildPaymentFormSign(params, secretKey) {
    const signFields = ["merchant", "order", "amount", "currency"];
    const dataSet = {};
    for (const k of signFields) {
        if (params[k] !== undefined && params[k] !== null) {
            dataSet[k] = String(params[k]);
        }
    }
    const sorted = Object.keys(dataSet).sort();
    const values = sorted.map((k) => dataSet[k]);
    values.push(secretKey);
    const signString = values.join(":");
    const hash = crypto.createHash("md5").update(signString).digest();
    return hash.toString("base64");
}

/**
 * Верификация подписи callback от Payplus
 * Все поля с префиксом co_ сортируются, добавляется secretKey
 */
export function verifyCallbackSign(callbackData, secretKey) {
    const coFields = {};
    for (const [k, v] of Object.entries(callbackData)) {
        if (k.startsWith("co_") && k !== "co_sign" && v != null) {
            coFields[k] = String(v);
        }
    }
    const sorted = Object.keys(coFields).sort();
    const values = sorted.map((k) => coFields[k]);
    values.push(secretKey);
    const signString = values.join(":");
    const hash = crypto.createHash("md5").update(signString).digest();
    const calcSign = hash.toString("base64");
    const receivedSign = callbackData.co_sign || callbackData.sign;
    return calcSign === receivedSign;
}
