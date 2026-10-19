/** Форматирование для страниц «Партнёры» (SuperAdminPartners, SuperAdminPartnerPage) */

const tengeFormat = new Intl.NumberFormat("ru-RU");

export const formatTenge = (value) => `${tengeFormat.format(Number(value) || 0)} ₸`;

export const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

export const formatDateTime = (value) =>
    value
        ? new Date(value).toLocaleString("ru-RU", { timeZone: "Asia/Almaty", dateStyle: "short", timeStyle: "short" })
        : "—";

/** "2026-10" → "октябрь 2026" */
export const formatMonth = (month) =>
    new Date(`${month}-15T00:00:00Z`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

export const PARTNER_STATUS_LABELS = Object.freeze({ active: "Активен", blocked: "Заблокирован" });

export const VERIFICATION_LABELS = Object.freeze({ waiting: "На проверке", verified: "Подтверждён", denied: "Отклонён" });
export const VERIFICATION_CLASSES = Object.freeze({ waiting: "text-yellow-400", verified: "text-green-400", denied: "text-red" });

export const TRANSACTION_TYPE_LABELS = Object.freeze({
    referral_bonus: "Новый клиент",
    order_bonus: "Доставленный заказ",
    withdrawal: "Вывод",
});

export const TRANSACTION_STATUS_LABELS = Object.freeze({
    completed: "Начислено",
    pending: "Ожидает выплаты",
    paid: "Выплачено",
    rejected: "Отклонено, возвращено",
});
