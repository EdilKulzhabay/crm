import { useState } from "react";
import api from "../../api";
import ConfirmChangeModal from "../ConfirmChangeModal";
import Li from "../Li";
import MyButton from "../MyButton";
import MyInput from "../MyInput";

/** Тот же формат, что принимает регистрация клиента (crm/utils/referralCode.js#normalizeReferralCodeInput) */
const CODE_LETTERS = 12;
const toLetters = (value) => value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, CODE_LETTERS);
const formatCode = (letters) => letters.match(/.{1,4}/g)?.join("-") ?? "";

/**
 * Код приглашения партнёра. Новый код начинает работать сразу, старый — перестаёт;
 * уже привязанные клиенты и начисления не меняются. Уникальность проверяет сервер.
 */
export default function PartnerReferralCode({ partnerId, referralCode, onChanged, onMessage }) {
    const [draft, setDraft] = useState(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const isEditing = draft !== null;
    const nextCode = formatCode(draft ?? "");

    const requestSave = () => {
        if (draft.length !== CODE_LETTERS) {
            onMessage(`Код — ${CODE_LETTERS} латинских букв`, "error");
            return;
        }
        if (nextCode === referralCode) {
            setDraft(null);
            return;
        }
        setIsConfirmOpen(true);
    };

    const save = async ({ changedBy, reason }) => {
        setIsConfirmOpen(false);
        setIsSaving(true);
        try {
            await api.post("/setPartnerReferralCodeAdmin", { partnerId, referralCode: nextCode, changedBy, reason });
            onMessage("Код партнёра изменён", "success");
            setDraft(null);
            onChanged();
        } catch (error) {
            onMessage(error?.response?.data?.message || "Не удалось изменить код", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            {isConfirmOpen && (
                <ConfirmChangeModal
                    title={`Код приглашения: ${referralCode} → ${nextCode}. Старый код сразу перестанет работать, привязанные клиенты сохранятся.`}
                    onConfirm={save}
                    onCancel={() => setIsConfirmOpen(false)}
                />
            )}
            <Li>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Код приглашения:</span>
                    {isEditing ? (
                        <MyInput value={nextCode} change={(e) => setDraft(toLetters(e.target.value))} color="white" />
                    ) : (
                        <span>{referralCode}</span>
                    )}
                    {!isEditing && (
                        <button className="text-green-400 hover:text-blue-500" onClick={() => setDraft(toLetters(referralCode))}>
                            [ Изменить ]
                        </button>
                    )}
                    {isEditing && !isSaving && <MyButton click={requestSave}>Сохранить</MyButton>}
                    {isEditing && !isSaving && <MyButton click={() => setDraft(null)}>Отмена</MyButton>}
                </div>
            </Li>
        </>
    );
}
