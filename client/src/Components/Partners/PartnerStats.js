import Info from "../Info";
import Li from "../Li";
import { formatTenge } from "./partnerFormat";

/**
 * Показатели партнёра или сводка по всем (поля buildPartnerRow / summarizePartners на сервере).
 * Начисления и выплаты — за выбранный период; клиенты, баланс и «к выплате» — на сейчас.
 */
export default function PartnerStats({ stats }) {
    const items = [
        ["Клиентов всего", stats.clients, `из них заказывали: ${stats.orderedClients}`],
        ["Новых клиентов за период", stats.referralCount],
        ["Начислено за период", formatTenge(stats.earned), `за клиентов ${formatTenge(stats.referralBonus)}, за заказы ${formatTenge(stats.orderBonus)}`],
        ["Доставлено за период", `${stats.deliveredOrders} зак.`, `${stats.bottles} бут.`],
        ["Выплачено за период", formatTenge(stats.paidOut)],
        ["Баланс сейчас", formatTenge(stats.balance)],
        ["Ожидает выплаты", formatTenge(stats.pendingOut), `заявок: ${stats.pendingCount}`],
    ];

    return items.map(([label, value, hint]) => (
        <Li key={label}>
            <div className="flex flex-wrap items-center gap-x-2">
                <span>{label}:</span>
                <Info ml="ml-1">{value}</Info>
                {hint && <span className="text-sm opacity-70">{hint}</span>}
            </div>
        </Li>
    ));
}
