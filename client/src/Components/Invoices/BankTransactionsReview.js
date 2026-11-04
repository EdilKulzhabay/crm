import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api";
import ConfirmChangeModal from "../ConfirmChangeModal";
import Div from "../Div";
import Info from "../Info";
import Li from "../Li";
import MyButton from "../MyButton";
import { BANK_TRANSACTION_STATUS_LABELS, errorMessage, formatDay, formatTenge } from "./invoiceFormat";

const STATUS_FILTERS = ["needs_review", "matched", "ignored", ""];

const formatSyncStats = (stats) =>
    stats.disabled
        ? "Интеграция не настроена"
        : `новых операций ${stats.inserted}, зачтено ${stats.matched}, на проверку ${stats.needs_review}, не оплаты счетов ${stats.ignored}` +
          (stats.failed ? `, ошибок ${stats.failed}` : "");

function TransactionRow({ tx, invoiceNumber, onInvoiceNumberChange, onAssign, onIgnore }) {
    const canResolve = tx.status !== "matched";
    return (
        <Li>
            <div className="flex flex-col gap-y-1">
                <div className="flex items-center flex-wrap gap-x-3">
                    <div className="text-gray-400 text-sm">{formatDay(tx.date)}</div>
                    <Info>{formatTenge(tx.amount)}</Info>
                    <div>{tx.payerName || "—"}</div>
                    <div className="text-gray-400 text-sm">БИН {tx.payerBin || "—"}</div>
                    <div className="text-gray-400 text-sm">п/п № {tx.documentNumber || "—"}</div>
                </div>
                <div className="text-sm">Назначение: {tx.purpose || "—"}</div>
                {tx.reviewReason && <div className="text-sm text-yellow-400">{tx.reviewReason}</div>}
                {tx.invoice && (
                    <div className="text-sm text-gray-400">
                        Счёт №{tx.invoice.number} на {formatTenge(tx.invoice.total)}
                        {tx.resolvedBy ? ` — ${tx.resolvedBy}` : ""}
                    </div>
                )}
                {canResolve && (
                    <div className="flex items-center flex-wrap gap-x-3">
                        <input
                            placeholder="№ счёта"
                            value={invoiceNumber}
                            onChange={(e) => onInvoiceNumberChange(e.target.value)}
                            className="bg-black text-white border border-white rounded-lg p-1 text-sm w-28"
                        />
                        <button className="text-green-400 hover:text-blue-500" onClick={onAssign}>
                            [ Зачесть в этот счёт ]
                        </button>
                        {tx.status !== "ignored" && (
                            <button className="text-gray-400 hover:text-blue-500" onClick={onIgnore}>
                                [ Не оплата счёта ]
                            </button>
                        )}
                    </div>
                )}
            </div>
        </Li>
    );
}

