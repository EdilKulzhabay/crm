import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createPartnerController, parseOtpFreePhones } from "../PartnerController.js";
import { createPhoneOtpStore } from "../../utils/phoneOtpStore.js";

const RAW_PHONE = "+7 (700) 123-45-67";
const PHONE = "77001234567";
const CODE = "654321";

const silentLogger = { log() {}, error() {} };

const createRes = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (body) => {
        res.body = body;
        return res;
    };
    return res;
};

/** In-memory репозиторий, повторяющий контракт defaultPartnerRepository */
const createPartnerRepo = () => {
    const rows = [];
    return {
        rows,
        findByPhone: async (phoneNormalized) =>
            rows.find((p) => p.phoneNormalized === phoneNormalized) ?? null,
        create: async (data) => {
            const row = { _id: `id-${rows.length + 1}`, status: "active", createdAt: new Date(), ...data };
            rows.push(row);
            return row;
        },
        touchLogin: async (id) => rows.find((p) => p._id === id) ?? null,
        markDeleted: async (id) => {
            const row = rows.find((p) => p._id === id && p.status === "active");
            if (row) Object.assign(row, { status: "deleted", deletedAt: new Date() });
        },
    };
};

describe("PartnerController", () => {
    let partners;
    let sentCodes;
    let sendResult;
    let controller;

    beforeEach(() => {
        partners = createPartnerRepo();
        sentCodes = [];
        sendResult = { ok: true };
        controller = createPartnerController({
            partners,
            otpStore: createPhoneOtpStore({ generateCode: () => CODE }),
            sendOtp: async (phone, code) => {
                sentCodes.push({ phone, code });
                return sendResult;
            },
            generateReferralCode: async () => "ABCD-EFGH-IJKL",
            signToken: (id) => `token-for-${id}`,
            otpFreePhones: new Set(),
            logger: silentLogger,
        });
    });

    const call = async (handler, body) => {
        const res = createRes();
        await controller[handler]({ body }, res);
        return res;
    };

    const register = async (userName = "Алия Ахметова") => {
        await call("sendPartnerRegisterOtp", { phone: RAW_PHONE });
        await call("partnerCodeConfirm", { phone: RAW_PHONE, code: CODE });
        return call("partnerRegister", { phone: RAW_PHONE, userName });
    };

    describe("registration", () => {
        test("full flow creates the partner and returns a token", async () => {
            const res = await register();

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.accessToken, "token-for-id-1");
            assert.deepEqual(
                { ...res.body.partnerData, createdAt: undefined },
                {
                    _id: "id-1",
                    userName: "Алия Ахметова",
                    phone: RAW_PHONE,
                    referralCode: "ABCD-EFGH-IJKL",
                    status: "active",
                    balance: 0,
                    cardData: { accountNumber: "", IIN: "", fullName: "" },
                    // Новый партнёр сразу на проверке
                    verification: { status: "waiting", message: "" },
                    createdAt: undefined,
                }
            );
            assert.equal(partners.rows[0].phoneNormalized, PHONE);
            assert.deepEqual(sentCodes, [{ phone: RAW_PHONE, code: CODE }]);
        });

        test("refuses to register without a confirmed code", async () => {
            const res = await call("partnerRegister", { phone: RAW_PHONE, userName: "Алия" });

            assert.equal(res.statusCode, 400);
            assert.equal(partners.rows.length, 0);
        });

        test("a confirmation can be used for only one registration", async () => {
            await register();
            partners.rows.length = 0;

            const res = await call("partnerRegister", { phone: RAW_PHONE, userName: "Второй" });

            assert.equal(res.statusCode, 400);
        });

        test("does not send a code to an already registered phone", async () => {
            await register();

            const res = await call("sendPartnerRegisterOtp", { phone: "87001234567" });

            assert.equal(res.statusCode, 409);
            assert.equal(sentCodes.length, 1);
        });

        test("maps a duplicate-key race to 409", async () => {
            partners.create = async () => {
                throw Object.assign(new Error("E11000"), { code: 11000 });
            };

            const res = await register();

            assert.equal(res.statusCode, 409);
        });

        test("validates the name and the phone", async () => {
            const badPhone = await call("sendPartnerRegisterOtp", { phone: "12345" });
            const objectPhone = await call("sendPartnerRegisterOtp", { phone: { $ne: null } });
            const shortName = await register(" А ");

            assert.equal(badPhone.statusCode, 400);
            assert.equal(objectPhone.statusCode, 400);
            assert.equal(shortName.statusCode, 400);
        });

        test("rejects a wrong confirmation code", async () => {
            await call("sendPartnerRegisterOtp", { phone: RAW_PHONE });

            const res = await call("partnerCodeConfirm", { phone: RAW_PHONE, code: "000000" });

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.message, "Неверный код");
        });

        test("reports a WhatsApp delivery failure and allows an immediate retry", async () => {
            sendResult = { ok: false, error: "MISSING_API_KEY" };
            const failed = await call("sendPartnerRegisterOtp", { phone: RAW_PHONE });

            sendResult = { ok: true };
            const retried = await call("sendPartnerRegisterOtp", { phone: RAW_PHONE });

            assert.equal(failed.statusCode, 500);
            assert.equal(retried.statusCode, 200);
        });

        test("applies the resend cooldown", async () => {
            await call("sendPartnerRegisterOtp", { phone: RAW_PHONE });

            const res = await call("sendPartnerRegisterOtp", { phone: RAW_PHONE });

            assert.equal(res.statusCode, 429);
            assert.match(res.body.message, /Повторная отправка возможна через \d+ секунд/);
        });
    });

    describe("login", () => {
        test("full flow returns a token for an existing partner", async () => {
            await partners.create({ userName: "Алия", phone: RAW_PHONE, phoneNormalized: PHONE });

            const sent = await call("sendPartnerLoginOtp", { phone: RAW_PHONE });
            const res = await call("partnerLoginOtp", { phone: RAW_PHONE, code: CODE });

            assert.equal(sent.statusCode, 200);
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.accessToken, "token-for-id-1");
        });

        test("returns 404 for an unknown phone and sends nothing", async () => {
            const res = await call("sendPartnerLoginOtp", { phone: RAW_PHONE });

            assert.equal(res.statusCode, 404);
            assert.equal(sentCodes.length, 0);
        });

        test("returns 403 for a blocked partner after a valid code", async () => {
            await partners.create({
                userName: "Алия",
                phone: RAW_PHONE,
                phoneNormalized: PHONE,
                status: "blocked",
            });
            await call("sendPartnerLoginOtp", { phone: RAW_PHONE });

            const res = await call("partnerLoginOtp", { phone: RAW_PHONE, code: CODE });

            assert.equal(res.statusCode, 403);
        });

        test("a registration code cannot be used to log in", async () => {
            await call("sendPartnerRegisterOtp", { phone: RAW_PHONE });
            await partners.create({ userName: "Алия", phone: RAW_PHONE, phoneNormalized: PHONE });

            const res = await call("partnerLoginOtp", { phone: RAW_PHONE, code: CODE });

            assert.equal(res.statusCode, 400);
        });
    });

    describe("login without a code (store review number)", () => {
        const createWithOtpFree = () =>
            createPartnerController({
                partners,
                otpStore: createPhoneOtpStore({ generateCode: () => CODE }),
                sendOtp: async (phone, code) => sentCodes.push({ phone, code }),
                generateReferralCode: async () => "ABCD-EFGH-IJKL",
                signToken: (id) => `token-for-${id}`,
                otpFreePhones: new Set([PHONE]),
                logger: silentLogger,
            });

        test("returns a session right away and sends no WhatsApp code", async () => {
            await partners.create({ userName: "Тест", phone: RAW_PHONE, phoneNormalized: PHONE });
            const res = createRes();

            await createWithOtpFree().sendPartnerLoginOtp({ body: { phone: RAW_PHONE } }, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.accessToken, "token-for-id-1");
            assert.equal(sentCodes.length, 0);
        });

        test("still refuses a blocked or unknown number", async () => {
            const unknown = createRes();
            await createWithOtpFree().sendPartnerLoginOtp({ body: { phone: RAW_PHONE } }, unknown);
            await partners.create({ userName: "Тест", phone: RAW_PHONE, phoneNormalized: PHONE, status: "blocked" });
            const blocked = createRes();
            await createWithOtpFree().sendPartnerLoginOtp({ body: { phone: RAW_PHONE } }, blocked);

            assert.equal(unknown.statusCode, 404);
            assert.equal(blocked.statusCode, 403);
            assert.equal(blocked.body.accessToken, undefined);
        });

        test("parses the env list and ignores malformed numbers", () => {
            assert.deepEqual([...parseOtpFreePhones(" 77006837203, 123, ")], ["77006837203"]);
            assert.equal(parseOtpFreePhones("").size, 0);
        });
    });

    describe("account deletion", () => {
        const deleteAccount = async (partnerId) => {
            const res = createRes();
            await controller.deletePartnerAccount({ partnerId }, res);
            return res;
        };

        test("marks the account deleted without removing it", async () => {
            const partner = await partners.create({ userName: "Алия", phone: RAW_PHONE, phoneNormalized: PHONE });

            const res = await deleteAccount(partner._id);

            assert.equal(res.statusCode, 200);
            assert.equal(partners.rows.length, 1);
            assert.equal(partners.rows[0].status, "deleted");
        });

        test("a deleted account cannot get a login code or log in", async () => {
            const partner = await partners.create({ userName: "Алия", phone: RAW_PHONE, phoneNormalized: PHONE });
            await call("sendPartnerLoginOtp", { phone: RAW_PHONE });
            await deleteAccount(partner._id);

            const sent = await call("sendPartnerLoginOtp", { phone: RAW_PHONE });
            const login = await call("partnerLoginOtp", { phone: RAW_PHONE, code: CODE });

            assert.equal(sent.statusCode, 403);
            assert.match(sent.body.message, /удалён/);
            assert.equal(login.statusCode, 403);
            assert.equal(sentCodes.length, 1); // только код до удаления
        });

        test("the phone of a deleted account cannot be registered again", async () => {
            const partner = await partners.create({ userName: "Алия", phone: RAW_PHONE, phoneNormalized: PHONE });
            await deleteAccount(partner._id);

            const res = await call("sendPartnerRegisterOtp", { phone: RAW_PHONE });

            assert.equal(res.statusCode, 409);
            assert.match(res.body.message, /удалён/);
            assert.equal(sentCodes.length, 0);
        });
    });

    test("getPartnerDataMobile returns the partner attached by the middleware", async () => {
        const res = createRes();
        controller.getPartnerDataMobile(
            { partner: { _id: "id-9", userName: "Алия", phone: RAW_PHONE, referralCode: "X", status: "active" } },
            res
        );

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.partnerData._id, "id-9");
        assert.equal("phoneNormalized" in res.body.partnerData, false);
    });
});
