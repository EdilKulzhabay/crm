import { formatBottles, formatDateTime, formatMoney, statusLabel } from "./deliveryPartnerFormat";

/** Итоги периода: бутыли и сумма — только по доставленным */
export function OrdersSummary({ summary }) {
    const items = [
        ["Заказов", summary.orders],
        ["Доставлено", summary.delivered],
        ["Бутылей 18,9 л", summary.b19],
        ["Бутылей 12,5 л", summary.b12],
        ["Сумма доставленных", formatMoney(summary.sum)],
    ];
    return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {items.map(([label, value]) => (
                <div key={label} className="bg-white rounded-xl p-3">
                    <div className="text-xs text-[#606B85]">{label}</div>
                    <div className="text-lg font-medium">{value}</div>
                </div>
            ))}
        </div>
    );
}

/** Список заказов: на телефоне — карточки, на широком экране — таблица */
export function OrdersList({ orders, emptyText }) {
    if (orders.length === 0) {
        return <div className="bg-white rounded-xl p-4 text-sm text-[#606B85]">{emptyText}</div>;
    }
    return (
        <>
            <div className="flex flex-col gap-y-2 md:hidden">
                {orders.map((order) => (
                    <div key={order.id} className="bg-white rounded-xl p-3 text-sm flex flex-col gap-y-1">
                        <div className="flex justify-between gap-x-3">
                            <span className="font-medium">
                                {order.date} {order.time}
                            </span>
                            <StatusBadge status={order.status} />
                        </div>
                        <div>{order.address || "—"}</div>
                        <div className="text-[#606B85]">
                            {order.courierName} · {formatBottles(order)} · {formatMoney(order.sum)}
                        </div>
                    </div>
                ))}
            </div>
            <div className="hidden md:block bg-white rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-left text-[#606B85]">
                        <tr>
                            {["Дата", "Курьер", "Адрес", "Бутыли", "Сумма", "Статус", "Доставлен"].map((title) => (
                                <th key={title} className="p-3 font-normal">
                                    {title}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEE]">
                        {orders.map((order) => (
                            <tr key={order.id}>
                                <td className="p-3 whitespace-nowrap">
                                    {order.date}
                                    <div className="text-xs text-[#606B85]">{order.time}</div>
                                </td>
                                <td className="p-3">{order.courierName || "—"}</td>
                                <td className="p-3">{order.address || "—"}</td>
                                <td className="p-3 whitespace-nowrap">{formatBottles(order)}</td>
                                <td className="p-3 whitespace-nowrap">{formatMoney(order.sum)}</td>
                                <td className="p-3">
                                    <StatusBadge status={order.status} />
                                </td>
                                <td className="p-3 whitespace-nowrap">{formatDateTime(order.deliveredTime)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

const BADGE_CLASSES = Object.freeze({
    delivered: "bg-[#E6F4EA] text-[#2E7D32]",
    onTheWay: "bg-[#E3EEFD] text-[#1E5BB8]",
    cancelled: "bg-[#F4F4F5] text-[#606B85]",
});

function StatusBadge({ status }) {
    return (
        <span className={`px-2 py-0.5 rounded-md text-xs whitespace-nowrap ${BADGE_CLASSES[status] ?? "bg-[#FDEBDD] text-[#B4561C]"}`}>
            {statusLabel(status)}
        </span>
    );
}
