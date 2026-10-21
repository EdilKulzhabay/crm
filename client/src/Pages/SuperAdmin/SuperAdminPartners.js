import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import ConfirmChangeModal from "../../Components/ConfirmChangeModal";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import LinkButton from "../../Components/LinkButton";
import MySnackBar from "../../Components/MySnackBar";
import PartnerPeriodFilter from "../../Components/Partners/PartnerPeriodFilter";
import PartnerStats from "../../Components/Partners/PartnerStats";
import {
    formatDate,
    formatTenge,
    PARTNER_STATUS_LABELS,
    VERIFICATION_CLASSES,
    VERIFICATION_LABELS,
} from "../../Components/Partners/partnerFormat";
import useFetchUserData from "../../customHooks/useFetchUserData";

const SEARCH_DEBOUNCE_MS = 300;
const STATUS_FILTERS = [
    ["", "Все"],
    ["active", "Активные"],
    ["blocked", "Заблокированные"],
];
const VERIFICATION_FILTERS = [
    ["", "Любая проверка"],
    ["waiting", "На проверке"],
    ["verified", "Подтверждённые"],
    ["denied", "Отклонённые"],
];

function FilterButtons({ options, value, onChange }) {
    return options.map(([option, label]) => (
        <button
            key={option || "all"}
            onClick={() => onChange(option)}
            className={value === option ? "text-yellow-400" : "text-green-400 hover:text-blue-500"}
        >
            [ {label} ]
        </button>
    ));
}

/** Список партнёров (приложение «Тибетская Партнёр») со сводкой и аналитикой за период. Только суперадмин */
export default function SuperAdminPartners() {
    const userData = useFetchUserData();
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("");
    const [verification, setVerification] = useState("");
    const [period, setPeriod] = useState({ startDate: "", endDate: "" });
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [isLapseModalOpen, setIsLapseModalOpen] = useState(false);
    const [isLapseRunning, setIsLapseRunning] = useState(false);

    /** Та же проверка ритма, что ежедневно в 11:00: за один перерыв клиента партнёр получает одно уведомление */
    const runLapseCheck = async ({ changedBy, reason }) => {
        setIsLapseModalOpen(false);
        setIsLapseRunning(true);
        try {
            const { data: response } = await api.post("/runPartnerLapseCheckAdmin", { changedBy, reason });
            setNotice(
                response.notified > 0
                    ? `Проверка выполнена: отправлено уведомлений — ${response.notified}`
                    : "Проверка выполнена: новых перерывов нет, уведомления не отправлялись"
            );
        } catch (e) {
            setError(e?.response?.data?.message || "Не удалось выполнить проверку");
        } finally {
            setIsLapseRunning(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(() => {
            api.post("/getPartnersAdmin", { query, status, verification, ...period })
                .then(({ data: response }) => {
                    if (!cancelled) setData(response);
                })
                .catch((e) => {
                    if (!cancelled) setError(e?.response?.data?.message || "Не удалось загрузить партнёров");
                });
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, status, verification, period]);

    if (userData?.role !== "superAdmin") {
        return (
            <Container role={userData?.role}>
                <Div>Нет доступа</Div>
                <LinkButton href="/superAdmin">Назад</LinkButton>
            </Container>
        );
    }

    return (
        <Container role={userData?.role}>
            {isLapseModalOpen && (
                <ConfirmChangeModal
                    title="Запустить проверку ритма заказов? Партнёры получат уведомления о клиентах, которые перестали заказывать."
                    onConfirm={runLapseCheck}
                    onCancel={() => setIsLapseModalOpen(false)}
                />
            )}
            <Div>Партнёры (приложение «Тибетская Партнёр»)</Div>
            <Div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {isLapseRunning ? (
                        <span className="opacity-70">Проверка ритма выполняется…</span>
                    ) : (
                        <button className="text-green-400 hover:text-blue-500" onClick={() => setIsLapseModalOpen(true)}>
                            [ Проверить ритм клиентов сейчас ]
                        </button>
                    )}
                    <span className="text-sm opacity-70">Автоматически — каждый день в 11:00</span>
                </div>
            </Div>
            <Div />
            <Div>
                <PartnerPeriodFilter period={period} onChange={setPeriod} />
            </Div>
            {data && (
                <>
                    <Div>
                        Сводка: партнёров {data.summary.partners}, активных {data.summary.activePartners}
                        {data.summary.waitingVerification > 0 && (
                            <span className="text-yellow-400">, ждут проверки {data.summary.waitingVerification}</span>
                        )}
                    </Div>
                    <PartnerStats stats={data.summary} />
                </>
            )}
            <Div />
            <Div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Поиск: имя, телефон или код"
                        style={{ fontSize: "16px" }}
                        className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base"
                    />
                    <FilterButtons options={STATUS_FILTERS} value={status} onChange={setStatus} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                    <FilterButtons options={VERIFICATION_FILTERS} value={verification} onChange={setVerification} />
                </div>
            </Div>
            <Div />
            {data && <PartnersTable partners={data.partners} />}
            {data?.isTruncated && <Div>Показаны первые 500 партнёров — уточните поиск.</Div>}
            <MySnackBar open={Boolean(error)} status="error" text={error} close={() => setError("")} />
            <MySnackBar open={Boolean(notice)} status="success" text={notice} close={() => setNotice("")} />
        </Container>
    );
}

function PartnersTable({ partners }) {
    if (partners.length === 0) return <Div>Партнёры не найдены</Div>;
    const headers = ["Партнёр", "Код", "Статус", "Проверка", "Клиенты", "Начислено", "Бутыли", "Выплачено", "Баланс", "К выплате", "Вход"];

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
                    {partners.map((partner) => (
                        <tr key={partner.id} className="border-t border-white/20">
                            <td className="pr-4 py-2">
                                <Link to={`/superAdminPartner/${partner.id}`} className="text-red hover:text-blue-500">
                                    {partner.userName}
                                </Link>
                                <div className="text-sm opacity-70">{partner.phone}</div>
                            </td>
                            <td className="pr-4 py-2 whitespace-nowrap">{partner.referralCode}</td>
                            <td className={`pr-4 py-2 ${partner.status === "blocked" ? "text-red" : ""}`}>
                                {PARTNER_STATUS_LABELS[partner.status] ?? partner.status}
                            </td>
                            <td className={`pr-4 py-2 whitespace-nowrap ${VERIFICATION_CLASSES[partner.verificationStatus] ?? ""}`}>
                                {VERIFICATION_LABELS[partner.verificationStatus] ?? partner.verificationStatus}
                            </td>
                            <td className="pr-4 py-2 whitespace-nowrap">
                                {partner.clients} / {partner.orderedClients}
                            </td>
                            <td className="pr-4 py-2 whitespace-nowrap">{formatTenge(partner.earned)}</td>
                            <td className="pr-4 py-2">{partner.bottles}</td>
                            <td className="pr-4 py-2 whitespace-nowrap">{formatTenge(partner.paidOut)}</td>
                            <td className="pr-4 py-2 whitespace-nowrap">{formatTenge(partner.balance)}</td>
                            <td className={`pr-4 py-2 whitespace-nowrap ${partner.pendingCount ? "text-yellow-400" : ""}`}>
                                {formatTenge(partner.pendingOut)}
                            </td>
                            <td className="pr-4 py-2 whitespace-nowrap">{formatDate(partner.lastLoginAt)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="text-sm opacity-70 mt-2">
                Клиенты: всего / заказывали. Начислено, бутыли и выплачено — за выбранный период.
            </div>
        </div>
    );
}
