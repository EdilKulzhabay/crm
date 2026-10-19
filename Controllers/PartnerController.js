import Partner, { partnerVerificationStatus } from "../Models/Partner.js";
import { sendWhatsAppOtp } from "../utils/edna.js";
import { createPhoneOtpStore, OTP_VERIFY_RESULT } from "../utils/phoneOtpStore.js";
import { signPartnerToken } from "../utils/partnerToken.js";
import { generateUniquePartnerReferralCode } from "../utils/referralCode.js";
import { maskPhoneForLog, normalizePhoneForWhatsApp } from "../whatsApp/normalizePhone.js";

/**
 * Авторизация приложения партнёра. Сценарий повторяет клиентское приложение:
 *   регистрация: sendPartnerRegisterOtp → partnerCodeConfirm → partnerRegister
 *   вход:        sendPartnerLoginOtp → partnerLoginOtp
 * Код приходит в WhatsApp (edna), пароля нет. Формат ответов совместим с клиентским
 * ({ success, message } / { success, accessToken, partnerData }).
 */

const OTP_PURPOSE = Object.freeze({ REGISTER: "partner-register", LOGIN: "partner-login" });
const OTP_CODE_PATTERN = /^\d{6}$/;
const USER_NAME_MIN = 2;
const USER_NAME_MAX = 100;
const MONGO_DUPLICATE_KEY = 11000;
const PHONE_TAKEN_MESSAGE = "Партнёр с таким номером телефона уже зарегистрирован";
const PHONE_NOT_FOUND_MESSAGE = "Партнёр с таким номером телефона не найден";

const SEND_DENIED_MESSAGES = Object.freeze({
    cooldown: (sec) => `Повторная отправка возможна через ${sec} секунд`,
    in_progress: () => "Отправка уже в процессе, пожалуйста подождите",
    locked: (sec) =>
        `Слишком много неверных попыток. Повторите через ${Math.ceil(sec / 60)} мин.`,
});

const VERIFY_ERROR_MESSAGES = Object.freeze({
    [OTP_VERIFY_RESULT.INVALID]: "Неверный код",
    [OTP_VERIFY_RESULT.EXPIRED]: "Срок действия кода истёк. Запросите новый код",
    [OTP_VERIFY_RESULT.MISSING]: "Код не найден или уже использован. Запросите новый код",
    [OTP_VERIFY_RESULT.TOO_MANY_ATTEMPTS]: "Слишком много неверных попыток. Запросите новый код",
});

/** 11 цифр, начиная с 7 — иначе null. Тот же формат, что использует edna. */
function parsePhone(raw) {
    if (typeof raw !== "string") return null;
    const normalized = normalizePhoneForWhatsApp(raw);
    return normalized && /^7\d{10}$/.test(normalized) ? normalized : null;
}

export function serializePartner(partner) {
    return {
        _id: String(partner._id),
        userName: partner.userName,
        phone: partner.phone,
        referralCode: partner.referralCode,
        status: partner.status,
        balance: partner.balance ?? 0,
        cardData: {
            accountNumber: partner.cardData?.accountNumber ?? "",
            IIN: partner.cardData?.IIN ?? "",
            fullName: partner.cardData?.fullName ?? "",
        },
        verification: {
            status: partnerVerificationStatus(partner),
            message: partner.verification?.message ?? "",
        },
        createdAt: partner.createdAt,
    };
}

const defaultPartnerRepository = {
    findByPhone: (phoneNormalized) => Partner.findOne({ phoneNormalized }).lean(),
    create: async (data) => (await Partner.create(data)).toObject(),
    touchLogin: (id) =>
        Partner.findByIdAndUpdate(id, { lastLoginAt: new Date() }, { new: true }).lean(),
};

