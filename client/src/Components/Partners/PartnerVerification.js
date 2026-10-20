import { useState } from "react";
import api from "../../api";
import Li from "../Li";
import ConfirmChangeModal from "../ConfirmChangeModal";
import MyButton from "../MyButton";
import { VERIFICATION_CLASSES, VERIFICATION_LABELS } from "./partnerFormat";

/**
 * Проверка партнёра: пока статус не «Подтверждён», приложение показывает партнёру только экран ожидания,
 * а его код не принимается при регистрации клиентов. Решение приходит партнёру push-уведомлением.
 */
export default function PartnerVerification({ partnerId, status, message, onChanged, onMessage }) {
    const [isSaving, setIsSaving] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);

    const decide = async ({ changedBy, reason }) => {
        const nextStatus = pendingStatus;
        setPendingStatus(null);
        setIsSaving(true);
        try {
            // При отказе причина из окна подтверждения — она же сообщение партнёру
            await api.post("/setPartnerVerificationAdmin", {
                partnerId,
                status: nextStatus,
                message: nextStatus === "denied" ? reason : "",
                changedBy,
                reason,
            });
            onMessage(nextStatus === "verified" ? "Партнёр подтверждён" : "Партнёру отказано", "success");
            onChanged();
        } catch (error) {
            onMessage(error?.response?.data?.message || "Не удалось изменить статус проверки", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Li>
            {pendingStatus && (
                <ConfirmChangeModal
                    title={
                        pendingStatus === "verified"
                            ? "Подтвердить партнёра? Ему откроется приложение, код начнёт работать."
                            : "Отказать партнёру в проверке?"
                    }
                    reasonLabel={pendingStatus === "denied" ? "Причина отказа (увидит партнёр):" : undefined}
                    onConfirm={decide}
                    onCancel={() => setPendingStatus(null)}
                />
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Проверка:</span>
                <span className={VERIFICATION_CLASSES[status] ?? ""}>{VERIFICATION_LABELS[status] ?? status}</span>
                {status === "denied" && message && <span className="text-sm opacity-70">Причина: {message}</span>}
                {!isSaving && status !== "verified" && <MyButton click={() => setPendingStatus("verified")}>Подтвердить</MyButton>}
                {!isSaving && status !== "denied" && (
                    <button className="text-red hover:text-blue-500" onClick={() => setPendingStatus("denied")}>
                        [ Отказать ]
                    </button>
                )}
            </div>
        </Li>
    );
}
