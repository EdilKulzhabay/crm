import Client from "../Models/Client.js";
import Partner from "../Models/Partner.js";
import PartnerTransaction from "../Models/PartnerTransaction.js";
import { sendPartnerWithdrawTelegram } from "../telegram/sendPartnerWithdraw.js";
import { MAX_PUSH_TOKENS } from "../utils/partnerPush.js";
import { getTodayAlmaty } from "../utils/dateUtils.js";
import { loadClientsRhythm } from "../utils/partnerClientActivity.js";
import {
    PartnerLedgerError,
    requestPartnerWithdrawal as requestWithdrawal,
    shortClientName,
} from "../utils/partnerLedger.js";

/**
 * Данные партнёрской программы для приложения tibetskaya_partner. Все обработчики идут после
 * checkAuthPartner: партнёр берётся из req.partner, id из тела запроса не принимаются.
 */

const CLIENTS_LIMIT = 500;
const TRANSACTIONS_LIMIT = 100;
const IBAN_PATTERN = /^KZ[0-9A-Z]{18}$/; // 20 символов, как в приложении курьера
const IIN_PATTERN = /^\d{12}$/;
const FULL_NAME_MIN = 3;
const FULL_NAME_MAX = 100;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,100}$/;
const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

export function serializeTransaction(transaction) {
    return {
        id: String(transaction._id),
        type: transaction.type,
        amount: transaction.amount,
        status: transaction.status,
        clientName: transaction.clientName ?? null,
        createdAt: transaction.createdAt,
    };
}

export function hasCompleteCardData(cardData) {
    return Boolean(cardData?.accountNumber?.trim() && cardData?.IIN?.trim() && cardData?.fullName?.trim());
}

const defaultRepository = {
    listReferredClients: (partnerId) =>
        Client.find({ referredByPartner: partnerId })
            .select("userName createdAt haveCompletedOrder")
            .sort({ createdAt: -1 })
            .limit(CLIENTS_LIMIT)
            .lean(),
    loadRhythm: (clientIds) => loadClientsRhythm(clientIds, getTodayAlmaty()),
    listTransactions: (partnerId) =>
        PartnerTransaction.find({ partner: partnerId }).sort({ createdAt: -1 }).limit(TRANSACTIONS_LIMIT).lean(),
    updateCardData: (partnerId, cardData) =>
        Partner.findByIdAndUpdate(partnerId, { cardData }, { new: true, runValidators: true }).lean(),
    /** Токен в конец списка без дублей; хранятся последние MAX_PUSH_TOKENS устройств */
    addPushToken: async (partnerId, token) => {
        await Partner.updateOne({ _id: partnerId }, { $pull: { expoPushTokens: token } });
        await Partner.updateOne(
            { _id: partnerId },
            { $push: { expoPushTokens: { $each: [token], $slice: -MAX_PUSH_TOKENS } } }
        );
    },
    removePushToken: (partnerId, token) =>
        Partner.updateOne({ _id: partnerId }, { $pull: { expoPushTokens: token } }),
};

