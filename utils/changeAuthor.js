/** Кто и зачем вносит ручное изменение в CRM (как у баланса клиента, Models/ClientOperationLog.js) */
export const CHANGE_AUTHOR_MAX_LENGTH = 300;
export const CHANGE_AUTHOR_REQUIRED_MESSAGE = "Укажите, кто вносит изменение и по какой причине";

/** @returns {{ changedBy: string, reason: string } | null} null — поля пустые или слишком длинные */
export function readChangeAuthor(body) {
    const changedBy = typeof body?.changedBy === "string" ? body.changedBy.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!changedBy || !reason) return null;
    if (changedBy.length > CHANGE_AUTHOR_MAX_LENGTH || reason.length > CHANGE_AUTHOR_MAX_LENGTH) return null;
    return { changedBy, reason };
}
