import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import deliveryPartnerApi, { clearDeliveryPartnerToken, getDeliveryPartnerToken } from "../../deliveryPartnerApi";
import { OrdersList, OrdersSummary } from "../../Components/DeliveryPartner/DeliveryPartnerOrders";
import { downloadOrdersExcel, EMPTY_PERIOD } from "../../Components/DeliveryPartner/deliveryPartnerFormat";
import LogoText from "../../icons/LogoText";

const TABS = Object.freeze([
    { id: "active", title: "В работе" },
    { id: "history", title: "История" },
]);
/** «В работе» обновляется само, пока страница открыта */
const ACTIVE_REFRESH_MS = 60 * 1000;
const errorText = (e, fallback) => e?.response?.data?.message || fallback;

/**
 * Кабинет партнёра по доставке: заказы его курьеров — в работе и за период (итоги, Excel).
 * Данных клиента здесь нет — сервер их не отдаёт.
 */
export default function DeliveryPartnerMain() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [tab, setTab] = useState("active");
    const [courierId, setCourierId] = useState("");
    const [period, setPeriod] = useState(EMPTY_PERIOD);
    const [result, setResult] = useState({ orders: [], hasMore: false, summary: null });
    const [page, setPage] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState("");
    const requestId = useRef(0);

    useEffect(() => {
        if (!getDeliveryPartnerToken()) {
            navigate("/deliveryPartnerLogin", { replace: true });
            return;
        }
        deliveryPartnerApi
            .post("/getDeliveryPartnerMe")
            .then(({ data }) => setProfile(data))
            .catch((e) => setError(errorText(e, "Не удалось загрузить профиль")));
    }, [navigate]);

    const query = useCallback(
        (extra = {}) => ({
            scope: tab,
            ...(courierId && { courierId }),
            ...(tab === "history" && {
                ...(period.startDate && { startDate: period.startDate }),
                ...(period.endDate && { endDate: period.endDate }),
            }),
            ...extra,
        }),
        [tab, courierId, period]
    );

    /** Загружает страницу; page > 0 — дописывает к списку («Показать ещё») */
    const load = useCallback(
        async (nextPage = 0) => {
            const id = ++requestId.current;
            setIsLoading(true);
            setError("");
            try {
                const { data } = await deliveryPartnerApi.post("/getDeliveryPartnerOrders", query({ page: nextPage }));
                if (id !== requestId.current) return;
                setPage(nextPage);
                setResult((prev) => ({
                    orders: nextPage > 0 ? [...prev.orders, ...data.orders] : data.orders,
                    hasMore: data.hasMore,
                    summary: data.summary ?? null,
                }));
            } catch (e) {
                if (id === requestId.current) setError(errorText(e, "Не удалось загрузить заказы"));
            } finally {
                if (id === requestId.current) setIsLoading(false);
            }
        },
        [query]
    );

    useEffect(() => {
        if (!getDeliveryPartnerToken()) return undefined;
        load(0);
        if (tab !== "active") return undefined;
        const timer = setInterval(() => load(0), ACTIVE_REFRESH_MS);
        return () => clearInterval(timer);
    }, [load, tab]);

    const handleExport = async () => {
        setIsExporting(true);
        setError("");
        try {
            const { data } = await deliveryPartnerApi.post("/getDeliveryPartnerOrders", query({ export: true }));
            downloadOrdersExcel(data.orders, period);
            if (data.truncated) setError(`В файл попали первые ${data.orders.length} заказов. Сократите период.`);
        } catch (e) {
            setError(errorText(e, "Не удалось выгрузить заказы"));
        } finally {
            setIsExporting(false);
        }
    };

    const handleLogout = () => {
        clearDeliveryPartnerToken();
        navigate("/deliveryPartnerLogin", { replace: true });
    };

    const couriers = profile?.couriers ?? [];

    return (
        <div className="min-h-screen bg-[#F4F4F5] flex justify-center px-4 py-6">
            <div className="w-full max-w-5xl flex flex-col gap-y-4 text-black">
                <div className="flex items-center justify-between">
                    <LogoText className="w-[150px] h-[34px]" />
                    <button onClick={handleLogout} className="text-sm text-[#606B85]">
                        Выйти
                    </button>
                </div>
                {profile && (
                    <div>
                        <div className="text-lg font-medium">{profile.partner.name}</div>
                        <div className="text-sm text-[#606B85]">
                            Курьеров: {couriers.length}
                            {couriers.length > 0 && ` · на линии: ${couriers.filter((c) => c.onTheLine).length}`}
                        </div>
                    </div>
                )}
                {profile && couriers.length === 0 && (
                    <div className="bg-white rounded-xl p-4 text-sm">
                        К вам пока не привязан ни один курьер. Обратитесь к администратору «Тибетской».
                    </div>
                )}

                <div className="flex gap-x-2" role="tablist">
                    {TABS.map((item) => (
                        <button
                            key={item.id}
                            role="tab"
                            aria-selected={tab === item.id}
                            onClick={() => setTab(item.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                tab === item.id ? "bg-[#D12A2A] text-white" : "bg-white text-black"
                            }`}
                        >
                            {item.title}
                        </button>
                    ))}
                </div>

                <Filters
                    tab={tab}
                    couriers={couriers}
                    courierId={courierId}
                    onCourierChange={setCourierId}
                    period={period}
                    onPeriodChange={setPeriod}
                    onExport={handleExport}
                    isExporting={isExporting}
                />

                {error && <div className="text-sm text-red">{error}</div>}
                {tab === "history" && result.summary && <OrdersSummary summary={result.summary} />}
                <OrdersList
                    orders={result.orders}
                    emptyText={isLoading ? "Загружаем…" : tab === "active" ? "Сейчас заказов в работе нет" : "Заказов нет"}
                />
                {result.hasMore && (
                    <button
                        onClick={() => load(page + 1)}
                        disabled={isLoading}
                        className="w-full py-3 rounded-lg bg-white font-medium disabled:opacity-60"
                    >
                        {isLoading ? "Загружаем…" : "Показать ещё"}
                    </button>
                )}
            </div>
        </div>
    );
}

function Filters({ tab, couriers, courierId, onCourierChange, period, onPeriodChange, onExport, isExporting }) {
    const updatePeriod = (field) => (e) => onPeriodChange((prev) => ({ ...prev, [field]: e.target.value }));
    const inputClass = "p-2 rounded-lg bg-white outline-none text-sm";

    return (
        <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-y-1 text-xs text-[#606B85]">
                Курьер
                <select value={courierId} onChange={(e) => onCourierChange(e.target.value)} className={inputClass}>
                    <option value="">Все курьеры</option>
                    {couriers.map((courier) => (
                        <option key={courier.id} value={courier.id}>
                            {courier.fullName}
                            {courier.carNumber && ` (${courier.carNumber})`}
                        </option>
                    ))}
                </select>
            </label>
            {tab === "history" && (
                <>
                    <label className="flex flex-col gap-y-1 text-xs text-[#606B85]">
                        С
                        <input type="date" value={period.startDate} onChange={updatePeriod("startDate")} className={inputClass} />
                    </label>
                    <label className="flex flex-col gap-y-1 text-xs text-[#606B85]">
                        По
                        <input type="date" value={period.endDate} onChange={updatePeriod("endDate")} className={inputClass} />
                    </label>
                    {(period.startDate || period.endDate) && (
                        <button onClick={() => onPeriodChange(EMPTY_PERIOD)} className="px-4 py-2 rounded-lg bg-white text-sm">
                            Сбросить период
                        </button>
                    )}
                    <button
                        onClick={onExport}
                        disabled={isExporting}
                        className="px-4 py-2 rounded-lg bg-white text-sm font-medium disabled:opacity-60"
                    >
                        {isExporting ? "Готовим файл…" : "Скачать Excel"}
                    </button>
                </>
            )}
        </div>
    );
}
