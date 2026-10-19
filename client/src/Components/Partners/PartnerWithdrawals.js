import { useState } from "react";
import api from "../../api";
import Div from "../Div";
import Li from "../Li";
import MyButton from "../MyButton";
import { formatDateTime, formatTenge } from "./partnerFormat";

/** Сумма к переводу; у заявок до введения комиссии — вся сумма */
const payoutOf = (withdrawal) => withdrawal.payoutAmount ?? Math.abs(withdrawal.amount);

/**
 * Заявки партнёра на вывод в ожидании. Сумма уже списана с баланса при запросе:
 * «Выплачено» — только отметка, «Отклонить» — возврат суммы на баланс. Партнёр получает push.
 */
export default function PartnerWithdrawals({ withdrawals, onResolved, onMessage }) {
    const [busyId, setBusyId] = useState(null);

    const resolve = async (withdrawal, status) => {
        const question =
            status === "paid"
                ? `Подтвердить, что ${formatTenge(payoutOf(withdrawal))} переведены на счёт партнёра?`
                : `Отклонить заявку? ${formatTenge(Math.abs(withdrawal.amount))} вернутся на баланс партнёра.`;
        if (!window.confirm(question)) return;
        setBusyId(withdrawal.id);
        try {
            await api.post("/resolvePartnerWithdrawalAdmin", { transactionId: withdrawal.id, status });
            onMessage(status === "paid" ? "Заявка отмечена выплаченной" : "Заявка отклонена, сумма возвращена", "success");
            onResolved();
        } catch (error) {
            onMessage(error?.response?.data?.message || "Не удалось обработать заявку", "error");
        } finally {
            setBusyId(null);
        }
    };

    if (withdrawals.length === 0) return <Li>Заявок нет</Li>;

    return withdrawals.map((withdrawal) => (
        <Div key={withdrawal.id}>
            <div className="flex flex-col gap-y-1 border border-yellow-400/50 p-3">
                <div className="text-yellow-400">
                    К переводу {formatTenge(payoutOf(withdrawal))} · {formatDateTime(withdrawal.createdAt)}
                </div>
                {withdrawal.fee != null && (
                    <div className="text-sm opacity-70">
                        Списано с баланса {formatTenge(Math.abs(withdrawal.amount))}, комиссия {formatTenge(withdrawal.fee)}
                    </div>
                )}
                <div className="text-sm">IBAN: {withdrawal.cardData?.accountNumber || "—"}</div>
                <div className="text-sm">ИИН: {withdrawal.cardData?.IIN || "—"}</div>
                <div className="text-sm">ФИО: {withdrawal.cardData?.fullName || "—"}</div>
                {busyId !== withdrawal.id && (
                    <div className="flex gap-x-4">
                        <MyButton click={() => resolve(withdrawal, "paid")}>Выплачено</MyButton>
                        <button className="text-red hover:text-blue-500" onClick={() => resolve(withdrawal, "rejected")}>
                            [ Отклонить ]
                        </button>
                    </div>
                )}
            </div>
        </Div>
    ));
}
