import mongoose from "mongoose";
import Client from "../Models/Client.js";
import Partner, { ADMIN_SETTABLE_PARTNER_STATUSES, PARTNER_STATUSES, PARTNER_VERIFICATION_STATUSES } from "../Models/Partner.js";
import PartnerTransaction from "../Models/PartnerTransaction.js";
import { buildPartnerSearchFilter } from "./PartnerAdminController.js";
import { CHANGE_AUTHOR_REQUIRED_MESSAGE, readChangeAuthor } from "../utils/changeAuthor.js";
import { getTodayAlmaty } from "../utils/dateUtils.js";
import { loadClientsRhythm } from "../utils/partnerClientActivity.js";
import { PartnerLedgerError, resolvePartnerWithdrawal } from "../utils/partnerLedger.js";
import { runPartnerLapseCheck } from "../utils/partnerLapseCheck.js";
import { sendPartnerPush } from "../utils/partnerPush.js";
import {
    ALMATY_OFFSET,
    buildMonthlyRows,
    buildPartnerRow,
    parsePeriod,
    periodMatch,
    summarizePartners,
    TRANSACTION_TOTALS_GROUP,
} from "../utils/partnerAnalytics.js";

/**
 * Страница «Партнёры» в CRM (только суперадмин): список с аналитикой, карточка партнёра,
 * блокировка и обработка заявок на вывод. Привязка клиентов — через PartnerAdminController.setClientPartner.
 * «Удалить» = заблокировать: журнал и клиенты сохраняются, вход, код и вывод перестают работать.
 */

const PARTNERS_LIMIT = 500;
const CLIENTS_LIMIT = 500;
const TRANSACTIONS_LIMIT = 200;
const SEARCH_MIN_LENGTH = 2;
const PARTNER_LIST_FIELDS = "userName phone referralCode status verification balance createdAt lastLoginAt";
const VERIFICATION_MESSAGE_MAX = 500;
/** Лимиты push-уведомления от администратора: заголовок и текст видны целиком на экране блокировки */
const PUSH_TITLE_MAX = 100;
const PUSH_BODY_MAX = 500;
const VERIFICATION_DECISIONS = Object.freeze(["verified", "denied"]);

/** Фильтр по проверке: у партнёров без поля verification статус считается waiting */
const verificationFilter = (status) =>
    status === "waiting"
        ? { $or: [{ "verification.status": "waiting" }, { "verification.status": { $exists: false } }] }
        : { "verification.status": status };
const ALL_TIME = Object.freeze({ from: null, to: null });

const byPartner = (rows) => new Map(rows.map((row) => [String(row._id), row]));

const defaultRepo = {
    listPartners: (filter) =>
        Partner.find(filter).select(PARTNER_LIST_FIELDS).sort({ createdAt: -1 }).limit(PARTNERS_LIMIT).lean(),
    findPartner: (partnerId) => Partner.findById(partnerId).lean(),
    /** Индекс PartnerTransaction { partner: 1, createdAt: -1 } */
    transactionTotals: (partnerIds, period) =>
        PartnerTransaction.aggregate([
            { $match: { partner: { $in: partnerIds }, ...periodMatch(period) } },
            { $group: { _id: "$partner", ...TRANSACTION_TOTALS_GROUP } },
        ]),
    /** Индекс Client { referredByPartner: 1 } */
    clientTotals: (partnerIds) =>
        Client.aggregate([
            { $match: { referredByPartner: { $in: partnerIds } } },
            {
                $group: {
                    _id: "$referredByPartner",
                    clients: { $sum: 1 },
                    orderedClients: { $sum: { $cond: [{ $eq: ["$haveCompletedOrder", true] }, 1, 0] } },
                },
            },
        ]),
    monthlyTotals: (partnerId, period) =>
        PartnerTransaction.aggregate([
            { $match: { partner: partnerId, ...periodMatch(period) } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: ALMATY_OFFSET } },
                    ...TRANSACTION_TOTALS_GROUP,
                },
            },
        ]),
    listClients: (partnerId) =>
        Client.find({ referredByPartner: partnerId })
            .select("userName fullName phone createdAt haveCompletedOrder")
            .sort({ createdAt: -1 })
            .limit(CLIENTS_LIMIT)
            .lean(),
    loadRhythm: (clientIds) => loadClientsRhythm(clientIds, getTodayAlmaty()),
    listTransactions: (partnerId, period) =>
        PartnerTransaction.find({ partner: partnerId, ...periodMatch(period) })
            .sort({ createdAt: -1 })
            .limit(TRANSACTIONS_LIMIT)
            .lean(),
    /** Все заявки в ожидании, независимо от периода: их надо обработать */
    listPendingWithdrawals: (partnerId) =>
        PartnerTransaction.find({ partner: partnerId, type: "withdrawal", status: "pending" }).sort({ createdAt: 1 }).lean(),
    setPartnerVerification: (partnerId, verification) =>
        Partner.findByIdAndUpdate(partnerId, { verification }, { new: true, runValidators: true }).select(PARTNER_LIST_FIELDS).lean(),
    notify: (partnerId, message) => sendPartnerPush(partnerId, message),
    setPartnerStatus: (partnerId, status) =>
        Partner.findByIdAndUpdate(partnerId, { status }, { new: true }).select(PARTNER_LIST_FIELDS).lean(),
};

