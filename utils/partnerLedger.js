import Client from "../Models/Client.js";
import Order from "../Models/Order.js";
import Partner from "../Models/Partner.js";
import PartnerTransaction from "../Models/PartnerTransaction.js";
import { sendPartnerPush } from "./partnerPush.js";

/** Бонус партнёру за клиента, зарегистрированного по его коду */
export const PARTNER_REFERRAL_BONUS = 200;
/** Бонус партнёру за каждую бутыль доставленного заказа его клиента: 18,9 л (b19) и 12,5 л (b12) */
export const PARTNER_BOTTLE_BONUS_B19 = 200;
export const PARTNER_BOTTLE_BONUS_B12 = 100;
/** Вывод: минимальная сумма запроса и комиссия (удерживается из суммы, к переводу — сумма минус комиссия) */
export const PARTNER_MIN_WITHDRAWAL = 5000;
export const PARTNER_WITHDRAWAL_FEE_RATE = 0.025;
export const PARTNER_WITHDRAWAL_MIN_FEE = 200;
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
    /** Заказ с актуальными количествами на момент доставки и партнёр его клиента */
    findDeliveredOrderWithPartner: async (orderId) => {
        const order = await Order.findById(orderId).select("client products status").lean();
        if (!order || order.status !== "delivered" || !order.client) return null;
        const client = await Client.findById(order.client).select("userName referredByPartner").lean();
        if (!client?.referredByPartner) return null;
        return { order, client };
    },
    hasReferralBonus: async (clientId) => Boolean(await PartnerTransaction.exists({ client: clientId, type: "referral_bonus" })),
    /**
     * Бонус клиенту за код партнёра — атомарно и один раз за всё время. Клиенту, пришедшему по коду
     * другого клиента (referredBy, 1000 ₸), не положен: два кода при регистрации ввести нельзя.
     */
    creditClientSignupBonus: (clientId, amount) =>
        Client.findOneAndUpdate(
            { _id: clientId, partnerSignupBonusPaid: { $ne: true }, referredBy: null },
            { $set: { partnerSignupBonusPaid: true }, $inc: { balance: amount } },
            { new: true }
        )
            .select("_id")
            .lean(),
    /** Атомарный переход статуса заявки на вывод: только из fromStatus, иначе null */
    updateWithdrawalStatus: (transactionId, fromStatus, update) =>
        PartnerTransaction.findOneAndUpdate(
            { _id: transactionId, type: "withdrawal", status: fromStatus },
            { $set: update },
            { new: true }
        ).lean(),
    /** Push партнёру; sendPartnerPush сам глушит и логирует ошибки */
    notify: (partnerId, message) => sendPartnerPush(partnerId, message),
};

/**
 * Начисляет партнёру бонус за зарегистрированного клиента. Идемпотентно: уникальный индекс
 * (client, partner, type) не даст начислить одному партнёру дважды. Сначала журнал, потом баланс — при сбое между шагами
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
 * Привязка клиента к партнёру в CRM — с теми же начислениями, что и регистрация по коду:
 * партнёру PARTNER_REFERRAL_BONUS (один раз на пару клиент–партнёр, с записью в журнале и push),
 * клиенту PARTNER_REFERRAL_CLIENT_BONUS (один раз за всё время). Прошлые доставки не пересчитываются.
 * @returns {Promise<{ partnerBonus: number, clientBonus: number }>}
 */
export async function applyPartnerBindingBonuses({ partnerId, clientId, clientName }, repo = defaultLedgerRepository) {
    // Клиенты, зарегистрированные по коду до появления partnerSignupBonusPaid, видны только по журналу
    const hadReferralBonus = await repo.hasReferralBonus(clientId);
    const isPartnerCredited = await applyPartnerReferralBonus({ partnerId, clientId, clientName }, repo);
    const isClientCredited =
        !hadReferralBonus && Boolean(await repo.creditClientSignupBonus(clientId, PARTNER_REFERRAL_CLIENT_BONUS));
    return {
        partnerBonus: isPartnerCredited ? PARTNER_REFERRAL_BONUS : 0,
        clientBonus: isClientCredited ? PARTNER_REFERRAL_CLIENT_BONUS : 0,
    };
}

const bottleCount = (value) => {
    const count = Number(value);
    return Number.isSafeInteger(count) && count > 0 ? count : 0;
};

/** Число бутылей в заказе: только целые неотрицательные значения */
export function orderBottles(products) {
    return bottleCount(products?.b12) + bottleCount(products?.b19);
}

/** Бонус за заказ: 12,5 л и 18,9 л оплачиваются по разным ставкам */
export function orderBottleBonus(products) {
    return bottleCount(products?.b12) * PARTNER_BOTTLE_BONUS_B12 + bottleCount(products?.b19) * PARTNER_BOTTLE_BONUS_B19;
}

/** Комиссия за вывод: 2,5% от суммы, но не меньше 200 ₸; целые тенге, округление вверх */
export function withdrawalFee(amount) {
    return Math.max(PARTNER_WITHDRAWAL_MIN_FEE, Math.ceil(amount * PARTNER_WITHDRAWAL_FEE_RATE));
}

