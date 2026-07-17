import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
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

const STATUS_LABELS = {
    pending: "Ожидает оплаты",
    processing: "В обработке",
    paid: "Оплачен",
    cancelled: "Отменён",
    expired: "Истёк",
    refunded: "Возврат",
    partially_refunded: "Частичный возврат",
    error: "Ошибка",
};

const STATUS_COLORS = {
    paid: "text-green-400",
    pending: "text-yellow-400",
    processing: "text-yellow-400",
    cancelled: "text-red-400",
    expired: "text-red-400",
    error: "text-red-400",
    refunded: "text-red-400",
    partially_refunded: "text-red-400",
};

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

const formatDate = (iso) => {
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

const getInvoiceCourierLabel = (order) => {
    const courier = order?.courier;
    const aggregator = order?.courierAggregator;
    const c = courier || aggregator;
    if (!c) return "—";
    return `${c.fullName || "—"}${c.phone ? ` · ${c.phone}` : ""}`;
};

export default function SuperAdminCourierQrPayments() {
    const userData = useFetchUserData();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [summary, setSummary] = useState({
        totalCount: 0,
        paidCount: 0,
        totalAmountPaid: 0,
    });
    const [invoices, setInvoices] = useState([]);
    const [search, setSearch] = useState("");
    const [dates, setDates] = useState({
        startDate: getCurrentDate(),
        endDate: getCurrentDate(),
    });
    const [statusFilter, setStatusFilter] = useState("all");

    const closeSnack = () => {
        setOpen(false);
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDates((prev) => ({ ...prev, [name]: value }));
    };

    const loadInvoices = useCallback((opts = {}) => {
        const { startDate, endDate } = dates;
        if (!startDate || !endDate || startDate.length !== 10 || endDate.length !== 10) {
            setOpen(true);
            setStatus("error");
            setMessage("Укажите даты в формате ГГГГ-ММ-ДД");
            return;
        }

        const searchValue = opts.search !== undefined ? opts.search : search;
        const statusValue = opts.status !== undefined ? opts.status : statusFilter;

        api.post(
            "/getCourierQrInvoicesForSuperAdmin",
            {
                startDate,
                endDate,
                search: String(searchValue).trim(),
                status: statusValue === "all" ? undefined : statusValue,
            },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                if (!data.success) {
                    setOpen(true);
                    setStatus("error");
                    setMessage(data.message || "Не удалось загрузить историю QR-платежей");
                    return;
                }
                setSummary(
                    data.summary || { totalCount: 0, paidCount: 0, totalAmountPaid: 0 }
                );
                setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
            })
            .catch(() => {
                setOpen(true);
                setStatus("error");
                setMessage("Ошибка запроса");
            });
    }, [dates, search, statusFilter]);

    useEffect(() => {
        loadInvoices();
    }, []);

    const applyDateFilter = () => {
        loadInvoices();
    };

    const applySearch = () => {
        loadInvoices();
    };

    const clearSearch = () => {
        setSearch("");
        loadInvoices({ search: "" });
    };

    const exportToExcel = () => {
        if (invoices.length === 0) {
            setOpen(true);
            setStatus("error");
            setMessage("Нет данных для выгрузки");
            return;
        }

        const mappedData = invoices.map((item) => ({
            "Сумма": item?.amount || 0,
            "Статус": STATUS_LABELS[item?.status] || item?.status || "—",
            "Дата оплаты": formatDate(item?.paidAt),
            "Курьер": getInvoiceCourierLabel(item?.order),
            "Заказ": item?.order?._id || item?.externalOrderId || "—",
            "Адрес заказа": item?.order?.address?.name || "—",
            "Клиент": item?.order?.client?.fullName || "—",
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(mappedData);
        XLSX.utils.book_append_sheet(workbook, worksheet, "QR Payments");

        const fileName = `courier_qr_payments_${dates.startDate}_${dates.endDate}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="relative">
            <Container role={userData?.role}>
                <Div>История QR-платежей курьеров (Kaspi Pay)</Div>
                <Div />
                <Div>Сводная информация (по выбранным фильтрам):</Div>
                <Li>Всего QR-счетов: {summary.totalCount}</Li>
                <Li>Оплачено: {summary.paidCount}</Li>
                <Li>Сумма оплаченных: {formatCurrency(summary.totalAmountPaid || 0)}</Li>
                <Div />
                <Div>Фильтры:</Div>
                <Div>
                    <div>Поиск (курьер, клиент, почта, телефон, адрес заказа, ID заказа):</div>
                    <MyInput
                        color="white"
                        value={search}
                        change={(e) => setSearch(e.target.value)}
                    />
                    <MyButton click={applySearch}>Найти</MyButton>
                    <MyButton click={clearSearch}>Сбросить поиск</MyButton>
                </Div>
                <Div />
                <Div>Статус:</Div>
                <Li>
                    <MyButton
                        click={() => {
                            setStatusFilter("all");
                            loadInvoices({ status: "all" });
                        }}
                    >
                        <span className={statusFilter === "all" ? "text-green-400" : ""}>
                            Все
                        </span>
                    </MyButton>
                    {Object.entries(STATUS_LABELS)
                        .filter(([key]) => key !== "partially_refunded")
                        .map(([key, label]) => (
                            <MyButton
                                key={key}
                                click={() => {
                                    setStatusFilter(key);
                                    loadInvoices({ status: key });
                                }}
                            >
                                <span className={statusFilter === key ? "text-green-400" : ""}>
                                    {label}
                                </span>
                            </MyButton>
                        ))}
                    <MyButton click={() => loadInvoices()}>Обновить список</MyButton>
                    <MyButton click={exportToExcel}>Экспорт в Excel</MyButton>
                </Li>
                <Div />
                <Div>Период (дата создания QR):</Div>
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
                {invoices.length > 0 &&
                    invoices.map((item) => (
                        <div key={item._id} className="mb-4 pb-2">
                            <Li>
                                {formatDate(item.createdAt)} —{" "}
                                <span className={STATUS_COLORS[item.status] || ""}>
                                    {STATUS_LABELS[item.status] || item.status}
                                </span>
                                {" · "}
                                {formatCurrency(item.amount || 0)}
                                {" · оплачен: "}
                                {formatDate(item.paidAt)}
                            </Li>
                            <Li2>Курьер: {getInvoiceCourierLabel(item.order)}</Li2>
                            <Li2>
                                Заказ: {item?.order?.address?.name || "—"} | Клиент:{" "}
                                {item?.order?.client
                                    ? `${item.order.client.fullName || "—"} · ${item.order.client.phone || "—"}`
                                    : "—"}
                            </Li2>
                            {item?.order?._id && (
                                <Li2>
                                    <LinkButton href={`/orderPage/${item.order._id}`}>
                                        Просмотр
                                    </LinkButton>
                                </Li2>
                            )}
                        </div>
                    ))}
                {invoices.length === 0 && <Li>Нет QR-платежей по текущим фильтрам</Li>}
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
