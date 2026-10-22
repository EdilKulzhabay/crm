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
const BLOCKED_MESSAGE = "Аккаунт партнёра заблокирован. Свяжитесь с поддержкой.";
const DELETED_MESSAGE = "Аккаунт с этим номером удалён. Чтобы восстановить его, напишите на info@tibetskaya.kz.";

/**
 * Номера, которые входят без кода из WhatsApp — тестовый аккаунт для проверки App Store / Google Play.
 * Переопределяется env PARTNER_LOGIN_WITHOUT_OTP_PHONES (через запятую, формат 7XXXXXXXXXX; пусто — выключено).
 * Работает только для входа в существующий активный аккаунт; регистрация — как обычно, с кодом.
 */
const DEFAULT_LOGIN_WITHOUT_OTP_PHONES = "77006837203";

export function parseOtpFreePhones(raw = process.env.PARTNER_LOGIN_WITHOUT_OTP_PHONES ?? DEFAULT_LOGIN_WITHOUT_OTP_PHONES) {
    return new Set(
        String(raw)
            .split(",")
            .map((phone) => phone.trim())
            .filter((phone) => /^7\d{10}$/.test(phone))
    );
}

/** Ошибка для уже существующего партнёра при регистрации: удалённый номер повторно не регистрируется */
const takenPhoneMessage = (partner) => (partner.status === "deleted" ? DELETED_MESSAGE : PHONE_TAKEN_MESSAGE);
const inactiveMessage = (partner) => (partner.status === "deleted" ? DELETED_MESSAGE : BLOCKED_MESSAGE);

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
    /** Мягкое удаление: данные остаются для расчётов, push на устройства больше не уходят */
    markDeleted: (id) =>
        Partner.updateOne(
            { _id: id, status: "active" },
            { status: "deleted", deletedAt: new Date(), expoPushTokens: [] }
        ),
};

export function createPartnerController({
    partners = defaultPartnerRepository,
    otpStore = createPhoneOtpStore(),
    sendOtp = sendWhatsAppOtp,
    generateReferralCode = generateUniquePartnerReferralCode,
    signToken = signPartnerToken,
    otpFreePhones = parseOtpFreePhones(),
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
            const existing = await partners.findByPhone(phone);
            if (existing) return fail(res, 409, takenPhoneMessage(existing));
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
            const existing = await partners.findByPhone(phone);
            if (existing) return fail(res, 409, takenPhoneMessage(existing));
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
            const partner = await partners.findByPhone(phone);
            if (!partner) return fail(res, 404, PHONE_NOT_FOUND_MESSAGE);
            // Код удалённому аккаунту не отправляем. Заблокированному отправляем — как раньше,
            // причину он увидит после ввода кода.
            if (partner.status === "deleted") return fail(res, 403, DELETED_MESSAGE);
            if (otpFreePhones.has(phone)) return await signInWithoutCode(res, partner, phone);
            return await deliverCode(res, OTP_PURPOSE.LOGIN, phone, req.body.phone);
        } catch (error) {
            logger.error("[Partner OTP] sendPartnerLoginOtp:", error?.message || error);
            return serverError(res);
        }
    }

    /** Вход тестового аккаунта без кода: ответ как у partnerLoginOtp, приложение сразу открывает сессию */
    async function signInWithoutCode(res, partner, phone) {
        if (partner.status !== "active") return fail(res, 403, inactiveMessage(partner));
        const updated = (await partners.touchLogin(partner._id)) ?? partner;
        logger.log(`[Partner auth] вход без кода (тестовый номер), phone=${maskPhoneForLog(phone)}`);
        return res.status(200).json({
            success: true,
            accessToken: signToken(partner._id),
            partnerData: serializePartner(updated),
        });
    }

    async function partnerLoginOtp(req, res) {
        const phone = parsePhone(req.body?.phone);
        if (!phone) return fail(res, 400, "Некорректный номер телефона");
        if (!verifyCode(res, OTP_PURPOSE.LOGIN, phone, req.body?.code)) return undefined;

        try {
            const partner = await partners.findByPhone(phone);
            if (!partner) return fail(res, 404, PHONE_NOT_FOUND_MESSAGE);
            if (partner.status !== "active") return fail(res, 403, inactiveMessage(partner));
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

    /**
     * Удаление аккаунта из приложения (требует checkAuthPartner). Данные не стираются: после смены
     * статуса checkAuthPartner отвечает 401 на любой токен партнёра — выход на всех устройствах,
     * а вход и регистрация с этим номером запрещены.
     */
    async function deletePartnerAccount(req, res) {
        try {
            await partners.markDeleted(req.partnerId);
            logger.log(`[Partner auth] партнёр ${req.partnerId} удалил аккаунт`);
            return res.status(200).json({ success: true });
        } catch (error) {
            logger.error("[Partner auth] deletePartnerAccount:", error?.message || error);
            return fail(res, 500, "Не удалось удалить аккаунт. Попробуйте позже.");
        }
    }

    return {
        deletePartnerAccount,
        sendPartnerRegisterOtp,
        partnerCodeConfirm,
        partnerRegister,
        sendPartnerLoginOtp,
        partnerLoginOtp,
        getPartnerDataMobile,
    };
}

export const {
    deletePartnerAccount,
    sendPartnerRegisterOtp,
    partnerCodeConfirm,
    partnerRegister,
    sendPartnerLoginOtp,
    partnerLoginOtp,
    getPartnerDataMobile,
} = createPartnerController();
