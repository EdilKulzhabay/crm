import Client from "../Models/Client.js";
import ClientOperationLog from "../Models/ClientOperationLog.js";
import ClientPayment from "../Models/ClientPayment.js";
import Invoice from "../Models/Invoice.js";
import { evaluateInvoicePayment } from "./invoiceMatching.js";

/**
 * Единая точка зачисления оплаты счёта юрлица: кнопка в CRM и сверка с выпиской Forte.
 *
 * Без транзакций MongoDB (сервер может быть не replica set), поэтому порядок такой:
 * 1) атомарно issued → paid (второй вызов для того же счёта ничего не зачислит);
 * 2) $inc клиенту (без «прочитать-прибавить-сохранить» — параллельные пополнения не теряются);
 * 3) creditApplied = true. Сбой между 1 и 3 оставляет paid + creditApplied=false — видно в CRM.
 */

export const INVOICE_PAYMENT_ORDER_PREFIX = "INV-";
export const SYSTEM_CONFIRMED_BY = "system:forte";

export class InvoicePaymentError extends Error {
    /** @param {"NOT_FOUND"|"CANCELLED"|"REVIEW"|"DUPLICATE_REF"} code @param {string} message */
    constructor(code, message) {
        super(message);
        this.name = "InvoicePaymentError";
        this.code = code;
    }
}

const CREDIT_FIELDS = Object.freeze({ b19: "paidBootlesFor19", b12: "paidBootlesFor12", balance: "balance" });

function collectClientPushTokens(client) {
    const tokens = [...(client?.notificationPushTokens || []), client?.notificationPushToken];
    return [...new Set(tokens.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()))];
}

export const defaultInvoicePaymentRepository = {
    findInvoice: (invoiceId) => Invoice.findById(invoiceId).lean(),
    findClient: (clientId) =>
        Client.findById(clientId).select("paymentMethod notificationPushTokens notificationPushToken").lean(),
    /** Атомарно: только из issued. null — счёт уже не issued */
    claimInvoice: (invoiceId, update) =>
        Invoice.findOneAndUpdate({ _id: invoiceId, status: "issued" }, { $set: update }, { new: true }).lean(),
    incrementClient: (clientId, inc) =>
        Client.findByIdAndUpdate(clientId, { $inc: inc }, { new: true })
            .select("balance paidBootlesFor19 paidBootlesFor12")
            .lean(),
    markCreditApplied: (invoiceId) => Invoice.updateOne({ _id: invoiceId }, { $set: { creditApplied: true } }),
    createOperationLogs: (rows) => ClientOperationLog.insertMany(rows),
    createClientPayment: (data) => ClientPayment.create(data),
    notifyClient: async (client, payload) => {
        const tokens = collectClientPushTokens(client);
        if (tokens.length === 0) return;
        // Динамический импорт, как в PaymentController: firebase-admin не поднимается при импорте модуля
        const { pushClientBalanceTopUpData } = await import("../pushNotificationClient.js");
        await pushClientBalanceTopUpData(tokens, payload, { clientId: client._id });
    },
};

/** Ненулевые приращения полей клиента */
function buildIncrement(credited) {
    return Object.fromEntries(
        Object.entries(CREDIT_FIELDS)
            .filter(([key]) => Number(credited[key]) !== 0)
            .map(([key, field]) => [field, Number(credited[key])])
    );
}

/** Журнал как при ручной правке в карточке клиента (oldValue восстанавливаем из результата $inc) */
function buildOperationLogs({ clientId, inc, updatedClient, changedBy, reason }) {
    return Object.entries(inc).map(([field, delta]) => ({
        client: clientId,
        field,
        oldValue: Number(updatedClient[field] || 0) - delta,
        newValue: Number(updatedClient[field] || 0),
        changedBy,
        reason,
    }));
}