const serializeTransaction = (transaction) => ({
    id: String(transaction._id),
    type: transaction.type,
    amount: transaction.amount,
    status: transaction.status,
    clientId: transaction.client ? String(transaction.client) : null,
    clientName: transaction.clientName ?? null,
    bottles: transaction.bottles ?? null,
    fee: transaction.fee ?? null,
    payoutAmount: transaction.payoutAmount ?? null,
    cardData: transaction.type === "withdrawal" ? transaction.cardData ?? null : null,
    createdAt: transaction.createdAt,
    resolvedAt: transaction.resolvedAt ?? null,
});

const serializeClient = (client, rhythm) => ({
    id: String(client._id),
    name: client.userName || client.fullName || "Клиент",
    phone: client.phone ?? "",
    registeredAt: client.createdAt ?? null,
    hasOrdered: client.haveCompletedOrder === true || Boolean(rhythm),
    hasActiveOrder: rhythm?.hasActiveOrder ?? false,
    lastOrderDay: rhythm?.lastOrderDay ?? null,
    intervalDays: rhythm?.intervalDays ?? null,
    rhythmDays: rhythm?.rhythmDays ?? [],
    isLapsed: rhythm?.isLapsed ?? false,
});

export function createPartnerManagementController({
    repo = defaultRepo,
    resolveWithdrawal = resolvePartnerWithdrawal,
    runLapseCheck = runPartnerLapseCheck,
    logger = console,
} = {}) {
    const fail = (res, status, message) => res.status(status).json({ success: false, message });
    const isId = (value) => typeof value === "string" && mongoose.isValidObjectId(value);
    const describeAuthor = (req, { changedBy, reason }) => `пользователь ${req.userId}, ${changedBy}: ${reason}`;

    async function loadRows(partners, period) {
        const ids = partners.map((partner) => partner._id);
        if (ids.length === 0) return [];
        const [periodTotals, currentTotals, clientTotals] = await Promise.all([
            repo.transactionTotals(ids, period),
            // Заявки «к выплате» — на сейчас, без периода
            repo.transactionTotals(ids, ALL_TIME),
            repo.clientTotals(ids),
        ]);
        const [periodMap, currentMap, clientMap] = [periodTotals, currentTotals, clientTotals].map(byPartner);
        return partners.map((partner) => {
            const key = String(partner._id);
            return buildPartnerRow(partner, {
                periodTotals: periodMap.get(key),
                pendingTotals: currentMap.get(key),
                clientTotals: clientMap.get(key),
            });
        });
    }

    async function getPartnersAdmin(req, res) {
        const { query, status, verification, startDate, endDate } = req.body ?? {};
        const period = parsePeriod({ startDate, endDate });
        if (!period) return fail(res, 400, "Некорректный период");
        if (status && !PARTNER_STATUSES.includes(status)) return fail(res, 400, "Некорректный статус");
        if (verification && !PARTNER_VERIFICATION_STATUSES.includes(verification)) {
            return fail(res, 400, "Некорректный статус проверки");
        }

        const search = typeof query === "string" ? query.trim() : "";
        // $and: и поиск, и фильтр проверки используют $or
        const conditions = [
            search.length >= SEARCH_MIN_LENGTH && buildPartnerSearchFilter(search),
            status && { status },
            verification && verificationFilter(verification),
        ].filter(Boolean);
        const filter = conditions.length ? { $and: conditions } : {};
        try {
            const partners = await repo.listPartners(filter);
            const rows = await loadRows(partners, period);
            return res.status(200).json({
                success: true,
                summary: summarizePartners(rows),
                partners: rows,
                isTruncated: partners.length === PARTNERS_LIMIT,
            });
        } catch (error) {
            logger.error("[Partner management] getPartnersAdmin:", error?.message || error);
            return fail(res, 500, "Не удалось загрузить партнёров");
        }
    }

    async function getPartnerDetailsAdmin(req, res) {
        const { partnerId, startDate, endDate } = req.body ?? {};
        if (!isId(partnerId)) return fail(res, 400, "Некорректный партнёр");
        const period = parsePeriod({ startDate, endDate });
        if (!period) return fail(res, 400, "Некорректный период");
        try {
            const partner = await repo.findPartner(partnerId);
            if (!partner) return fail(res, 404, "Партнёр не найден");

            const [[row], monthly, clients, transactions, pending] = await Promise.all([
                loadRows([partner], period),
                repo.monthlyTotals(partner._id, period),
                repo.listClients(partner._id),
                repo.listTransactions(partner._id, period),
                repo.listPendingWithdrawals(partner._id),
            ]);
            const rhythms = await repo.loadRhythm(clients.map((client) => client._id));

            return res.status(200).json({
                success: true,
                partner: {
                    ...row,
                    cardData: partner.cardData ?? null,
                    devices: partner.expoPushTokens?.length ?? 0,
                },
                monthly: buildMonthlyRows(monthly),
                clients: clients.map((client) => serializeClient(client, rhythms.get(String(client._id)))),
                transactions: transactions.map(serializeTransaction),
                pendingWithdrawals: pending.map(serializeTransaction),
            });
        } catch (error) {
            logger.error("[Partner management] getPartnerDetailsAdmin:", error?.message || error);
            return fail(res, 500, "Не удалось загрузить партнёра");
        }
    }

    async function setPartnerStatusAdmin(req, res) {
        const { partnerId, status } = req.body ?? {};
        if (!isId(partnerId)) return fail(res, 400, "Некорректный партнёр");
        if (!ADMIN_SETTABLE_PARTNER_STATUSES.includes(status)) return fail(res, 400, "Некорректный статус");
        const author = readChangeAuthor(req.body);
        if (!author) return fail(res, 400, CHANGE_AUTHOR_REQUIRED_MESSAGE);
        try {
            const partner = await repo.setPartnerStatus(partnerId, status);
            if (!partner) return fail(res, 404, "Партнёр не найден");
            logger.log(`[Partner management] партнёр ${partnerId} → ${status} (${describeAuthor(req, author)})`);
            return res.status(200).json({ success: true, status: partner.status });
        } catch (error) {
            logger.error("[Partner management] setPartnerStatusAdmin:", error?.message || error);
            return fail(res, 500, "Не удалось изменить статус партнёра");
        }
    }

    /** Одобрить (verified) или отклонить (denied, с причиной) партнёра; партнёр получает push */
    async function setPartnerVerificationAdmin(req, res) {
        const { partnerId, status } = req.body ?? {};
        const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
        if (!isId(partnerId)) return fail(res, 400, "Некорректный партнёр");
        if (!VERIFICATION_DECISIONS.includes(status)) return fail(res, 400, "Некорректный статус проверки");
        if (status === "denied" && !message) return fail(res, 400, "Укажите причину отказа");
        if (message.length > VERIFICATION_MESSAGE_MAX) return fail(res, 400, "Причина слишком длинная");
        const author = readChangeAuthor(req.body);
        if (!author) return fail(res, 400, CHANGE_AUTHOR_REQUIRED_MESSAGE);
        try {
            const partner = await repo.setPartnerVerification(partnerId, {
                status,
                message: status === "denied" ? message : "",
                resolvedAt: new Date(),
                resolvedBy: req.userId ?? null,
            });
            if (!partner) return fail(res, 404, "Партнёр не найден");
            logger.log(`[Partner management] проверка партнёра ${partnerId} → ${status} (${describeAuthor(req, author)})`);
            void repo.notify(
                partnerId,
                status === "verified"
                    ? { title: "Аккаунт подтверждён", body: "Проверка пройдена — можно приглашать клиентов.", data: { type: "verification" } }
                    : { title: "Проверка не пройдена", body: message, data: { type: "verification" } }
            );
            return res.status(200).json({ success: true, verificationStatus: status, verificationMessage: partner.verification?.message ?? "" });
        } catch (error) {
            logger.error("[Partner management] setPartnerVerificationAdmin:", error?.message || error);
            return fail(res, 500, "Не удалось изменить статус проверки");
        }
    }

    /**
     * Произвольное push-уведомление партнёру от администратора (без страницы в CRM — вызывается через API).
     * Отвечает числом устройств, на которые Expo принял уведомление: 0 — у партнёра нет зарегистрированных устройств.
     */
    async function sendPartnerNotificationAdmin(req, res) {
        const { partnerId } = req.body ?? {};
        const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
        const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
        if (!isId(partnerId)) return fail(res, 400, "Некорректный партнёр");
        if (!title || title.length > PUSH_TITLE_MAX) return fail(res, 400, `Заголовок — от 1 до ${PUSH_TITLE_MAX} символов`);
        if (!body || body.length > PUSH_BODY_MAX) return fail(res, 400, `Текст — от 1 до ${PUSH_BODY_MAX} символов`);
        const author = readChangeAuthor(req.body);
        if (!author) return fail(res, 400, CHANGE_AUTHOR_REQUIRED_MESSAGE);
        try {
            const partner = await repo.findPartner(partnerId);
            if (!partner) return fail(res, 404, "Партнёр не найден");
            if (partner.status !== "active") return fail(res, 409, "Партнёр заблокирован или удалил аккаунт");
            const { sent } = await repo.notify(partnerId, { title, body, data: { type: "admin_message" } });
            logger.log(`[Partner management] уведомление партнёру ${partnerId}, устройств: ${sent} (${describeAuthor(req, author)})`);
            return res.status(200).json({
                success: true,
                sent,
                message: sent > 0 ? "Уведомление отправлено" : "У партнёра нет устройств с включёнными уведомлениями",
            });
        } catch (error) {
            logger.error("[Partner management] sendPartnerNotificationAdmin:", error?.message || error);
            return fail(res, 500, "Не удалось отправить уведомление");
        }
    }

    /** Ручной запуск ежедневной проверки ритма (utils/partnerLapseCheck.js) — та же логика, что в cron 11:00 */
    async function runPartnerLapseCheckAdmin(req, res) {
        const author = readChangeAuthor(req.body);
        if (!author) return fail(res, 400, CHANGE_AUTHOR_REQUIRED_MESSAGE);
        try {
            const notified = await runLapseCheck();
            logger.log(`[Partner management] ручная проверка ритма: уведомлений ${notified} (${describeAuthor(req, author)})`);
            return res.status(200).json({ success: true, notified });
        } catch (error) {
            logger.error("[Partner management] runPartnerLapseCheckAdmin:", error?.message || error);
            return fail(res, 500, "Не удалось выполнить проверку");
        }
    }

    async function resolvePartnerWithdrawalAdmin(req, res) {
        const { transactionId, status } = req.body ?? {};
        if (!isId(transactionId)) return fail(res, 400, "Некорректная заявка");
        const author = readChangeAuthor(req.body);
        if (!author) return fail(res, 400, CHANGE_AUTHOR_REQUIRED_MESSAGE);
        try {
            const transaction = await resolveWithdrawal({ transactionId, status, userId: req.userId });
            logger.log(`[Partner management] заявка ${transactionId} → ${status} (${describeAuthor(req, author)})`);
            return res.status(200).json({ success: true, transaction: serializeTransaction(transaction) });
        } catch (error) {
            if (error instanceof PartnerLedgerError) {
                return fail(res, error.code === "NOT_PENDING" ? 409 : 400, error.message);
            }
            logger.error("[Partner management] resolvePartnerWithdrawalAdmin:", error?.message || error);
            return fail(res, 500, "Не удалось обработать заявку");
        }
    }

    return {
        getPartnersAdmin,
        getPartnerDetailsAdmin,
        setPartnerStatusAdmin,
        setPartnerVerificationAdmin,
        resolvePartnerWithdrawalAdmin,
        runPartnerLapseCheckAdmin,
        sendPartnerNotificationAdmin,
    };
}

export const {
    getPartnersAdmin,
    getPartnerDetailsAdmin,
    setPartnerStatusAdmin,
    setPartnerVerificationAdmin,
    resolvePartnerWithdrawalAdmin,
    runPartnerLapseCheckAdmin,
    sendPartnerNotificationAdmin,
} = createPartnerManagementController();
