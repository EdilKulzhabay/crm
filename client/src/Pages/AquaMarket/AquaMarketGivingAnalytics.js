import { useCallback, useEffect, useState } from "react";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import Info from "../../Components/Info";
import DataInput from "../../Components/DataInput";
import MyButton from "../../Components/MyButton";
import api from "../../api";
import useFetchUserData from "../../customHooks/useFetchUserData";

const DATE_DIGITS = 8;

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

/** Маска ввода ГГГГ-ММ-ДД, как на остальных страницах аквамаркета */
const formatDateInput = (value) => {
    const digits = value.replace(/\D/g, "").substring(0, DATE_DIGITS);
    let formatted = digits.substring(0, 4);
    if (digits.length >= 5) formatted += "-" + digits.substring(4, 6);
    if (digits.length >= 7) formatted += "-" + digits.substring(6, 8);
    return formatted;
};

/** @param {{ full: { b12: number, b19: number }, empty: { b12: number, b19: number }, givingCount: number }} props */
function BottleStats({ full, empty, givingCount }) {
    return (
        <div className="flex items-center flex-wrap gap-x-3 text-sm lg:text-base">
            <span>Выдач: <Info ml="ml-1">{givingCount}</Info></span>
            <span>Вывезено 12,5л: <Info ml="ml-1">{full.b12}</Info></span>
            <span>18,9л: <Info ml="ml-1">{full.b19}</Info></span>
            <span className="text-gray-400">Сдано пустых 12,5л: {empty.b12}, 18,9л: {empty.b19}</span>
        </div>
    );
}

/** Аналитика выдачи полных бутылей курьерам из аквамаркетов за период (только суперадмин). */
export default function AquaMarketGivingAnalytics() {
    const userData = useFetchUserData();
    const [dates, setDates] = useState({ startDate: getCurrentDate(), endDate: getCurrentDate() });
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [expandedId, setExpandedId] = useState(null);

    const fetchReport = useCallback(async (range) => {
        setIsLoading(true);
        setError("");
        try {
            const { data } = await api.post("/getAquaMarketGivingAnalytics", range);
            setReport(data);
        } catch (e) {
            setError(e?.response?.data?.message || "Не удалось загрузить аналитику");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReport({ startDate: getCurrentDate(), endDate: getCurrentDate() });
    }, [fetchReport]);

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDates((prev) => ({ ...prev, [name]: formatDateInput(value) }));
    };

    const aquaMarkets = report?.aquaMarkets || [];

    return (
        <Container role={userData?.role}>
            <Div>Вывоз из аквамаркетов (выдача курьерам)</Div>
            <Div />
            <Div>
                <DataInput type="date" name="startDate" value={dates.startDate} change={handleDateChange} />
                <DataInput type="date" name="endDate" value={dates.endDate} change={handleDateChange} />
                <MyButton click={() => fetchReport(dates)}>Применить</MyButton>
            </Div>
            <Div />
            {error && <Div><span className="text-red">{error}</span></Div>}
            {isLoading && <Div>Загрузка...</Div>}
            {!isLoading && report && (
                <>
                    <Div>Итого по всем аквамаркетам:</Div>
                    <Li><BottleStats {...report.totals} /></Li>
                    <Div />
                    {aquaMarkets.length === 0 && <Div>За выбранный период выдач не было</Div>}
                    {aquaMarkets.map((market) => {
                        const isExpanded = expandedId === String(market.aquaMarketId);
                        return (
                            <div key={String(market.aquaMarketId)}>
                                <Li>
                                    <div className="flex flex-col gap-y-1">
                                        <div className="flex items-center flex-wrap gap-x-3">
                                            <span className="text-yellow-400">{market.address}</span>
                                            <MyButton click={() => setExpandedId(isExpanded ? null : String(market.aquaMarketId))}>
                                                {isExpanded ? "Скрыть курьеров" : `Курьеры (${market.couriers.length})`}
                                            </MyButton>
                                        </div>
                                        <BottleStats {...market.totals} />
                                    </div>
                                </Li>
                                {isExpanded && market.couriers.map((courier) => (
                                    <Li key={String(courier.courierId)}>
                                        <div className="flex flex-col gap-y-1 pl-6">
                                            <span>{courier.courierName}</span>
                                            <BottleStats {...courier} />
                                        </div>
                                    </Li>
                                ))}
                            </div>
                        );
                    })}
                </>
            )}
            <Div />
        </Container>
    );
}
