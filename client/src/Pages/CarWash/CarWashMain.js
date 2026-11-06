import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import carWashApi, { clearCarWashToken, getCarWashToken } from "../../carWashApi";
import LogoText from "../../icons/LogoText";

const CODE_LETTERS = 12;
const CODE_GROUP = 4;

/** Ввод → только латинские буквы в верхнем регистре, с дефисами: ABCD-EFGH-IJKL */
const formatCodeInput = (raw) =>
    raw
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, CODE_LETTERS)
        .replace(new RegExp(`(.{${CODE_GROUP}})(?=.)`, "g"), "$1-");

const lettersCount = (code) => code.replace(/-/g, "").length;

const formatDateTime = (value) =>
    new Date(value).toLocaleString("ru-RU", { timeZone: "Asia/Almaty", dateStyle: "short", timeStyle: "short" });

/** Заголовок отказа по коду ошибки сервера */
const REJECT_TITLES = Object.freeze({
    EXPIRED: "Срок купона истёк",
    USED: "Купон уже использован",
    NOT_FOUND: "Купон не найден",
    INVALID_CODE: "Неверный код",
});

/**
 * Кабинет сотрудника мойки: ввести код купона клиента → купон сразу гасится.
 * Больше здесь ничего нет — управление мойками только у суперадмина.
 */
export default function CarWashMain() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [code, setCode] = useState("");
    /** null | { type: "success", coupon } | { type: "error", errorCode, message } */
    const [result, setResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [redemptions, setRedemptions] = useState([]);

    const loadRedemptions = useCallback(() => {
        carWashApi
            .post("/getCarWashRedemptions")
            .then(({ data }) => setRedemptions(data.redemptions))
            .catch(() => setRedemptions([]));
    }, []);

    useEffect(() => {
        if (!getCarWashToken()) {
            navigate("/carWashLogin", { replace: true });
            return;
        }
        carWashApi.post("/getCarWashMe").then(({ data }) => setProfile(data)).catch(() => undefined);
        loadRedemptions();
    }, [navigate, loadRedemptions]);

    const handleRedeem = async (event) => {
        event.preventDefault();
        if (lettersCount(code) !== CODE_LETTERS || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { data } = await carWashApi.post("/redeemCarWashCoupon", { code });
            setResult({ type: "success", coupon: data.coupon });
            loadRedemptions();
        } catch (e) {
            setResult({
                type: "error",
                errorCode: e?.response?.data?.code,
                message: e?.response?.data?.message || "Нет связи с сервером. Купон не списан — попробуйте ещё раз.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNext = () => {
        setResult(null);
        setCode("");
    };

    const handleLogout = () => {
        clearCarWashToken();
        navigate("/carWashLogin", { replace: true });
    };

    return (
        <div className="min-h-screen bg-[#F4F4F5] flex justify-center px-4 py-6">
            <div className="w-full max-w-md flex flex-col gap-y-4 text-black">
                <div className="flex items-center justify-between">
                    <LogoText className="w-[150px] h-[34px]" />
                    <button onClick={handleLogout} className="text-sm text-[#606B85]">
                        Выйти
                    </button>
                </div>
                {profile && (
                    <div>
                        <div className="text-lg font-medium">Точка «{profile.carWash.name}»</div>
                        <div className="text-sm text-[#606B85]">{profile.user.fullName}</div>
                    </div>
                )}

                {result ? (
                    <RedeemResult result={result} onNext={handleNext} />
                ) : (
                    <form onSubmit={handleRedeem} className="flex flex-col gap-y-3">
                        <h1 className="text-2xl font-medium">Код купона</h1>
                        <p className="text-sm text-[#606B85]">
                            Попросите клиента открыть купон в приложении «Тибетской» и введите 12-буквенный код.
                        </p>
                        <input
                            value={code}
                            onChange={(e) => setCode(formatCodeInput(e.target.value))}
                            placeholder="ABCD-EFGH-IJKL"
                            autoCapitalize="characters"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            style={{ fontSize: "22px", letterSpacing: "0.1em" }}
                            className="w-full p-4 rounded-xl bg-white outline-none text-center font-mono"
                        />
                        <button
                            type="submit"
                            disabled={lettersCount(code) !== CODE_LETTERS || isSubmitting}
                            className="w-full py-3 rounded-lg bg-[#D12A2A] text-white font-medium disabled:opacity-50"
                        >
                            {isSubmitting ? "Проверяем…" : "Применить купон"}
                        </button>
                        <p className="text-xs text-[#606B85]">Купон списывается сразу после нажатия. Один купон — одна мойка.</p>
                    </form>
                )}

                <RedemptionsList redemptions={redemptions} />
            </div>
        </div>
    );
}

function RedeemResult({ result, onNext }) {
    const isSuccess = result.type === "success";
    const title = isSuccess
        ? `Можно применить скидку ${result.coupon.discountPercent}%`
        : REJECT_TITLES[result.errorCode] ?? "Купон не применён";

    return (
        <div className="flex flex-col items-center gap-y-3 text-center">
            <div
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                    isSuccess ? "bg-[#E6F4EA] text-[#2E7D32]" : "bg-[#FDEBDD] text-[#E07B39]"
                }`}
            >
                {isSuccess ? "✓" : "!"}
            </div>
            <h1 className="text-2xl font-medium">{title}</h1>
            <p className="text-sm text-[#606B85]">{isSuccess ? "Купон погашен." : result.message}</p>
            {isSuccess && (
                <div className="w-full bg-white rounded-xl p-4 text-sm flex flex-col gap-y-2 text-left">
                    <Row label="Код" value={result.coupon.code} />
                    <Row label="Сотрудник" value={result.coupon.usedByName} />
                    <Row label="Время" value={formatDateTime(result.coupon.usedAt)} />
                </div>
            )}
            <button onClick={onNext} className="w-full py-3 rounded-lg bg-[#D12A2A] text-white font-medium">
                {isSuccess ? "Следующий купон" : "Ввести другой код"}
            </button>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex justify-between gap-x-3">
            <span className="text-[#606B85]">{label}</span>
            <span>{value}</span>
        </div>
    );
}

function RedemptionsList({ redemptions }) {
    if (redemptions.length === 0) return null;
    return (
        <div className="flex flex-col gap-y-2 mt-4">
            <div className="text-sm text-[#606B85]">Последние купоны на этой точке</div>
            <div className="bg-white rounded-xl divide-y divide-[#EEE]">
                {redemptions.map((row) => (
                    <div key={row.id} className="p-3 text-sm flex justify-between gap-x-3">
                        <span>
                            {formatDateTime(row.usedAt)} · {row.code}
                        </span>
                        <span className="text-[#606B85]">{row.usedByName}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
