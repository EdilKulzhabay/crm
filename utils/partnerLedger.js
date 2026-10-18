import Partner from "../Models/Partner.js";
import PartnerTransaction from "../Models/PartnerTransaction.js";
import { sendPartnerPush } from "./partnerPush.js";

/** Бонус партнёру за клиента, зарегистрированного по его коду */
export const PARTNER_REFERRAL_BONUS = 200;
/** Бонус клиенту, зарегистрировавшемуся по коду партнёра (зачисляется на Client.balance при создании) */
export const PARTNER_REFERRAL_CLIENT_BONUS = 200;

const MONGO_DUPLICATE_KEY = 11000;
const isDuplicateKey = (error) => error?.code === MONGO_DUPLICATE_KEY;

export class PartnerLedgerError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "PartnerLedgerError";
        this.code = code;
    }
}

/** «Марат Касымов» → «Марат К.»: партнёр видит приглашённых без полной фамилии */
export function shortClientName(fullName) {
    const [first, last] = String(fullName || "").trim().split(/\s+/);
    if (!first) return "Клиент";
    return last ? `${first} ${last.charAt(0)}.` : first;
}

export const defaultLedgerRepository = {
    addBalance: (partnerId, amount) =>
        Partner.findByIdAndUpdate(partnerId, { $inc: { balance: amount } }, { new: true }).lean(),
    /** Атомарно списывает сумму, только если её хватает — два параллельных запроса не уведут баланс в минус */
    reserveBalance: (partnerId, amount) =>
        Partner.findOneAndUpdate(
            { _id: partnerId, status: "active", balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        ).lean(),
    createTransaction: async (data) => (await PartnerTransaction.create(data)).toObject(),
    deleteTransaction: (id) => PartnerTransaction.deleteOne({ _id: id }),
    findWithdrawalByRequestId: (partnerId, requestId) =>
        PartnerTransaction.findOne({ partner: partnerId, type: "withdrawal", requestId }).lean(),
    /** Push партнёру; sendPartnerPush сам глушит и логирует ошибки */
    notify: (partnerId, message) => sendPartnerPush(partnerId, message),
};

/**
 * Начисляет партнёру бонус за зарегистрированного клиента. Идемпотентно: уникальный индекс
 * (client, type) не даст начислить дважды. Сначала журнал, потом баланс — при сбое между шагами
 * в журнале остаётся запись без пополнения (видно при сверке), но не пополнение без записи.
 * @returns {Promise<boolean>} true — начислено сейчас, false — уже было начислено
 */
export async function applyPartnerReferralBonus({ partnerId, clientId, clientName }, repo = defaultLedgerRepository) {
    let transaction;
    try {
        transaction = await repo.createTransaction({
            partner: partnerId,
            type: "referral_bonus",
            amount: PARTNER_REFERRAL_BONUS,
            status: "completed",
            client: clientId,
            clientName: shortClientName(clientName),
        });
    } catch (error) {
        if (isDuplicateKey(error)) return false;
        throw error;
    }
    try {
        await repo.addBalance(partnerId, PARTNER_REFERRAL_BONUS);
    } catch (error) {
        // Не оставляем запись о начислении, которого не было
        await repo.deleteTransaction(transaction._id).catch(() => undefined);
        throw error;
    }
    void repo.notify(partnerId, {
        title: `Новый клиент: +${PARTNER_REFERRAL_BONUS} ₸`,
        body: `${shortClientName(clientName)} зарегистрировался по вашему коду. Бонус уже на балансе.`,
        data: { type: "referral_bonus" },
    });
    return true;
}

/**
 * Запрос на вывод: сразу списывает сумму с баланса и пишет заявку со статусом pending.
 * У курьеров списание делает менеджер в CRM, но для партнёров такой страницы нет — без
 * немедленного списания один остаток можно было бы запросить несколько раз.
 * Повтор с тем же requestId возвращает ту же заявку, ничего не списывая.
 * @returns {Promise<{ transaction: object, balance: number, isNew: boolean }>}
 */
export async function requestPartnerWithdrawal({ partner, amount, requestId }, repo = defaultLedgerRepository) {
    const existing = await repo.findWithdrawalByRequestId(partner._id, requestId);
    if (existing) {
        return { transaction: existing, balance: partner.balance, isNew: false };
    }

    const updated = await repo.reserveBalance(partner._id, amount);
    if (!updated) {
        throw new PartnerLedgerError("INSUFFICIENT_FUNDS", "Сумма не может превышать доступный баланс");
    }

    try {
        const transaction = await repo.createTransaction({
            partner: partner._id,
            type: "withdrawal",
            amount: -amount,
            status: "pending",
            requestId,
            cardData: {
                accountNumber: partner.cardData.accountNumber,
                IIN: partner.cardData.IIN,
                fullName: partner.cardData.fullName,
            },
            balanceAfter: updated.balance,
        });
        return { transaction, balance: updated.balance, isNew: true };
    } catch (error) {
        // Заявка не записана — возвращаем списанное
        await repo.addBalance(partner._id, amount);
        if (isDuplicateKey(error)) {
            const raced = await repo.findWithdrawalByRequestId(partner._id, requestId);
            if (raced) return { transaction: raced, balance: updated.balance + amount, isNew: false };
        }
        throw error;
    }
}
