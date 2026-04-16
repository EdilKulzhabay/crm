import { useState, useEffect, useCallback } from "react";
import api from "../../api";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import Li2 from "../../Components/Li2";
import MyButton from "../../Components/MyButton";
import Container from "../../Components/Container";
import useFetchUserData from "../../customHooks/useFetchUserData";
import DataInput from "../../Components/DataInput";
import MySnackBar from "../../Components/MySnackBar";
import MyInput from "../../Components/MyInput";
import LinkButton from "../../Components/LinkButton";

const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) {
        return "0 ₸";
    }
    return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
};

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const formatPaidAt = (iso) => {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return String(iso);
    }
};

export default function SuperAdminPayments() {
    const userData = useFetchUserData();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [summary, setSummary] = useState({
        totalCount: 0,
        successCount: 0,
        failCount: 0,
        totalAmountSuccess: 0,
    });
    const [payments, setPayments] = useState([]);
    const [searchClient, setSearchClient] = useState("");
    const [dates, setDates] = useState({
        startDate: getCurrentDate(),
        endDate: getCurrentDate(),
    });
    const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");

    const closeSnack = () => {
        setOpen(false);
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDates((prev) => ({ ...prev, [name]: value }));
    };

    const loadPayments = useCallback((opts = {}) => {
        const { startDate, endDate } = dates;
        if (!startDate || !endDate || startDate.length !== 10 || endDate.length !== 10) {
            setOpen(true);
            setStatus("error");
            setMessage("Укажите даты в формате ГГГГ-ММ-ДД");
            return;
        }

        const search =
            opts.searchClient !== undefined ? opts.searchClient : searchClient;
        const ps =
            opts.paymentStatus !== undefined ? opts.paymentStatus : paymentStatusFilter;

        api.post(
            "/getClientPaymentsForSuperAdmin",
            {
                startDate,
                endDate,
                searchClient: String(search).trim(),
                paymentStatus: ps === "all" ? undefined : ps,
            },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                if (!data.success) {
                    setOpen(true);
                    setStatus("error");
                    setMessage(data.message || "Не удалось загрузить платежи");
                    return;
                }
                setSummary(
                    data.summary || {
                        totalCount: 0,
                        successCount: 0,
                        failCount: 0,
                        totalAmountSuccess: 0,
                    }
                );
                setPayments(Array.isArray(data.payments) ? data.payments : []);
            })
            .catch(() => {
                setOpen(true);
                setStatus("error");
                setMessage("Ошибка запроса");
            });
    }, [dates, searchClient, paymentStatusFilter]);

    useEffect(() => {
        loadPayments();
    }, []);

    const applyDateFilter = () => {
        loadPayments();
    };

    const applySearch = () => {
        loadPayments();
    };

    const clearSearch = () => {
        setSearchClient("");
        loadPayments({ searchClient: "" });
    };

    return (
        <div className="relative">
            <Container role={userData?.role}>
                <Div>Онлайн-платежи</Div>
                <Div />
                <Div>Сводная информация (по выбранным фильтрам):</Div>
                <Li>Всего записей: {summary.totalCount}</Li>
                <Li>Успешных: {summary.successCount}</Li>
                <Li>Неуспешных: {summary.failCount}</Li>
                <Li>
                    Сумма успешных пополнений:{" "}
                    {formatCurrency(summary.totalAmountSuccess || 0)}
                </Li>
                <Div />
                <Div>Фильтры:</Div>
                <Div>
                    <div>Поиск по клиенту (email, телефон, имя, userName или _id):</div>
                    <MyInput
                        color="white"
                        value={searchClient}
                        change={(e) => setSearchClient(e.target.value)}
                    />
                    <MyButton click={applySearch}>Найти</MyButton>
                    <MyButton click={clearSearch}>Сбросить поиск</MyButton>
                </Div>
                <Div />
                <Div>Статус платежа:</Div>
                <Li>
                    <MyButton
                        click={() => {
                            setPaymentStatusFilter("all");
                            loadPayments({ paymentStatus: "all" });
                        }}
                    >
                        <span
                            className={
                                paymentStatusFilter === "all"
                                    ? "text-green-400"
                                    : ""
                            }
                        >
                            Все
                        </span>
                    </MyButton>
                    <MyButton
                        click={() => {
                            setPaymentStatusFilter("success");
                            loadPayments({ paymentStatus: "success" });
                        }}
                    >
                        <span
                            className={
                                paymentStatusFilter === "success"
                                    ? "text-green-400"
                                    : ""
                            }
                        >
                            Успех
                        </span>
                    </MyButton>
                    <MyButton
                        click={() => {
                            setPaymentStatusFilter("fail");
                            loadPayments({ paymentStatus: "fail" });
                        }}
                    >
                        <span
                            className={
                                paymentStatusFilter === "fail"
                                    ? "text-green-400"
                                    : ""
                            }
                        >
                            Ошибка
                        </span>
                    </MyButton>
                    <MyButton click={() => loadPayments()}>Обновить список</MyButton>
                </Li>
                <Div />
                <Div>Период (дата платежа):</Div>
                <Li>
                    <div className="text-red">
                        [
                        <DataInput
                            color="red"
                            value={dates.startDate}
                            name="startDate"
                            change={handleDateChange}
                        />
                        ]
                    </div>
                    <div> - </div>
                    <div className="text-red">
                        [
                        <DataInput
                            color="red"
                            value={dates.endDate}
                            name="endDate"
                            change={handleDateChange}
                        />
                        ]
                    </div>
                    <MyButton click={applyDateFilter}>
                        <span className="text-green-400">Применить период</span>
                    </MyButton>
                </Li>
                <Div />
                {payments.length > 0 &&
                    payments.map((item) => (
                        <div key={item._id} className="mb-4 pb-2">
                            <Li>
                                {formatPaidAt(item.paidAt)} —{" "}
                                <span
                                    className={
                                        item.status === "success"
                                            ? "text-green-400"
                                            : "text-red-400"
                                    }
                                >
                                    {item.status === "success" ? "успех" : "ошибка"}
                                </span>
                                {" · "}
                                {formatCurrency(item.amount || 0)} {item.currency || "KZT"}
                            </Li>
                            <Li2>
                                Клиент:{" "}
                                {item.client
                                    ? `${item.client.fullName || "—"} · ${item.client.mail || "—"} · ${item.client.phone || "—"}`
                                    : "—"}
                            </Li2>
                            <Li2>
                                Сессия: {item.sessionOrderId || "—"} | инвойс:{" "}
                                {item.providerInvoiceId || "—"}
                            </Li2>
                            <Li2>
                                <LinkButton href={`/clientPage/${item?.client?._id}`}>Просмотр</LinkButton>
                            </Li2>
                        </div>
                    ))}
                {payments.length === 0 && <Li>Нет платежей по текущим фильтрам</Li>}
                <Div />
                <MySnackBar
                    open={open}
                    text={message}
                    status={status}
                    close={closeSnack}
                />
            </Container>
        </div>
    );
}
