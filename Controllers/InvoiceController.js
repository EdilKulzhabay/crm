import mongoose from "mongoose";
import BankTransaction from "../Models/BankTransaction.js";
import Invoice from "../Models/Invoice.js";
import User from "../Models/User.js";
import { BANK_REF_PREFIX, isBankStatementSyncConfigured, runBankStatementSync } from "../utils/bankStatementSync.js";
import { canUserAccessClient } from "../utils/crmClientAccess.js";
import { summarizeInvoiceCheck } from "../utils/invoicePaymentCheck.js";
import { invoiceNumberKey } from "../utils/invoiceMatching.js";
import { applyInvoicePayment, InvoicePaymentError } from "../utils/invoicePayment.js";

/**
 * Счета юрлиц и поступления из выписки ForteBusiness.
 * CRM: суперадмин — все счета и поступления; франчайзи — счета своих клиентов.
 * Приложение: статус оплаты счетов клиента (сверка с банком — по расписанию раз в час).
 */

const PAGE_SIZE = 30;
const INVOICE_STATUSES = ["issued", "paid", "cancelled"];
const BANK_TRANSACTION_STATUSES = ["new", "matched", "needs_review", "ignored"];
/** Сколько неоплаченных счетов клиента показываем в статусе */
const MOBILE_CHECK_MAX_INVOICES = 50;

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const PAYMENT_ERROR_STATUS = { NOT_FOUND: 404, CANCELLED: 409, REVIEW: 422, DUPLICATE_REF: 409 };

function sendError(res, error, context) {
    if (error instanceof HttpError) {
        return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error instanceof InvoicePaymentError) {
        return res.status(PAYMENT_ERROR_STATUS[error.code] ?? 400).json({ success: false, message: error.message });
    }
    console.error(`[InvoiceController] ${context}:`, error?.message || error);
    return res.status(500).json({ success: false, message: "Ошибка сервера" });
}

function requireObjectId(value, label) {
    if (!mongoose.Types.ObjectId.isValid(String(value))) throw new HttpError(400, `Некорректный ${label}`);
    return String(value);
}

/** Кто и почему — обязательны для любых ручных действий с деньгами (как в карточке клиента) */
function requireAuthor(body) {
    const changedBy = typeof body?.changedBy === "string" ? body.changedBy.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!changedBy || !reason) throw new HttpError(400, "Укажите, кто вносит изменение и по какой причине");
    return { changedBy, reason };
}

async function loadCrmUser(req) {
    if (req.userType !== "user") throw new HttpError(403, "Нет доступа");
    const user = await User.findById(req.userId).select("role").lean();
    if (user?.role !== "superAdmin" && user?.role !== "admin") throw new HttpError(403, "Нет доступа");
    return user;
}

/** Счёт, к которому у пользователя CRM есть доступ (по франчайзи клиента на момент выставления) */
async function loadAccessibleInvoice(req, invoiceId) {
    const id = requireObjectId(invoiceId, "id счёта");
    const [user, invoice] = await Promise.all([loadCrmUser(req), Invoice.findById(id).lean()]);
    if (!invoice) throw new HttpError(404, "Счёт не найден");
    if (!canUserAccessClient(user, invoice)) throw new HttpError(403, "Нет доступа к этому счёту");
    return invoice;
}

function serializeInvoice(invoice) {
    const client = invoice.client;
    return {
        _id: String(invoice._id),
        number: invoice.number,
        createdAt: invoice.createdAt,
        client: client?._id
            ? { _id: String(client._id), name: client.fullName || client.userName || "—" }
            : { _id: String(client), name: "—" },
        buyerBin: invoice.buyerBin,
        qty19: invoice.qty19,
        qty12: invoice.qty12,
        rent19: invoice.rent19 || 0,
        rent12: invoice.rent12 || 0,
        total: invoice.total,
        status: invoice.status,
        paidAt: invoice.paidAt,
        paidAmount: invoice.paidAmount,
        paymentSource: invoice.paymentSource,
        confirmedBy: invoice.confirmedBy,
        creditKind: invoice.creditKind,
        credited: invoice.credited,
        creditApplied: invoice.creditApplied,
        cancelReason: invoice.cancelReason,
    };
}

