import Div from "../Div";
import Li from "../Li";
import {
    formatDateTime,
    formatMonth,
    formatTenge,
    TRANSACTION_STATUS_LABELS,
    TRANSACTION_TYPE_LABELS,
} from "./partnerFormat";

/** Начисления и выплаты партнёра по месяцам (по Алматы) */
export function PartnerMonthly({ months }) {
    if (months.length === 0) return <Li>Начислений нет</Li>;
    return months.map((month) => (
        <Li key={month.month}>
            <div className="flex flex-wrap gap-x-3">
                <span className="capitalize">{formatMonth(month.month)}:</span>
                <span>начислено {formatTenge(month.earned)}</span>
                <span className="opacity-70">клиентов +{month.referralCount}</span>
                <span className="opacity-70">
                    {month.deliveredOrders} зак. / {month.bottles} бут.
                </span>
                <span className="opacity-70">выплачено {formatTenge(month.paidOut)}</span>
            </div>
        </Li>
    ));
}

/** Журнал PartnerTransaction за период (последние 200 записей) */
export function PartnerTransactions({ transactions }) {
    if (transactions.length === 0) return <Li>Операций нет</Li>;
    return transactions.map((transaction) => (
        <Div key={transaction.id}>
            <div className="flex flex-wrap gap-x-3 text-sm lg:text-base">
                <span className="opacity-70">{formatDateTime(transaction.createdAt)}</span>
                <span>{TRANSACTION_TYPE_LABELS[transaction.type] ?? transaction.type}</span>
                {transaction.clientName && <span>{transaction.clientName}</span>}
                {transaction.bottles != null && <span className="opacity-70">{transaction.bottles} бут.</span>}
                <span className={transaction.amount < 0 ? "text-red" : "text-green-400"}>
                    {transaction.amount > 0 ? "+" : ""}
                    {formatTenge(transaction.amount)}
                </span>
                <span className="opacity-70">{TRANSACTION_STATUS_LABELS[transaction.status] ?? transaction.status}</span>
            </div>
        </Div>
    ));
}
