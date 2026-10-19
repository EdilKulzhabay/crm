import { useState } from "react";
import api from "../../api";
import Li from "../Li";
import MyButton from "../MyButton";
import { VERIFICATION_CLASSES, VERIFICATION_LABELS } from "./partnerFormat";

/**
 * Проверка партнёра: пока статус не «Подтверждён», приложение показывает партнёру только экран ожидания,
 * а его код не принимается при регистрации клиентов. Решение приходит партнёру push-уведомлением.
 */
export default function PartnerVerification({ partnerId, status, message, onChanged, onMessage }) {
    const [isSaving, setIsSaving] = useState(false);

    const decide = async (nextStatus) => {
        let reason = "";
        if (nextStatus === "denied") {
            reason = (window.prompt("Причина отказа — её увидит партнёр в приложении:") ?? "").trim();
            if (!reason) return;
        } else if (!window.confirm("Подтвердить партнёра? Ему откроется приложение, код начнёт работать.")) {
            return;
        }
        setIsSaving(true);
        try {
            await api.post("/setPartnerVerificationAdmin", { partnerId, status: nextStatus, message: reason });
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Проверка:</span>
                <span className={VERIFICATION_CLASSES[status] ?? ""}>{VERIFICATION_LABELS[status] ?? status}</span>
                {status === "denied" && message && <span className="text-sm opacity-70">Причина: {message}</span>}
                {!isSaving && status !== "verified" && <MyButton click={() => decide("verified")}>Подтвердить</MyButton>}
                {!isSaving && status !== "denied" && (
                    <button className="text-red hover:text-blue-500" onClick={() => decide("denied")}>
                        [ Отказать ]
                    </button>
                )}
            </div>
        </Li>
    );
}