/**
 * POST /getInvoices { status?, clientId?, number?, page? }
 * «Не доначислено» (paid, но $inc не прошёл) отдаём отдельным счётчиком — это сигнал для проверки.
 */
export const getInvoices = async (req, res) => {
    try {
        const user = await loadCrmUser(req);
        const { status, clientId, number, page: rawPage } = req.body || {};
        const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);

        const filter = user.role === "superAdmin" ? {} : { franchisee: user._id };
        if (INVOICE_STATUSES.includes(status)) filter.status = status;
        if (clientId) filter.client = requireObjectId(clientId, "id клиента");
        if (typeof number === "string" && number.trim()) filter.numberKey = invoiceNumberKey(number);

        const [invoices, total, notCredited] = await Promise.all([
            Invoice.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE)
                .populate("client", "fullName userName")
                .lean(),
            Invoice.countDocuments(filter),
            Invoice.countDocuments({ ...filter, status: "paid", creditApplied: false }),
        ]);

        return res.json({
            success: true,
            invoices: invoices.map(serializeInvoice),
            total,
            pageSize: PAGE_SIZE,
            notCredited,
        });
    } catch (error) {
        return sendError(res, error, "getInvoices");
    }
};

/** POST /confirmInvoicePayment { invoiceId, paidAmount?, changedBy, reason } — менеджер видел оплату */
export const confirmInvoicePayment = async (req, res) => {
    try {
        const { changedBy, reason } = requireAuthor(req.body);
        const invoice = await loadAccessibleInvoice(req, req.body?.invoiceId);
        const rawAmount = req.body?.paidAmount;
        const paidAmount = rawAmount === undefined || rawAmount === "" ? undefined : Number(rawAmount);
        if (paidAmount !== undefined && !(paidAmount > 0)) throw new HttpError(400, "Некорректная сумма оплаты");

        const result = await applyInvoicePayment({
            invoiceId: invoice._id,
            paidAmount,
            paymentSource: "manual",
            confirmedBy: changedBy,
            reason,
            allowFakt: true,
        });
        if (result.status === "already_paid") throw new HttpError(409, `Счёт №${invoice.number} уже оплачен`);
        return res.json({ success: true, invoice: serializeInvoice(result.invoice) });
    } catch (error) {
        return sendError(res, error, "confirmInvoicePayment");
    }
};

/** POST /cancelInvoice { invoiceId, changedBy, reason } — только неоплаченный */
export const cancelInvoice = async (req, res) => {
    try {
        const { changedBy, reason } = requireAuthor(req.body);
        const invoice = await loadAccessibleInvoice(req, req.body?.invoiceId);
        const updated = await Invoice.findOneAndUpdate(
            { _id: invoice._id, status: "issued" },
            { $set: { status: "cancelled", cancelledAt: new Date(), cancelledBy: changedBy, cancelReason: reason } },
            { new: true }
        ).lean();
        if (!updated) throw new HttpError(409, "Отменить можно только неоплаченный счёт");
        return res.json({ success: true, invoice: serializeInvoice(updated) });
    } catch (error) {
        return sendError(res, error, "cancelInvoice");
    }
};

/** POST /getBankTransactionsAdmin { status?, page? } — поступления из выписки (суперадмин) */
export const getBankTransactionsAdmin = async (req, res) => {
    try {
        const { status = "needs_review", page: rawPage } = req.body || {};
        const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);
        const filter = BANK_TRANSACTION_STATUSES.includes(status) ? { status } : {};

        const [transactions, total, needsReview] = await Promise.all([
            BankTransaction.find(filter)
                .sort({ date: -1, createdAt: -1 })
                .skip((page - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE)
                .populate("invoice", "number status total")
                .lean(),
            BankTransaction.countDocuments(filter),
            BankTransaction.countDocuments({ status: "needs_review" }),
        ]);

        return res.json({
            success: true,
            isSyncConfigured: isBankStatementSyncConfigured(),
            transactions,
            total,
            pageSize: PAGE_SIZE,
            needsReview,
        });
    } catch (error) {
        return sendError(res, error, "getBankTransactionsAdmin");
    }
};

