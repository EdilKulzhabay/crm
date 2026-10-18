import mongoose from "mongoose";
import Client from "../Models/Client.js";
import Partner from "../Models/Partner.js";

/**
 * Привязка клиента к партнёру из CRM (страница клиента, только суперадмин).
 * Ручная привязка бонусы не начисляет: 200 ₸ + 200 ₸ даются только при регистрации по коду.
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

const defaultRepo = {
    searchPartners: (query) => {
        const pattern = new RegExp(escapeRegex(query), "i");
        const digits = query.replace(/\D/g, "");
        return Partner.find({
            $or: [
                { userName: pattern },
                { referralCode: pattern },
                ...(digits.length >= SEARCH_MIN_LENGTH ? [{ phoneNormalized: new RegExp(escapeRegex(digits)) }] : []),
            ],
        })
            .select("userName phone referralCode status")
            .limit(SEARCH_LIMIT)
            .lean();
    },
    findClientPartnerId: async (clientId) =>
        (await Client.findById(clientId).select("referredByPartner").lean())?.referredByPartner ?? undefined,
    findPartner: (partnerId) => Partner.findById(partnerId).select("userName phone referralCode status").lean(),
    setClientPartner: (clientId, partnerId) =>
        Client.findByIdAndUpdate(
            clientId,
            { referredByPartner: partnerId, partnerLapseNotifiedDay: null },
            { new: true }
        ).select("_id referredByPartner").lean(),
};

export function createPartnerAdminController({ repo = defaultRepo, logger = console } = {}) {
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
            const partnerId = await repo.findClientPartnerId(clientId);
            if (partnerId === undefined) return fail(res, 404, "Клиент не найден");
            const partner = partnerId ? await repo.findPartner(partnerId) : null;
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
        try {
            const partner = partnerId ? await repo.findPartner(partnerId) : null;
            if (partnerId && !partner) return fail(res, 404, "Партнёр не найден");
            const client = await repo.setClientPartner(clientId, partnerId);
            if (!client) return fail(res, 404, "Клиент не найден");
            logger.log(`[Partner admin] клиент ${clientId} → партнёр ${partnerId ?? "нет"} (пользователь ${req.userId})`);
            return res.status(200).json({ success: true, partner: partner ? serializePartnerForAdmin(partner) : null });
        } catch (error) {
            logger.error("[Partner admin] setClientPartner:", error?.message || error);
            return fail(res, 500, "Не удалось изменить партнёра клиента");
        }
    }

    return { searchPartnersAdmin, getClientPartnerAdmin, setClientPartner };
}

export const { searchPartnersAdmin, getClientPartnerAdmin, setClientPartner } = createPartnerAdminController();
