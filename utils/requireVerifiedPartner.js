import { partnerVerificationStatus } from "../Models/Partner.js";

/**
 * После checkAuthPartner: пропускает только партнёра, одобренного в CRM.
 * Профиль (/getPartnerDataMobile) и push-токены доступны и до проверки — приложение
 * показывает экран ожидания и получает push о решении.
 */
export default function requireVerifiedPartner(req, res, next) {
    if (partnerVerificationStatus(req.partner) === "verified") return next();
    return res.status(403).json({
        success: false,
        code: "PARTNER_NOT_VERIFIED",
        message: "Аккаунт партнёра ещё на проверке. Мы сообщим, когда она завершится.",
    });
}