/** Поступления на расчётный счёт из выписки ForteBusiness: разбор того, что не сопоставилось автоматически */
export default function BankTransactionsReview() {
    const [status, setStatus] = useState("needs_review");
    const [data, setData] = useState(null);
    const [page, setPage] = useState(1);
    const [invoiceNumbers, setInvoiceNumbers] = useState({});
    const [pendingAction, setPendingAction] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const requestIdRef = useRef(0);

    const load = useCallback(async (pageToLoad) => {
        const requestId = ++requestIdRef.current;
        setError("");
        try {
            const { data: response } = await api.post("/getBankTransactionsAdmin", { status, page: pageToLoad });
            if (requestId !== requestIdRef.current) return;
            setData(response);
            setPage(pageToLoad);
        } catch (e) {
            if (requestId === requestIdRef.current) setError(errorMessage(e, "Не удалось загрузить поступления"));
        }
    }, [status]);

    useEffect(() => {
        load(1);
    }, [load]);

    const syncNow = async () => {
        setIsSyncing(true);
        setNotice("");
        setError("");
        try {
            const { data: response } = await api.post("/syncBankStatementAdmin");
            setNotice(`Сверка выполнена: ${formatSyncStats(response.stats)}`);
            load(1);
        } catch (e) {
            setError(errorMessage(e, "Не удалось сверить с выпиской"));
        } finally {
            setIsSyncing(false);
        }
    };

    const startAssign = (tx) => {
        const invoiceNumber = (invoiceNumbers[tx._id] ?? "").trim();
        if (!invoiceNumber) {
            setError("Укажите номер счёта, в который зачесть поступление");
            return;
        }
        setPendingAction({ action: "assign", tx, invoiceNumber });
    };

    const runAction = async ({ changedBy, reason }) => {
        const { action, tx, invoiceNumber } = pendingAction;
        setPendingAction(null);
        setNotice("");
        setError("");
        try {
            await api.post("/resolveBankTransactionAdmin", { transactionId: tx._id, action, invoiceNumber, changedBy, reason });
            setNotice(action === "assign" ? `Поступление зачтено в счёт №${invoiceNumber}` : "Поступление отмечено как не оплата счёта");
            load(page);
        } catch (e) {
            setError(errorMessage(e, "Не удалось выполнить действие"));
        }
    };

    const modalTitle =
        pendingAction?.action === "assign"
            ? `Зачесть ${formatTenge(pendingAction.tx.amount)} от «${pendingAction.tx.payerName}» в счёт №${pendingAction.invoiceNumber}? Клиенту будет зачислено по счёту.`
            : "Отметить поступление как не связанное со счетами?";
    const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    return (
        <>
            {pendingAction && (
                <ConfirmChangeModal title={modalTitle} onConfirm={runAction} onCancel={() => setPendingAction(null)} />
            )}
            <Div />
            <Div>
                Поступления на расчётный счёт (ForteBusiness)
                {data?.needsReview > 0 && <span className="text-yellow-400">, требуют проверки: {data.needsReview}</span>}
            </Div>
            {data && !data.isSyncConfigured && (
                <Li><div className="text-red">Интеграция не настроена: на сервере не заданы FORTE_BUSINESS_*</div></Li>
            )}
            <Li>
                <div className="flex items-center flex-wrap gap-x-3">
                    {isSyncing ? (
                        <span className="opacity-70">Сверка выполняется…</span>
                    ) : (
                        <button className="text-green-400 hover:text-blue-500" onClick={syncNow}>
                            [ Сверить с выпиской сейчас ]
                        </button>
                    )}
                    <span className="text-sm opacity-70">Автоматически — каждые 10 минут</span>
                </div>
            </Li>
            <Li>
                <div className="flex items-center flex-wrap gap-x-3">
                    {STATUS_FILTERS.map((value) => (
                        <button
                            key={value || "all"}
                            onClick={() => setStatus(value)}
                            className={status === value ? "text-yellow-400" : "text-green-400 hover:text-blue-500"}
                        >
                            [ {BANK_TRANSACTION_STATUS_LABELS[value] || "Все"} ]
                        </button>
                    ))}
                </div>
            </Li>
            {notice && <Li><div className="text-green-400">{notice}</div></Li>}
            {error && <Li><div className="text-red">{error}</div></Li>}
            {data && data.transactions.length === 0 && <Li><div className="text-gray-400">Поступлений нет</div></Li>}
            {data?.transactions.map((tx) => (
                <TransactionRow
                    key={tx._id}
                    tx={tx}
                    invoiceNumber={invoiceNumbers[tx._id] ?? ""}
                    onInvoiceNumberChange={(value) => setInvoiceNumbers((prev) => ({ ...prev, [tx._id]: value }))}
                    onAssign={() => startAssign(tx)}
                    onIgnore={() => setPendingAction({ action: "ignore", tx })}
                />
            ))}
            {pageCount > 1 && (
                <Li>
                    <div className="flex items-center gap-x-3">
                        {page > 1 && <MyButton click={() => load(page - 1)}>Назад</MyButton>}
                        <div>стр. {page} из {pageCount}</div>
                        {page < pageCount && <MyButton click={() => load(page + 1)}>Вперёд</MyButton>}
                    </div>
                </Li>
            )}
        </>
    );
}
