import mongoose from "mongoose";
import Client from "../Models/Client.js";
import ClientOperationLog from "../Models/ClientOperationLog.js";
import Partner from "../Models/Partner.js";
import { CHANGE_AUTHOR_REQUIRED_MESSAGE, readChangeAuthor } from "../utils/changeAuthor.js";
import { applyPartnerBindingBonuses } from "../utils/partnerLedger.js";

/**
 * Привязка клиента к партнёру из CRM (страница клиента, только суперадмин).
 * Привязка работает так, будто клиент зарегистрировался по коду партнёра: партнёру +200 ₸
 * (при смене партнёра — новому тоже), клиенту +200 ₸ один раз. Подробности — applyPartnerBindingBonuses.
 */

const SEARCH_LIMIT = 20;
const SEARCH_MIN_LENGTH = 2;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const serializePartnerForAdmin = (partner) => ({
    id: String(partner._id),
    userName: partner.userName,
    phone: partner.phone,
    referralCode: partner.referralCode,
    status: partner.status,
});

/** Фильтр поиска партнёра по имени, коду или цифрам телефона (также страница «Партнёры») */
export function buildPartnerSearchFilter(query) {
    const pattern = new RegExp(escapeRegex(query), "i");
    const digits = query.replace(/\D/g, "");
    return {
        $or: [
            { userName: pattern },
            { referralCode: pattern },
            ...(digits.length >= SEARCH_MIN_LENGTH ? [{ phoneNormalized: new RegExp(escapeRegex(digits)) }] : []),
        ],
    };
}

const defaultRepo = {
    searchPartners: (query) =>
        Partner.find(buildPartnerSearchFilter(query))
            .select("userName phone referralCode status")
            .limit(SEARCH_LIMIT)
            .lean(),
    /** null — клиента нет; { partnerId: null } — клиент без партнёра (в т.ч. без поля в старых документах) */
    findClientPartnerId: async (clientId) => {
        const client = await Client.findById(clientId).select("referredByPartner").lean();
        return client ? { partnerId: client.referredByPartner ?? null } : null;
    },
    findPartner: (partnerId) => Partner.findById(partnerId).select("userName phone referralCode status").lean(),
    setClientPartner: (clientId, partnerId) =>
        Client.findByIdAndUpdate(
            clientId,
            { referredByPartner: partnerId, partnerLapseNotifiedDay: null },
            { new: true }
        ).select("_id userName referredByPartner").lean(),
    logOperation: (entry) => ClientOperationLog.create(entry),
};

/** Партнёр в журнале операций клиента: «Алия · ABCD-EFGH-IJKL» */
const partnerLogLabel = (partner) => (partner ? `${partner.userName} · ${partner.referralCode}` : "нет");

const NO_BONUSES = Object.freeze({ partnerBonus: 0, clientBonus: 0 });

export function createPartnerAdminController({
    repo = defaultRepo,
    applyBonuses = applyPartnerBindingBonuses,
    logger = console,
} = {}) {
    const fail = (res, status, message) => res.status(status).json({ success: false, message });
    const isId = (value) => typeof value === "string" && mongoose.isValidObjectId(value);

    async function searchPartnersAdmin(req, res) {
        const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
        if (query.length < SEARCH_MIN_LENGTH) return res.status(200).json({ success: true, partners: [] });
        try {
            const partners = await repo.searchPartners(query);
            return res.status(200).json({ success: true, partners: partners.map(serializePartnerForAdmin) });
        } catch (error) {
            logger.error("[Partner admin] searchPartnersAdmin:", error?.message || error);
            return fail(res, 500, "Не удалось найти партнёров");
        }
    }

    async function getClientPartnerAdmin(req, res) {
        const { clientId } = req.body ?? {};
        if (!isId(clientId)) return fail(res, 400, "Некорректный клиент");
        try {
            const found = await repo.findClientPartnerId(clientId);
            if (!found) return fail(res, 404, "Клиент не найден");
            const partner = found.partnerId ? await repo.findPartner(found.partnerId) : null;
            return res.status(200).json({ success: true, partner: partner ? serializePartnerForAdmin(partner) : null });
        } catch (error) {
            logger.error("[Partner admin] getClientPartnerAdmin:", error?.message || error);
            return fail(res, 500, "Не удалось загрузить партнёра клиента");
        }
    }

    /** partnerId: id партнёра — привязать; null — отвязать */
    async function setClientPartner(req, res) {
        const { clientId, partnerId } = req.body ?? {};
        if (!isId(clientId)) return fail(res, 400, "Некорректный клиент");
        if (partnerId !== null && !isId(partnerId)) return fail(res, 400, "Некорректный партнёр");
        const author = readChangeAuthor(req.body);
        if (!author) return fail(res, 400, CHANGE_AUTHOR_REQUIRED_MESSAGE);
        try {
            const partner = partnerId ? await repo.findPartner(partnerId) : null;
            if (partnerId && !partner) return fail(res, 404, "Партнёр не найден");
            const previous = await repo.findClientPartnerId(clientId);
            if (!previous) return fail(res, 404, "Клиент не найден");
            const previousPartner = previous.partnerId ? await repo.findPartner(String(previous.partnerId)) : null;
            const client = await repo.setClientPartner(clientId, partnerId);
            if (!client) return fail(res, 404, "Клиент не найден");
            logger.log(
                `[Partner admin] клиент ${clientId} → партнёр ${partnerId ?? "нет"} (пользователь ${req.userId}, ${author.changedBy}: ${author.reason})`
            );
            const bonuses = partner ? await applyBindingBonuses(partner, client) : NO_BONUSES;
            await writeOperationLog(clientId, author, { previousPartner, partner, bonuses });
            return res.status(200).json({
                success: true,
                partner: partner ? serializePartnerForAdmin(partner) : null,
                bonuses,
            });
        } catch (error) {
            logger.error("[Partner admin] setClientPartner:", error?.message || error);
            return fail(res, 500, "Не удалось изменить партнёра клиента");
        }
    }

    /** Журнал операций клиента (как у баланса): смена партнёра и бонус клиенту. Сбой журнала не отменяет привязку */
    async function writeOperationLog(clientId, author, { previousPartner, partner, bonuses }) {
        const entries = [
            { client: clientId, field: "partner", oldValue: partnerLogLabel(previousPartner), newValue: partnerLogLabel(partner), ...author },
        ];
        if (bonuses.clientBonus > 0 && bonuses.clientBalance != null) {
            entries.push({
                client: clientId,
                field: "balance",
                oldValue: bonuses.clientBalance - bonuses.clientBonus,
                newValue: bonuses.clientBalance,
                changedBy: author.changedBy,
                reason: `Бонус за привязку к партнёру. ${author.reason}`,
            });
        }
        try {
            for (const entry of entries) await repo.logOperation(entry);
        } catch (error) {
            logger.error(`[Partner admin] журнал операций клиента ${clientId} не записан:`, error?.message || error);
        }
    }

    /** Привязка уже сохранена: сбой начисления не откатывает её, а возвращается в ответе для менеджера */
    async function applyBindingBonuses(partner, client) {
        try {
            return await applyBonuses({ partnerId: partner._id, clientId: client._id, clientName: client.userName });
        } catch (error) {
            logger.error(`[Partner admin] бонусы за привязку клиента ${client._id} не начислены:`, error?.message || error);
            return { ...NO_BONUSES, isFailed: true };
        }
    }

    return { searchPartnersAdmin, getClientPartnerAdmin, setClientPartner };
}

export const { searchPartnersAdmin, getClientPartnerAdmin, setClientPartner } = createPartnerAdminController();
