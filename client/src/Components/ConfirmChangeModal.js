import { useState } from "react";
import MyButton from "./MyButton";
import MyInput from "./MyInput";

/**
 * Подтверждение ручного изменения, как при изменении баланса клиента (ClientPage):
 * код подтверждения + кто вносит изменение + причина. onConfirm получает { changedBy, reason }.
 * Код сверяется в браузере (REACT_APP_SECRET_CODE) — это защита от случайных действий;
 * права проверяет сервер (только суперадмин), «кто» и «причина» он тоже требует и журналирует.
 */
export default function ConfirmChangeModal({ title, reasonLabel = "Причина изменения:", onConfirm, onCancel }) {
    const [secretCode, setSecretCode] = useState("");
    const [changedBy, setChangedBy] = useState("");
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    const confirm = () => {
        if (secretCode !== process.env.REACT_APP_SECRET_CODE) {
            setError("Неверный код");
            setSecretCode("");
            return;
        }
        if (!changedBy.trim() || !reason.trim()) {
            setError("Укажите, кто вносит изменение и по какой причине");
            return;
        }
        onConfirm({ changedBy: changedBy.trim(), reason: reason.trim() });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-start justify-center pt-24 px-4" onClick={onCancel}>
            <div onClick={(e) => e.stopPropagation()} className="relative bg-black px-8 py-4 border border-red rounded-md max-w-md w-full">
                <div className="flex flex-col gap-y-2">
                    {title && <div className="text-white">{title}</div>}
                    <div className="text-white text-sm">Код подтверждения:</div>
                    <MyInput value={secretCode} change={(e) => setSecretCode(e.target.value)} color="white" />
                    <div className="text-white text-sm">Кто вносит изменение:</div>
                    <MyInput value={changedBy} change={(e) => setChangedBy(e.target.value)} color="white" />
                    <div className="text-white text-sm">{reasonLabel}</div>
                    <MyInput value={reason} change={(e) => setReason(e.target.value)} color="white" />
                    {error && <div className="text-red text-sm">{error}</div>}
                    <div className="flex gap-x-4">
                        <MyButton click={confirm}>Подтвердить</MyButton>
                        <MyButton click={onCancel}>Отмена</MyButton>
                    </div>
                </div>
            </div>
        </div>
    );
}
