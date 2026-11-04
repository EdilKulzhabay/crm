import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api";
import ConfirmChangeModal from "../ConfirmChangeModal";
import Div from "../Div";
import Info from "../Info";
import Li from "../Li";
import MyButton from "../MyButton";
import {
    errorMessage,
    formatCredited,
    formatDate,
    formatTenge,
    INVOICE_STATUS_CLASSES,
    INVOICE_STATUS_LABELS,
    PAYMENT_SOURCE_LABELS,
} from "./invoiceFormat";

const STATUS_FILTERS = [
    ["", "Все"],
    ["issued", "Ожидают оплаты"],
    ["paid", "Оплаченные"],
    ["cancelled", "Отменённые"],
];

function InvoiceRow({ invoice, showClient, onConfirm, onCancel }) {
    const items = [invoice.qty19 > 0 && `19 л × ${invoice.qty19}`, invoice.qty12 > 0 && `12 л × ${invoice.qty12}`]
        .filter(Boolean)
        .join(", ");
    return (
        <Li>
            <div className="flex flex-col gap-y-1">
                <div className="flex items-center flex-wrap gap-x-3">
                    <div>№ {invoice.number}</div>
                    <div className="text-gray-400 text-sm">{formatDate(invoice.createdAt)}</div>
                    {showClient && (
                        <a href={`/ClientPage/${invoice.client._id}`} className="text-blue-500 hover:text-green-400">
                            {invoice.client.name}
                        </a>
                    )}
                    <div className="text-gray-400 text-sm">БИН {invoice.buyerBin || "не указан"}</div>
                </div>
                <div className="flex items-center flex-wrap gap-x-3">
                    <div>{items}</div>
                    <Info>{formatTenge(invoice.total)}</Info>
                    <div className={INVOICE_STATUS_CLASSES[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</div>
                    {invoice.status === "issued" && (
                        <>
                            <button className="text-green-400 hover:text-blue-500" onClick={() => onConfirm(invoice)}>
                                [ Оплачен ]
                            </button>
                            <button className="text-red hover:text-blue-500" onClick={() => onCancel(invoice)}>
                                [ Отменить ]
                            </button>
                        </>
                    )}
                </div>
                {invoice.status === "paid" && (
                    <div className="text-sm text-gray-400">
                        {formatDate(invoice.paidAt)}, {PAYMENT_SOURCE_LABELS[invoice.paymentSource] || ""} ({invoice.confirmedBy}):
                        получено {formatTenge(invoice.paidAmount)}, зачислено {formatCredited(invoice)}
                        {!invoice.creditApplied && <span className="text-red"> — зачисление не завершено, проверьте карточку клиента</span>}
                    </div>
                )}
                {invoice.status === "cancelled" && invoice.cancelReason && (
                    <div className="text-sm text-gray-400">Причина отмены: {invoice.cancelReason}</div>
                )}
            </div>
        </Li>
    );
}

/**
 * Счета юрлиц: в карточке клиента (clientId) или общий список (суперадмин — все, франчайзи — свои).
 * «Оплачен» зачисляет ровно то, что в счёте: бутыли (талоны) или тенге (баланс), с журналом и push клиенту.
 * @param {{ clientId?: string }} props
 */
export default function InvoiceList({ clientId }) {
    const [status, setStatus] = useState("");
    const [number, setNumber] = useState("");
    const [invoices, setInvoices] = useState([]);
    const [total, setTotal] = useState(0);
    const [pageSize, setPageSize] = useState(30);
    const [notCredited, setNotCredited] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [pendingAction, setPendingAction] = useState(null);
    const requestIdRef = useRef(0);

    const load = useCallback(async (pageToLoad) => {
        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        setError("");
        try {
            const { data } = await api.post("/getInvoices", { clientId, status, number, page: pageToLoad });
            if (requestId !== requestIdRef.current) return;
            setInvoices(data.invoices);
            setTotal(data.total);
            setPageSize(data.pageSize);
            setNotCredited(data.notCredited);
            setPage(pageToLoad);
        } catch (e) {
            if (requestId === requestIdRef.current) setError(errorMessage(e, "Не удалось загрузить счета"));
        } finally {
            if (requestId === requestIdRef.current) setIsLoading(false);
        }
    }, [clientId, status, number]);

    useEffect(() => {
        load(1);
    }, [load]);

    const runAction = async ({ changedBy, reason }) => {
        const { kind, invoice } = pendingAction;
        setPendingAction(null);
        setNotice("");
        try {
            if (kind === "confirm") {
                const { data } = await api.post("/confirmInvoicePayment", { invoiceId: invoice._id, changedBy, reason });
                setNotice(`Счёт №${invoice.number} оплачен, зачислено: ${formatCredited(data.invoice)}`);
            } else {
                await api.post("/cancelInvoice", { invoiceId: invoice._id, changedBy, reason });
                setNotice(`Счёт №${invoice.number} отменён`);
            }
        } catch (e) {
            setError(errorMessage(e, "Не удалось выполнить действие"));
        }
        load(page);
    };

    const modalTitle =
        pendingAction?.kind === "confirm"
            ? `Отметить счёт №${pendingAction.invoice.number} на ${formatTenge(pendingAction.invoice.total)} оплаченным? Клиенту будет зачислено то, что указано в счёте.`
            : `Отменить счёт №${pendingAction?.invoice.number}?`;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    return (
        <>
            {pendingAction && (
                <ConfirmChangeModal
                    title={modalTitle}
                    reasonLabel={pendingAction.kind === "confirm" ? "Основание (например, п/п № и дата):" : "Причина отмены:"}
                    onConfirm={runAction}
                    onCancel={() => setPendingAction(null)}
                />
            )}
            <Div />
            <Div>Счета на оплату (юрлица):</Div>
            <Li>
                <div className="flex items-center flex-wrap gap-x-3">
                    {STATUS_FILTERS.map(([value, label]) => (
                        <button
                            key={value || "all"}
                            onClick={() => setStatus(value)}
                            className={status === value ? "text-yellow-400" : "text-green-400 hover:text-blue-500"}
                        >
                            [ {label} ]
                        </button>
                    ))}
                    {!clientId && (
                        <input
                            placeholder="№ счёта"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            className="bg-black text-white border border-white rounded-lg p-1 text-sm w-28"
                        />
                    )}
                </div>
            </Li>
            {notCredited > 0 && (
                <Li>
                    <div className="text-red">Оплачено, но зачисление не завершено: {notCredited} — проверьте вручную</div>
                </Li>
            )}
            {notice && <Li><div className="text-green-400">{notice}</div></Li>}
            {error && <Li><div className="text-red">{error}</div></Li>}
            {!isLoading && !error && invoices.length === 0 && <Li><div className="text-gray-400">Счетов нет</div></Li>}
            {invoices.map((invoice) => (
                <InvoiceRow
                    key={invoice._id}
                    invoice={invoice}
                    showClient={!clientId}
                    onConfirm={(inv) => setPendingAction({ kind: "confirm", invoice: inv })}
                    onCancel={(inv) => setPendingAction({ kind: "cancel", invoice: inv })}
                />
            ))}
            {isLoading && <Li><div className="text-gray-400">Загрузка...</div></Li>}
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
