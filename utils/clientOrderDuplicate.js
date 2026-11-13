/**
 * Один заказ клиента на один адрес в один день (не считая отменённых).
 *
 * Адреса сравниваются нормализованными: приложения собирают строку адреса в разных
 * местах по-разному (регистр, пробелы, «квартира»/«офис» у юрлиц), точное сравнение
 * строк пропускало такие дубли.
 *
 * Если дубль создал сам сервер после оплаты Kaspi (pendingOrderDraft, см. ApiPayController),
 * клиент, вернувшись в приложение, повторяет тот же заказ — это не ошибка: отвечаем прежним
 * текстом, который все версии приложения считают успехом. Настоящий дубль — новым текстом,
 * который приложение показывает как ошибку.
 */
export const ORDER_EXISTS_CODES = Object.freeze({
    createdAfterPayment: "ORDER_CREATED_AFTER_PAYMENT",
    duplicate: "ORDER_DUPLICATE",
});

/** Старые версии приложения сравнивают ответ с этим текстом — не менять */
export const ORDER_CREATED_AFTER_PAYMENT_MESSAGE = "Заказ на эту дату уже существует";
export const DUPLICATE_ORDER_MESSAGE =
    "На этот адрес уже есть заказ на выбранную дату. Выберите другую дату или измените существующий заказ.";

/** Счёт Kaspi, по которому сервер сам создал заказ, учитываем сутки после оплаты */
const PAYMENT_CREATED_WINDOW_MS = 24 * 60 * 60 * 1000;

export const normalizeOrderAddress = (actual) =>
    String(actual ?? "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/квартира/g, "офис")
        .replace(/\s*,\s*/g, ", ")
        .replace(/\s+/g, " ")
        .replace(/[\s,.]+$/, "")
        .trim();

export const isSameOrderAddress = (left, right) => {
    const normalized = normalizeOrderAddress(left);
    return normalized !== "" && normalized === normalizeOrderAddress(right);
};

/**
 * null — дубля нет; иначе { code, message } для ответа клиенту.
 * dates — варианты date.d (как прислал клиент и нормализованная): старые заказы
 * сохранены с тем, что прислало приложение.
 */
export async function findDuplicateClientOrder({
    OrderModel,
    ApiPayInvoiceModel,
    clientId,
    dates,
    actual,
    now = new Date(),
}) {
    if (normalizeOrderAddress(actual) === "") {
        return null;
    }
    const uniqueDates = [...new Set(dates.filter((d) => typeof d === "string" && d !== ""))];
    if (uniqueDates.length === 0) {
        return null;
    }

    const sameDayOrders = await OrderModel.find({
        client: clientId,
        "date.d": { $in: uniqueDates },
        status: { $ne: "cancelled" },
    })
        .select("address.actual")
        .lean();
    if (!sameDayOrders.some((order) => isSameOrderAddress(order.address?.actual, actual))) {
        return null;
    }

    const paidInvoices = await ApiPayInvoiceModel.find({
        client: clientId,
        pendingOrderApplied: true,
        paidAt: { $gte: new Date(now.getTime() - PAYMENT_CREATED_WINDOW_MS) },
        "pendingOrderDraft.date.d": { $in: uniqueDates },
    })
        .select("pendingOrderDraft.address.actual")
        .lean();
    const isCreatedAfterPayment = paidInvoices.some((invoice) =>
        isSameOrderAddress(invoice.pendingOrderDraft?.address?.actual, actual)
    );

    return isCreatedAfterPayment
        ? { code: ORDER_EXISTS_CODES.createdAfterPayment, message: ORDER_CREATED_AFTER_PAYMENT_MESSAGE }
        : { code: ORDER_EXISTS_CODES.duplicate, message: DUPLICATE_ORDER_MESSAGE };
}

/**
 * Заказы одного клиента создаются по очереди: два одновременных запроса (двойное нажатие,
 * два устройства) иначе оба проходят проверку на дубль. Работает в пределах процесса.
 */
const clientOrderQueues = new Map();

export async function withClientOrderLock(clientId, task) {
    const key = String(clientId);
    const previous = clientOrderQueues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    const tail = current.catch(() => undefined);
    clientOrderQueues.set(key, tail);
    try {
        return await current;
    } finally {
        if (clientOrderQueues.get(key) === tail) {
            clientOrderQueues.delete(key);
        }
    }
}