/**
 * Начисляет партнёру бонус за бутыли доставленного заказа его клиента (orderBottleBonus).
 * Вызывается во всех местах, где заказ становится «доставлен» (CRM, курьер, курьер-агрегатор).
 * Количества перечитываются из БД: курьер мог изменить их при доставке.
 * Идемпотентно: уникальный индекс (order, type) — повторная доставка того же заказа не начислит второй раз.
 * Никогда не бросает исключение — сбой бонуса не должен ломать доставку.
 * @returns {Promise<number>} начисленная сумма (0 — не положено или уже начислено)
 */
export async function applyPartnerOrderBonus(orderId, repo = defaultLedgerRepository, logger = console) {
    try {
        const found = await repo.findDeliveredOrderWithPartner(orderId);
        if (!found) return 0;
        const { order, client } = found;
        const bottles = orderBottles(order.products);
        if (bottles === 0) return 0;
        const amount = orderBottleBonus(order.products);
        const clientName = shortClientName(client.userName);

        let transaction;
        try {
            transaction = await repo.createTransaction({
                partner: client.referredByPartner,
                type: "order_bonus",
                amount,
                status: "completed",
                client: client._id,
                clientName,
                order: order._id,
                bottles,
            });
        } catch (error) {
            if (isDuplicateKey(error)) return 0;
            throw error;
        }
        try {
            await repo.addBalance(client.referredByPartner, amount);
        } catch (error) {
            await repo.deleteTransaction(transaction._id).catch(() => undefined);
            throw error;
        }
        void repo.notify(client.referredByPartner, {
            title: `Клиент получил заказ: +${amount} ₸`,
            body: `${clientName}: ${bottles} бут. Бонус уже на балансе.`,
            data: { type: "order_bonus", clientId: String(client._id) },
        });
        return amount;
    } catch (error) {
        logger.error(`[Partner order bonus] заказ ${orderId}: бонус не начислен:`, error?.message || error);
        return 0;
    }
}

/**
 * Запрос на вывод: сразу списывает сумму с баланса и пишет заявку со статусом pending.
 * У курьеров списание делает менеджер в CRM, но для партнёров такой страницы нет — без
 * немедленного списания один остаток можно было бы запросить несколько раз.
 * Повтор с тем же requestId возвращает ту же заявку, ничего не списывая.
 * Списывается вся сумма; к переводу — сумма минус комиссия (fee, payoutAmount в заявке).
 * @returns {Promise<{ transaction: object, balance: number, isNew: boolean }>}
 */
export async function requestPartnerWithdrawal({ partner, amount, requestId }, repo = defaultLedgerRepository) {
    const existing = await repo.findWithdrawalByRequestId(partner._id, requestId);
    if (existing) {
        return { transaction: existing, balance: partner.balance, isNew: false };
    }
    if (amount < PARTNER_MIN_WITHDRAWAL) {
        throw new PartnerLedgerError("BELOW_MINIMUM", `Минимальная сумма вывода — ${PARTNER_MIN_WITHDRAWAL} ₸`);
    }
    const fee = withdrawalFee(amount);

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
            fee,
            payoutAmount: amount - fee,
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

export const WITHDRAWAL_RESOLUTIONS = Object.freeze(["paid", "rejected"]);

/**
 * Менеджер в CRM закрывает заявку на вывод. Сумма списана ещё при запросе (requestPartnerWithdrawal),
 * поэтому «выплачено» баланс не меняет, а «отклонено» возвращает сумму на баланс.
 * Статус меняется атомарно только из pending — два менеджера не вернут деньги дважды.
 * @returns {Promise<object>} обновлённая заявка
 */
export async function resolvePartnerWithdrawal({ transactionId, status, userId }, repo = defaultLedgerRepository) {
    if (!WITHDRAWAL_RESOLUTIONS.includes(status)) {
        throw new PartnerLedgerError("INVALID_STATUS", "Некорректный статус заявки");
    }
    const resolved = await repo.updateWithdrawalStatus(transactionId, "pending", {
        status,
        resolvedAt: new Date(),
        resolvedBy: userId ?? null,
    });
    if (!resolved) {
        throw new PartnerLedgerError("NOT_PENDING", "Заявка не найдена или уже обработана");
    }
    const amount = Math.abs(resolved.amount);

    if (status === "rejected") {
        try {
            await repo.addBalance(resolved.partner, amount);
        } catch (error) {
            // Деньги не вернулись — возвращаем заявку в ожидание, чтобы её можно было обработать снова
            await repo
                .updateWithdrawalStatus(transactionId, "rejected", { status: "pending", resolvedAt: null, resolvedBy: null })
                .catch(() => undefined);
            throw error;
        }
    }

    void repo.notify(
        resolved.partner,
        status === "paid"
            ? { title: `Выплата отправлена: ${amount} ₸`, body: "Деньги переведены на ваш счёт.", data: { type: "withdrawal" } }
            : {
                  title: "Заявка на вывод отклонена",
                  body: `${amount} ₸ вернули на баланс. Проверьте реквизиты или свяжитесь с поддержкой.`,
                  data: { type: "withdrawal" },
              }
    );
    return resolved;
}
