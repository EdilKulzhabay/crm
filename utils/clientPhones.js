import {
    buildPhoneSuffixRegex,
    normalizePhoneForWhatsApp,
    phonesMatch,
} from "../whatsApp/normalizePhone.js";

/**
 * Дополнительные номера клиента (Client.additionalPhones).
 * Вход в приложение возможен с любого номера клиента: код приходит на введённый номер.
 * Основной номер (Client.phone) остаётся как есть — на него завязаны счета, звонки и CRM.
 */

export const MAX_ADDITIONAL_PHONES = 5;
const KZ_PHONE_LENGTH = 11;
const PHONE_LOOKUP_LIMIT = 200;

export class ClientPhonesError extends Error {}

/**
 * Проверяет и нормализует список дополнительных номеров к виду 7XXXXXXXXXX.
 * Убирает дубли и совпадения с основным номером.
 * @param {unknown} rawPhones
 * @param {string | undefined} primaryPhone
 * @returns {string[]}
 * @throws {ClientPhonesError}
 */
export function normalizeAdditionalPhones(rawPhones, primaryPhone) {
    if (!Array.isArray(rawPhones)) {
        throw new ClientPhonesError("Список номеров должен быть массивом");
    }
    const primary = normalizePhoneForWhatsApp(primaryPhone);
    const unique = new Set();
    for (const raw of rawPhones) {
        const phone = normalizePhoneForWhatsApp(raw);
        if (!phone || phone.length !== KZ_PHONE_LENGTH) {
            throw new ClientPhonesError(`Некорректный номер телефона: ${String(raw ?? "")}`);
        }
        if (phone !== primary) unique.add(phone);
    }
    if (unique.size > MAX_ADDITIONAL_PHONES) {
        throw new ClientPhonesError(`Можно добавить не больше ${MAX_ADDITIONAL_PHONES} дополнительных номеров`);
    }
    return [...unique];
}

/**
 * Фильтр-кандидат по последним 10 цифрам в основном и дополнительных номерах.
 * Номера в БД хранятся в разном форматировании, поэтому точное совпадение проверяет clientHasPhone.
 * @param {string} phoneNorm
 */
export function buildClientPhoneFilter(phoneNorm) {
    const pattern = { $regex: buildPhoneSuffixRegex(phoneNorm.slice(-10)), $options: "i" };
    return { $or: [{ phone: pattern }, { additionalPhones: pattern }] };
}

/**
 * @param {{ phone?: string, additionalPhones?: string[] }} client
 * @param {string} phoneNorm
 * @returns {boolean}
 */
export function clientHasPhone(client, phoneNorm) {
    return [client.phone, ...(client.additionalPhones || [])].some((p) => phonesMatch(p, phoneNorm));
}

/**
 * Ищет клиента, у которого номер — основной или дополнительный.
 * @param {import("mongoose").Model} ClientModel
 * @param {unknown} rawPhone
 * @param {{ excludeClientId?: unknown }} [options]
 */
export async function findClientByAnyPhone(ClientModel, rawPhone, { excludeClientId } = {}) {
    const phoneNorm = normalizePhoneForWhatsApp(rawPhone);
    if (!phoneNorm) return null;
    const filter = buildClientPhoneFilter(phoneNorm);
    if (excludeClientId) filter._id = { $ne: excludeClientId };
    const candidates = await ClientModel.find(filter).limit(PHONE_LOOKUP_LIMIT);
    return candidates.find((c) => clientHasPhone(c, phoneNorm)) || null;
}
