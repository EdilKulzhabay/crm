import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api";
import Div from "./Div";
import Li from "./Li";
import Info from "./Info";
import MyButton from "./MyButton";

const STATUS_LABELS = { success: "Успешно", fail: "Не прошёл" };

/** @param {{ method: string, cardLast4?: string | null }} payment */
const formatMethod = (payment) => {
    if (payment.method === "invoice") return "Оплата по счёту";
    if (payment.method === "card") {
        return payment.cardLast4 ? `Карта •••• ${payment.cardLast4}` : "Карта";
    }
    return "Kaspi QR";
};

const formatAmount = (amount) => `${Number(amount || 0).toLocaleString("ru-RU")} ₸`;

const formatDate = (date) => new Date(date).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" });

/**
 * История оплат клиента (пополнения баланса картой и через Kaspi QR) для карточки клиента.
 * @param {{ clientId: string }} props
 */
export default function ClientPaymentHistory({ clientId }) {
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    // Ответ по предыдущему клиенту не должен перезаписать данные текущего
    const latestClientIdRef = useRef(clientId);
    latestClientIdRef.current = clientId;

    const loadPage = useCallback(async (pageToLoad) => {
        setIsLoading(true);
        setError("");
        try {
            const { data } = await api.post("/getClientPaymentHistory", { clientId, page: pageToLoad });
            if (latestClientIdRef.current !== clientId) return;
            setPayments((prev) => (pageToLoad === 1 ? data.payments : [...prev, ...data.payments]));
            setSummary(data.summary);
            setHasMore(data.hasMore);
            setPage(pageToLoad);
        } catch (e) {
            if (latestClientIdRef.current !== clientId) return;
            setError(e?.response?.data?.message || "Не удалось загрузить историю платежей");
        } finally {
            setIsLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        if (clientId) loadPage(1);
    }, [clientId, loadPage]);

    return (
        <>
            <Div />
            <Div>История платежей:</Div>
            {summary && summary.totalCount > 0 && (
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>Оплачено всего:</div>
                        <Info>{formatAmount(summary.totalAmountSuccess)}</Info>
                        <div className="text-gray-400 text-sm">
                            успешных: {summary.successCount} из {summary.totalCount}
                        </div>
                    </div>
                </Li>
            )}
            {error && <Li><div className="text-red">{error}</div></Li>}
            {!error && !isLoading && payments.length === 0 && (
                <Li><div className="text-gray-400">Платежей не было</div></Li>
            )}
            {payments.map((payment) => (
                <Li key={payment._id}>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div className="text-gray-400 text-sm">{formatDate(payment.paidAt)}</div>
                        <Info>{formatAmount(payment.amount)}</Info>
                        <div>{formatMethod(payment)}</div>
                        <div className={payment.status === "success" ? "text-green-400" : "text-red"}>
                            {STATUS_LABELS[payment.status] || payment.status}
                        </div>
                    </div>
                </Li>
            ))}
            {isLoading && <Li><div className="text-gray-400">Загрузка...</div></Li>}
            {hasMore && !isLoading && (
                <Li>
                    <MyButton click={() => loadPage(page + 1)}>Показать ещё</MyButton>
                </Li>
            )}
        </>
    );
}