/**
 * POST /resolveBankTransactionAdmin { transactionId, action: "assign"|"ignore", invoiceNumber?, changedBy, reason }
 * assign — зачесть поступление в счёт вручную (те же правила, что автоматически, но можно и клиенту «по факту»).
 */
export const resolveBankTransactionAdmin = async (req, res) => {
    try {
        const { changedBy, reason } = requireAuthor(req.body);
        const { action, invoiceNumber } = req.body || {};
        const id = requireObjectId(req.body?.transactionId, "id поступления");
        const tx = await BankTransaction.findById(id).lean();
        if (!tx) throw new HttpError(404, "Поступление не найдено");
        if (tx.status === "matched") throw new HttpError(409, "Поступление уже зачтено в счёт");

        if (action === "ignore") {
            await BankTransaction.updateOne(
                { _id: tx._id, status: { $ne: "matched" } },
                { $set: { status: "ignored", reviewReason: reason, resolvedBy: changedBy, resolvedAt: new Date() } }
            );
            return res.json({ success: true });
        }
        if (action !== "assign") throw new HttpError(400, "Неизвестное действие");

        if (typeof invoiceNumber !== "string" || !invoiceNumber.trim()) throw new HttpError(400, "Укажите номер счёта");
        const invoice = await Invoice.findOne({ numberKey: invoiceNumberKey(invoiceNumber) }).select("_id number").lean();
        if (!invoice) throw new HttpError(404, `Счёт №${invoiceNumber.trim()} не найден`);

        const result = await applyInvoicePayment({
            invoiceId: invoice._id,
            paidAmount: tx.amount,
            paymentSource: "bank_statement",
            paymentRef: BANK_REF_PREFIX + tx.bankRef,
            confirmedBy: changedBy,
            reason,
            allowFakt: true,
        });
        if (result.status === "already_paid") throw new HttpError(409, `Счёт №${invoice.number} уже оплачен`);

        await BankTransaction.updateOne(
            { _id: tx._id },
            { $set: { status: "matched", invoice: invoice._id, reviewReason: reason, resolvedBy: changedBy, resolvedAt: new Date() } }
        );
        return res.json({ success: true, invoice: serializeInvoice(result.invoice) });
    } catch (error) {
        return sendError(res, error, "resolveBankTransactionAdmin");
    }
};

/** POST /syncBankStatementAdmin — сверить с выпиской сейчас: добирает пропущенное за последние дни (до 31) */
export const syncBankStatementAdmin = async (req, res) => {
    try {
        if (!isBankStatementSyncConfigured()) {
            throw new HttpError(503, "Интеграция с ForteBusiness не настроена на сервере");
        }
        const stats = await runBankStatementSync({ todayOnly: false });
        return res.json({ success: true, stats });
    } catch (error) {
        return sendError(res, error, "syncBankStatementAdmin");
    }
};

/**
 * POST /checkInvoicePaymentMobile { invoiceId? } — статус оплаты счетов клиента (только чтение из базы).
 * Кнопки «Проверить оплату» в приложении больше нет, эндпоинт оставлен для старых версий приложения.
 * Банк здесь не опрашивается: выписку сверяет расписание раз в час (utils/bankStatementSync.js).
 * Ответ: { success, status: "paid"|"waiting"|"cancelled"|"none", waitingCount, creditKind?, credited? }
 */
export const checkInvoicePaymentMobile = async (req, res) => {
    try {
        if (req.userType !== "client") throw new HttpError(403, "Нет доступа");
        const invoiceId = req.body?.invoiceId ? requireObjectId(req.body.invoiceId, "id счёта") : null;
        const filter = invoiceId ? { _id: invoiceId, client: req.userId } : { client: req.userId, status: "issued" };

        const invoices = await Invoice.find(filter)
            .select("status creditKind credited")
            .sort({ createdAt: -1 })
            .limit(MOBILE_CHECK_MAX_INVOICES)
            .lean();
        if (invoiceId && invoices.length === 0) throw new HttpError(404, "Счёт не найден");
        return res.json({ success: true, ...summarizeInvoiceCheck(invoices) });
    } catch (error) {
        return sendError(res, error, "checkInvoicePaymentMobile");
    }
};