/** Побочные действия после зачисления: их сбой не должен откатывать уже проведённую оплату */
async function recordSideEffects({ invoice, client, inc, updatedClient, paidAmount, changedBy, logReason }, repo, logger) {
    const orderId = `${INVOICE_PAYMENT_ORDER_PREFIX}${invoice.number}`;
    const steps = [
        ["журнал операций", () =>
            Object.keys(inc).length > 0 &&
            repo.createOperationLogs(buildOperationLogs({ clientId: invoice.client, inc, updatedClient, changedBy, reason: logReason }))],
        ["история оплат", () =>
            repo.createClientPayment({ client: invoice.client, paidAt: new Date(), amount: paidAmount, status: "success", sessionOrderId: orderId })],
        ["push клиенту", () =>
            repo.notifyClient(client, { orderId, amount: paidAmount, balanceAfter: updatedClient?.balance ?? "" })],
    ];
    for (const [label, run] of steps) {
        try {
            await run();
        } catch (error) {
            logger.error(`[invoicePayment] счёт №${invoice.number}: не удалось записать ${label}:`, error?.message || error);
        }
    }
}

/**
 * Проводит оплату счёта.
 * @param {{ invoiceId: string, paidAmount?: number, paymentSource: "manual"|"bank_statement",
 *           paymentRef?: string, confirmedBy: string, reason?: string, allowFakt?: boolean }} params
 *   paidAmount — по умолчанию сумма счёта; allowFakt — только для ручного подтверждения.
 * @returns {Promise<{ status: "applied", invoice: object } | { status: "already_paid", invoice: object }>}
 * @throws {InvoicePaymentError} REVIEW — зачислять автоматически нельзя (недоплата, fakt), reason в message
 */
export async function applyInvoicePayment(
    { invoiceId, paidAmount, paymentSource, paymentRef, confirmedBy, reason = "", allowFakt = false },
    repo = defaultInvoicePaymentRepository,
    logger = console
) {
    const invoice = await repo.findInvoice(invoiceId);
    if (!invoice) throw new InvoicePaymentError("NOT_FOUND", "Счёт не найден");
    if (invoice.status === "paid") return { status: "already_paid", invoice };
    if (invoice.status === "cancelled") throw new InvoicePaymentError("CANCELLED", `Счёт №${invoice.number} отменён`);

    const client = await repo.findClient(invoice.client);
    if (!client) throw new InvoicePaymentError("NOT_FOUND", "Клиент счёта не найден");

    const amount = paidAmount ?? invoice.total;
    const evaluation = evaluateInvoicePayment({ invoice, amount, paymentMethod: client.paymentMethod, allowFakt });
    if (!evaluation.ok) throw new InvoicePaymentError("REVIEW", evaluation.reason);

    let claimed;
    try {
        claimed = await repo.claimInvoice(invoice._id, {
            status: "paid",
            paidAt: new Date(),
            paidAmount: amount,
            paymentSource,
            ...(paymentRef ? { paymentRef } : {}),
            confirmedBy,
            confirmReason: reason || null,
            creditKind: evaluation.creditKind,
            credited: evaluation.credited,
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw new InvoicePaymentError("DUPLICATE_REF", "Эта банковская операция уже закрыла другой счёт");
        }
        throw error;
    }
    if (!claimed) {
        const current = await repo.findInvoice(invoice._id);
        if (current?.status === "paid") return { status: "already_paid", invoice: current };
        throw new InvoicePaymentError("CANCELLED", `Счёт №${invoice.number} отменён`);
    }

    const inc = buildIncrement(evaluation.credited);
    const updatedClient = Object.keys(inc).length > 0 ? await repo.incrementClient(invoice.client, inc) : null;
    await repo.markCreditApplied(invoice._id);

    const logReason = `Оплата счёта №${invoice.number}${reason ? `: ${reason}` : ""}`;
    await recordSideEffects({ invoice, client, inc, updatedClient, paidAmount: amount, changedBy: confirmedBy, logReason }, repo, logger);

    return { status: "applied", invoice: { ...claimed, creditApplied: true } };
}
