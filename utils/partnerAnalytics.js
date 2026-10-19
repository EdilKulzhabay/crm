import { partnerVerificationStatus } from "../Models/Partner.js";
import { shiftDay } from "./partnerClientActivity.js";

/**
 * Чистые функции аналитики партнёров для CRM (Controllers/PartnerManagementController.js).
 * Все деньги — из журнала PartnerTransaction: он единственный источник правды о начислениях и выплатах.
 */

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Дни в CRM — по Алматы (UTC+5), как и date.d у заказов */
export const ALMATY_OFFSET = "+05:00";

const isDay = (value) => typeof value === "string" && DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
const startOfDay = (day) => new Date(`${day}T00:00:00${ALMATY_OFFSET}`);

/**
 * Период из фильтра CRM: даты включительно, любая может быть пустой.
 * @returns {{ from: Date | null, to: Date | null } | null} to — начало следующего дня (не включительно); null — неверный ввод
 */
export function parsePeriod({ startDate, endDate } = {}) {
    const hasStart = Boolean(startDate);
    const hasEnd = Boolean(endDate);
    if ((hasStart && !isDay(startDate)) || (hasEnd && !isDay(endDate))) return null;
    if (hasStart && hasEnd && startDate > endDate) return null;
    return {
        from: hasStart ? startOfDay(startDate) : null,
        to: hasEnd ? startOfDay(shiftDay(endDate, 1)) : null,
    };
}

/** Условие $match по createdAt для периода; пустой объект — без ограничений */
export function periodMatch({ from, to }) {
    if (!from && !to) return {};
    return { createdAt: { ...(from && { $gte: from }), ...(to && { $lt: to }) } };
}

const isType = (type) => ({ $eq: ["$type", type] });
const isWithdrawal = (status) => ({ $and: [isType("withdrawal"), { $eq: ["$status", status] }] });
const sumIf = (condition, value) => ({ $sum: { $cond: [condition, value, 0] } });

/** $group-этап: суммы по журналу партнёра. Сумма вывода в журнале отрицательная — берём модуль */
export const TRANSACTION_TOTALS_GROUP = {
    referralBonus: sumIf(isType("referral_bonus"), "$amount"),
    referralCount: sumIf(isType("referral_bonus"), 1),
    orderBonus: sumIf(isType("order_bonus"), "$amount"),
    deliveredOrders: sumIf(isType("order_bonus"), 1),
    bottles: sumIf(isType("order_bonus"), { $ifNull: ["$bottles", 0] }),
    paidOut: sumIf(isWithdrawal("paid"), { $abs: "$amount" }),
    pendingOut: sumIf(isWithdrawal("pending"), { $abs: "$amount" }),
    pendingCount: sumIf(isWithdrawal("pending"), 1),
};

export const EMPTY_TOTALS = Object.freeze({
    referralBonus: 0,
    referralCount: 0,
    orderBonus: 0,
    deliveredOrders: 0,
    bottles: 0,
    paidOut: 0,
    pendingOut: 0,
    pendingCount: 0,
});

const pickTotals = (row) =>
    Object.fromEntries(Object.keys(EMPTY_TOTALS).map((key) => [key, Number(row?.[key]) || 0]));

/**
 * Строка списка партнёров. Начисления и выплаты — за период;
 * заявки «к выплате», клиенты и баланс — на текущий момент.
 */
export function buildPartnerRow(partner, { periodTotals, pendingTotals, clientTotals } = {}) {
    const period = pickTotals(periodTotals);
    const pending = pickTotals(pendingTotals);
    return {
        id: String(partner._id),
        userName: partner.userName,
        phone: partner.phone,
        referralCode: partner.referralCode,
        status: partner.status,
        verificationStatus: partnerVerificationStatus(partner),
        verificationMessage: partner.verification?.message ?? "",
        balance: Number(partner.balance) || 0,
        createdAt: partner.createdAt ?? null,
        lastLoginAt: partner.lastLoginAt ?? null,
        clients: Number(clientTotals?.clients) || 0,
        orderedClients: Number(clientTotals?.orderedClients) || 0,
        ...period,
        earned: period.referralBonus + period.orderBonus,
        pendingOut: pending.pendingOut,
        pendingCount: pending.pendingCount,
    };
}

const SUMMED_FIELDS = Object.freeze([
    "balance",
    "clients",
    "orderedClients",
    "referralCount",
    "referralBonus",
    "orderBonus",
    "earned",
    "deliveredOrders",
    "bottles",
    "paidOut",
    "pendingOut",
    "pendingCount",
]);

/** Сводка по набору строк buildPartnerRow */
export function summarizePartners(rows) {
    const totals = Object.fromEntries(SUMMED_FIELDS.map((field) => [field, 0]));
    for (const row of rows) {
        for (const field of SUMMED_FIELDS) totals[field] += row[field];
    }
    return {
        partners: rows.length,
        activePartners: rows.filter((row) => row.status === "active").length,
        waitingVerification: rows.filter((row) => row.verificationStatus === "waiting").length,
        ...totals,
    };
}

/** Строки помесячной аналитики из агрегации ({ _id: "YYYY-MM", ...TRANSACTION_TOTALS_GROUP }), новые сверху */
export function buildMonthlyRows(rows) {
    return rows
        .map((row) => {
            const totals = pickTotals(row);
            return { month: row._id, ...totals, earned: totals.referralBonus + totals.orderBonus };
        })
        .sort((a, b) => b.month.localeCompare(a.month));
}
