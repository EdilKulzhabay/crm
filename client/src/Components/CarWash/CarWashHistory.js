import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import Div from "../Div";
import MyButton from "../MyButton";
import PartnerPeriodFilter from "../Partners/PartnerPeriodFilter";
import { formatDateTime } from "../Partners/partnerFormat";

/** История погашений купонов на мойку: фильтр по мойке и периоду, постранично */
export default function CarWashHistory({ carWashes, onError }) {
    const [carWashId, setCarWashId] = useState("");
    const [period, setPeriod] = useState({ startDate: "", endDate: "" });
    const [page, setPage] = useState(0);
    const [data, setData] = useState(null);

    useEffect(() => {
        let isCancelled = false;
        api.post("/getCarWashCouponsAdmin", { carWashId: carWashId || undefined, ...period, page })
            .then(({ data: response }) => {
                if (!isCancelled) setData(response);
            })
            .catch((e) => {
                if (!isCancelled) onError(e?.response?.data?.message || "Не удалось загрузить историю");
            });
        return () => {
            isCancelled = true;
        };
    }, [carWashId, period, page, onError]);

    const changeFilter = (setter) => (value) => {
        setPage(0);
        setter(value);
    };
    const hasNextPage = data && (page + 1) * data.pageSize < data.summary.used;

    return (
        <>
            <Div>История купонов</Div>
            <Div>
                <PartnerPeriodFilter period={period} onChange={changeFilter(setPeriod)} />
            </Div>
            <Div>
                <span>Мойка:</span>
                <select
                    value={carWashId}
                    onChange={(e) => changeFilter(setCarWashId)(e.target.value)}
                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base"
                >
                    <option value="">Все мойки</option>
                    {carWashes.map((carWash) => (
                        <option key={carWash.id} value={carWash.id}>
                            {carWash.name}
                        </option>
                    ))}
                </select>
            </Div>
            {data && (
                <>
                    <Div>
                        Выдано купонов: {data.summary.issued}, использовано: {data.summary.used}
                    </Div>
                    <RedemptionsTable redemptions={data.redemptions} />
                    <Div>
                        {page > 0 && <MyButton click={() => setPage(page - 1)}>Назад</MyButton>}
                        {hasNextPage && <MyButton click={() => setPage(page + 1)}>Дальше</MyButton>}
                    </Div>
                </>
            )}
        </>
    );
}

function RedemptionsTable({ redemptions }) {
    if (redemptions.length === 0) return <Div>Погашений нет</Div>;
    const headers = ["Время", "Код", "Скидка", "Мойка", "Сотрудник", "Клиент"];

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm lg:text-base">
                <thead>
                    <tr className="text-left opacity-70">
                        {headers.map((header) => (
                            <th key={header} className="pr-4 pb-2 font-normal whitespace-nowrap">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {redemptions.map((row) => (
                        <tr key={row.id} className="border-t border-white/20">
                            <td className="pr-4 py-2 whitespace-nowrap">{formatDateTime(row.usedAt)}</td>
                            <td className="pr-4 py-2 whitespace-nowrap">{row.code}</td>
                            <td className="pr-4 py-2">{row.discountPercent}%</td>
                            <td className="pr-4 py-2">{row.carWashName}</td>
                            <td className="pr-4 py-2">{row.usedByName}</td>
                            <td className="pr-4 py-2">
                                {row.clientId ? (
                                    <Link to={`/ClientPage/${row.clientId}`} className="text-red hover:text-blue-500">
                                        {row.clientName || row.clientPhone}
                                    </Link>
                                ) : (
                                    "—"
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
