import { useState } from "react";
import api from "../../api";
import ConfirmChangeModal from "../ConfirmChangeModal";
import Info from "../Info";
import Li from "../Li";
import MyButton from "../MyButton";
import MyInput from "../MyInput";
import { formatTenge } from "./partnerFormat";

/** Тот же предел, что на сервере (Models/Partner.js#MAX_PARTNER_RATE) */
const MAX_RATE = 100000;
/** Поля Partner.registrationBonus / bottleBonus19 / bottleBonus12 / clientSignupBonus */
const RATE_ITEMS = Object.freeze([
    { field: "registrationBonus", label: "Партнёру за регистрацию клиента" },
    { field: "bottleBonus19", label: "Партнёру за бутыль 18,9 л" },
    { field: "bottleBonus12", label: "Партнёру за бутыль 12,5 л" },
    { field: "clientSignupBonus", label: "Клиенту при регистрации по коду" },
]);

const isValidRate = (value) => value !== "" && Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= MAX_RATE;
const toDraft = (rates) => Object.fromEntries(RATE_ITEMS.map(({ field }) => [field, String(rates[field])]));
const describeChanges = (rates, next) =>
    RATE_ITEMS.filter(({ field }) => rates[field] !== next[field])
        .map(({ field, label }) => `${label}: ${formatTenge(rates[field])} → ${formatTenge(next[field])}`)
        .join("; ");

/**
 * Индивидуальные ставки партнёра; партнёр видит их в приложении. Новые ставки действуют для следующих
 * регистраций и доставок, уже начисленные бонусы не пересчитываются.
 */
export default function PartnerRates({ partnerId, rates, onChanged, onMessage }) {
    const [draft, setDraft] = useState(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const isEditing = draft !== null;
    const nextRates = isEditing ? Object.fromEntries(RATE_ITEMS.map(({ field }) => [field, Number(draft[field])])) : rates;

    const changeField = (field, value) => setDraft((prev) => ({ ...prev, [field]: value.replace(/\D/g, "") }));

    const requestSave = () => {
        if (!RATE_ITEMS.every(({ field }) => isValidRate(draft[field]))) {
            onMessage(`Ставки — целые числа от 0 до ${MAX_RATE} ₸`, "error");
            return;
        }
        if (!describeChanges(rates, nextRates)) {
            setDraft(null);
            return;
        }
        setIsConfirmOpen(true);
    };

    const save = async ({ changedBy, reason }) => {
        setIsConfirmOpen(false);
        setIsSaving(true);
        try {
            await api.post("/setPartnerRatesAdmin", { partnerId, ...nextRates, changedBy, reason });
            onMessage("Ставки партнёра изменены", "success");
            setDraft(null);
            onChanged();
        } catch (error) {
            onMessage(error?.response?.data?.message || "Не удалось изменить ставки", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            {isConfirmOpen && (
                <ConfirmChangeModal
                    title={`${describeChanges(rates, nextRates)}. Действует для следующих регистраций и доставок.`}
                    onConfirm={save}
                    onCancel={() => setIsConfirmOpen(false)}
                />
            )}
            <Li>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Ставки партнёра:</span>
                    {!isEditing && (
                        <button className="text-green-400 hover:text-blue-500" onClick={() => setDraft(toDraft(rates))}>
                            [ Изменить ]
                        </button>
                    )}
                    {isEditing && !isSaving && <MyButton click={requestSave}>Сохранить</MyButton>}
                    {isEditing && !isSaving && <MyButton click={() => setDraft(null)}>Отмена</MyButton>}
                </div>
            </Li>
            {RATE_ITEMS.map(({ field, label }) => (
                <Li key={field}>
                    <div className="flex flex-wrap items-center gap-x-2 pl-4">
                        <span>{label}:</span>
                        {isEditing ? (
                            <MyInput value={draft[field]} change={(e) => changeField(field, e.target.value)} color="white" />
                        ) : (
                            <Info ml="ml-1">{formatTenge(rates[field])}</Info>
                        )}
                    </div>
                </Li>
            ))}
        </>
    );
}