export function createPartnerController({
    partners = defaultPartnerRepository,
    otpStore = createPhoneOtpStore(),
    sendOtp = sendWhatsAppOtp,
    generateReferralCode = generateUniquePartnerReferralCode,
    signToken = signPartnerToken,
    logger = console,
} = {}) {
    const fail = (res, status, message) => res.status(status).json({ success: false, message });
    const serverError = (res) => fail(res, 500, "Внутренняя ошибка сервера");

    /** Общий шаг отправки кода: cooldown, генерация, доставка в WhatsApp. */
    async function deliverCode(res, purpose, phone, rawPhone) {
        const denied = otpStore.checkSendAllowed(purpose, phone);
        if (denied) return fail(res, 429, SEND_DENIED_MESSAGES[denied.reason](denied.retryAfterSec));

        const code = otpStore.issue(purpose, phone);
        let delivered = false;
        try {
            const result = await sendOtp(rawPhone, code);
            delivered = result?.ok === true;
            if (!delivered) {
                logger.error(
                    `[Partner OTP] ${purpose}: ошибка WhatsApp, phone=${maskPhoneForLog(phone)}:`,
                    result?.error
                );
            }
        } catch (error) {
            logger.error(
                `[Partner OTP] ${purpose}: исключение при отправке, phone=${maskPhoneForLog(phone)}:`,
                error?.message || error
            );
        } finally {
            otpStore.finishSend(purpose, phone, { delivered });
        }

        if (!delivered) {
            return fail(res, 500, "Не удалось отправить код в WhatsApp. Попробуйте позже.");
        }
        return res.status(200).json({ success: true, message: "Код отправлен в WhatsApp" });
    }

    /** Проверяет код; при ошибке сам отвечает клиенту и возвращает false. */
    function verifyCode(res, purpose, phone, code) {
        if (typeof code !== "string" || !OTP_CODE_PATTERN.test(code)) {
            fail(res, 400, "Введите 6-значный код");
            return false;
        }
        const result = otpStore.verify(purpose, phone, code);
        if (result !== OTP_VERIFY_RESULT.OK) {
            fail(res, 400, VERIFY_ERROR_MESSAGES[result] ?? "Неверный код");
            return false;
        }
        return true;
    }

    async function sendPartnerRegisterOtp(req, res) {
        const phone = parsePhone(req.body?.phone);
        if (!phone) return fail(res, 400, "Некорректный номер телефона");
        try {
            if (await partners.findByPhone(phone)) return fail(res, 409, PHONE_TAKEN_MESSAGE);
            return await deliverCode(res, OTP_PURPOSE.REGISTER, phone, req.body.phone);
        } catch (error) {
            logger.error("[Partner OTP] sendPartnerRegisterOtp:", error?.message || error);
            return serverError(res);
        }
    }

    function partnerCodeConfirm(req, res) {
        const phone = parsePhone(req.body?.phone);
        if (!phone) return fail(res, 400, "Некорректный номер телефона");
        if (!verifyCode(res, OTP_PURPOSE.REGISTER, phone, req.body?.code)) return undefined;
        otpStore.markVerified(OTP_PURPOSE.REGISTER, phone);
        return res.status(200).json({ success: true, message: "Код успешно подтверждён" });
    }

    async function partnerRegister(req, res) {
        const phone = parsePhone(req.body?.phone);
        const userName = typeof req.body?.userName === "string" ? req.body.userName.trim() : "";
        if (!phone) return fail(res, 400, "Некорректный номер телефона");
        if (userName.length < USER_NAME_MIN || userName.length > USER_NAME_MAX) {
            return fail(res, 400, "Укажите имя и фамилию");
        }
        if (!otpStore.isVerified(OTP_PURPOSE.REGISTER, phone)) {
            return fail(res, 400, "Телефон не подтверждён кодом из WhatsApp. Запросите код заново.");
        }

        try {
            if (await partners.findByPhone(phone)) return fail(res, 409, PHONE_TAKEN_MESSAGE);
            const partner = await partners.create({
                userName,
                phone: req.body.phone.trim(),
                phoneNormalized: phone,
                referralCode: await generateReferralCode(),
            });
            otpStore.clearVerified(OTP_PURPOSE.REGISTER, phone);
            logger.log(`[Partner auth] зарегистрирован партнёр, phone=${maskPhoneForLog(phone)}`);
            return res.status(200).json({
                success: true,
                accessToken: signToken(partner._id),
                partnerData: serializePartner(partner),
            });
        } catch (error) {
            // Параллельная регистрация того же номера: первым сработал уникальный индекс phoneNormalized
            if (error?.code === MONGO_DUPLICATE_KEY) return fail(res, 409, PHONE_TAKEN_MESSAGE);
            logger.error("[Partner auth] partnerRegister:", error?.message || error);
            return serverError(res);
        }
    }

    async function sendPartnerLoginOtp(req, res) {
        const phone = parsePhone(req.body?.phone);
        if (!phone) return fail(res, 400, "Некорректный номер телефона");
        try {
            if (!(await partners.findByPhone(phone))) return fail(res, 404, PHONE_NOT_FOUND_MESSAGE);
            return await deliverCode(res, OTP_PURPOSE.LOGIN, phone, req.body.phone);
        } catch (error) {
            logger.error("[Partner OTP] sendPartnerLoginOtp:", error?.message || error);
            return serverError(res);
        }
    }

    async function partnerLoginOtp(req, res) {
        const phone = parsePhone(req.body?.phone);
        if (!phone) return fail(res, 400, "Некорректный номер телефона");
        if (!verifyCode(res, OTP_PURPOSE.LOGIN, phone, req.body?.code)) return undefined;

        try {
            const partner = await partners.findByPhone(phone);
            if (!partner) return fail(res, 404, PHONE_NOT_FOUND_MESSAGE);
            if (partner.status !== "active") {
                return fail(res, 403, "Аккаунт партнёра заблокирован. Свяжитесь с поддержкой.");
            }
            const updated = (await partners.touchLogin(partner._id)) ?? partner;
            return res.status(200).json({
                success: true,
                accessToken: signToken(partner._id),
                partnerData: serializePartner(updated),
            });
        } catch (error) {
            logger.error("[Partner auth] partnerLoginOtp:", error?.message || error);
            return serverError(res);
        }
    }

    /** Требует checkAuthPartner: партнёр уже загружен в req.partner. */
    function getPartnerDataMobile(req, res) {
        return res.status(200).json({ success: true, partnerData: serializePartner(req.partner) });
    }

    return {
        sendPartnerRegisterOtp,
        partnerCodeConfirm,
        partnerRegister,
        sendPartnerLoginOtp,
        partnerLoginOtp,
        getPartnerDataMobile,
    };
}

export const {
    sendPartnerRegisterOtp,
    partnerCodeConfirm,
    partnerRegister,
    sendPartnerLoginOtp,
    partnerLoginOtp,
    getPartnerDataMobile,
} = createPartnerController();
