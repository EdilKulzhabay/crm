import * as XLSX from "xlsx";

export const ORDER_STATUS_LABELS = Object.freeze({
    awaitingOrder: "Ожидает",
    onTheWay: "В пути",
    delivered: "Доставлен",
    cancelled: "Отменён",
});

const TIME_ZONE = "Asia/Almaty";
const DAYS_IN_WEEK = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const statusLabel = (status) => ORDER_STATUS_LABELS[status] ?? status ?? "—";

/** YYYY-MM-DD по Алматы — как Order.date.d */
export const almatyDay = (date = new Date()) => date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

/** Период по умолчанию — последние 7 дней, включая сегодня */
export const defaultPeriod = () => ({
    startDate: almatyDay(new Date(Date.now() - (DAYS_IN_WEEK - 1) * DAY_MS)),
    endDate: almatyDay(),
});

export const formatMoney = (value) => `${Number(value || 0).toLocaleString("ru-RU")} ₸`;

export const formatDateTime = (value) =>
    value ? new Date(value).toLocaleString("ru-RU", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" }) : "—";

/** «2 × 18,9 л, 1 × 12,5 л» */
export const formatBottles = ({ b19, b12 }) =>
    [b19 > 0 && `${b19} × 18,9 л`, b12 > 0 && `${b12} × 12,5 л`].filter(Boolean).join(", ") || "—";

/** Excel со списком заказов; имя файла — период */
export function downloadOrdersExcel(orders, { startDate, endDate }) {
    const rows = orders.map((order) => ({
        Дата: order.date,
        Время: order.time,
        Курьер: order.courierName,
        Статус: statusLabel(order.status),
        Адрес: order.address,
        "18,9 л": order.b19,
        "12,5 л": order.b12,
        "Сумма, ₸": order.sum,
        Доставлен: order.deliveredTime ? formatDateTime(order.deliveredTime) : "",
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Заказы");
    XLSX.writeFile(workbook, `Заказы ${startDate} — ${endDate}.xlsx`);
}