export function createPartnerProgramController({
    repo = defaultRepository,
    withdraw = requestWithdrawal,
    notifyWithdraw = sendPartnerWithdrawTelegram,
    logger = console,
} = {}) {
    const fail = (res, status, message) => res.status(status).json({ success: false, message });

    async function getPartnerClients(req, res) {
        try {
            const clients = await repo.listReferredClients(req.partnerId);
            const rhythms = await repo.loadRhythm(clients.map((client) => client._id));
            return res.status(200).json({
                success: true,
                clients: clients.map((client) => {
                    const rhythm = rhythms.get(String(client._id));
                    return {
                        id: String(client._id),
                        name: shortClientName(client.userName),
                        registeredAt: client.createdAt,
                        hasOrdered: client.haveCompletedOrder === true || Boolean(rhythm?.lastOrderDay),
                        lastOrderDay: rhythm?.lastOrderDay ?? null,
                        intervalDays: rhythm?.intervalDays ?? null,
                        isLapsed: rhythm?.isLapsed ?? false,
                    };
                }),
            });
        } catch (error) {
            logger.error("[Partner program] getPartnerClients:", error?.message || error);
            return fail(res, 500, "Не удалось загрузить клиентов");
        }
    }

    async function getPartnerTransactions(req, res) {
        try {
            const transactions = await repo.listTransactions(req.partnerId);
            return res.status(200).json({ success: true, transactions: transactions.map(serializeTransaction) });
        } catch (error) {
            logger.error("[Partner program] getPartnerTransactions:", error?.message || error);
            return fail(res, 500, "Не удалось загрузить историю");
        }
    }

    async function updatePartnerCardData(req, res) {
        const raw = req.body ?? {};
        const accountNumber = typeof raw.accountNumber === "string" ? raw.accountNumber.replace(/\s/g, "").toUpperCase() : "";
        const IIN = typeof raw.IIN === "string" ? raw.IIN.replace(/\s/g, "") : "";
        const fullName = typeof raw.fullName === "string" ? raw.fullName.trim() : "";

        if (!IBAN_PATTERN.test(accountNumber)) {
            return fail(res, 400, "Номер счета (IBAN) — 20 символов, начинается с KZ");
        }
        if (!IIN_PATTERN.test(IIN)) return fail(res, 400, "ИИН — 12 цифр");
        if (fullName.length < FULL_NAME_MIN || fullName.length > FULL_NAME_MAX) {
            return fail(res, 400, "Укажите ФИО получателя");
        }

        try {
            const partner = await repo.updateCardData(req.partnerId, { accountNumber, IIN, fullName });
            return res.status(200).json({ success: true, cardData: partner.cardData });
        } catch (error) {
            logger.error("[Partner program] updatePartnerCardData:", error?.message || error);
            return fail(res, 500, "Не удалось сохранить реквизиты");
        }
    }

    async function requestPartnerWithdrawal(req, res) {
        const amount = Number(req.body?.amount);
        const requestId = req.body?.requestId;

        if (!Number.isSafeInteger(amount) || amount <= 0) return fail(res, 400, "Укажите корректную сумму");
        if (typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId)) {
            return fail(res, 400, "Некорректный запрос. Обновите приложение.");
        }
        if (!hasCompleteCardData(req.partner.cardData)) {
            return fail(res, 400, "Заполните банковские реквизиты в профиле перед выводом средств");
        }

        try {
            const { transaction, balance, isNew } = await withdraw({ partner: req.partner, amount, requestId });
            if (isNew) {
                void notifyWithdraw({
                    partner: req.partner,
                    amount,
                    transactionId: String(transaction._id),
                    balanceAfter: balance,
                }).catch((error) => logger.error("[Partner program] telegram:", error?.message || error));
            }
            return res.status(200).json({
                success: true,
                message: "Запрос на вывод отправлен",
                withdrawal: serializeTransaction(transaction),
                balance,
            });
        } catch (error) {
            if (error instanceof PartnerLedgerError) return fail(res, 400, error.message);
            logger.error("[Partner program] requestPartnerWithdrawal:", error?.message || error);
            return fail(res, 500, "Ошибка при отправке запроса");
        }
    }

    function readPushToken(req, res) {
        const token = req.body?.token;
        if (typeof token !== "string" || !EXPO_PUSH_TOKEN_PATTERN.test(token)) {
            fail(res, 400, "Некорректный токен уведомлений");
            return null;
        }
        return token;
    }

    async function savePartnerPushToken(req, res) {
        const token = readPushToken(req, res);
        if (!token) return undefined;
        try {
            await repo.addPushToken(req.partnerId, token);
            return res.status(200).json({ success: true });
        } catch (error) {
            logger.error("[Partner program] savePartnerPushToken:", error?.message || error);
            return fail(res, 500, "Не удалось сохранить токен уведомлений");
        }
    }

    async function removePartnerPushToken(req, res) {
        const token = readPushToken(req, res);
        if (!token) return undefined;
        try {
            await repo.removePushToken(req.partnerId, token);
            return res.status(200).json({ success: true });
        } catch (error) {
            logger.error("[Partner program] removePartnerPushToken:", error?.message || error);
            return fail(res, 500, "Не удалось удалить токен уведомлений");
        }
    }

    return {
        getPartnerClients,
        getPartnerTransactions,
        updatePartnerCardData,
        requestPartnerWithdrawal,
        savePartnerPushToken,
        removePartnerPushToken,
    };
}

export const {
    getPartnerClients,
    getPartnerTransactions,
    updatePartnerCardData,
    requestPartnerWithdrawal,
    savePartnerPushToken,
    removePartnerPushToken,
} = createPartnerProgramController();
