/**
 * Диагностика ритма заказов клиента партнёра — ТОЛЬКО ЧТЕНИЕ, ничего не меняет.
 * Показывает последние заказы клиента (date.d, статус) и ритм так, как его считает сервер.
 *
 * Запуск на сервере: node scripts/diagnosePartnerRhythm.js <clientId | телефон>
 */
import "dotenv/config";
import mongoose from "mongoose";
import Client from "../Models/Client.js";
import Order from "../Models/Order.js";
import { getTodayAlmaty } from "../utils/dateUtils.js";
import { loadClientsRhythm } from "../utils/partnerClientActivity.js";

const RECENT_ORDERS = 10;
const query = process.argv[2];

if (!process.env.MONGOURL || !query) {
    console.error("Использование: node scripts/diagnosePartnerRhythm.js <clientId | телефон> (нужен MONGOURL в .env)");
    process.exit(1);
}

async function findClients() {
    if (mongoose.isValidObjectId(query)) return Client.find({ _id: query }).lean();
    const digits = query.replace(/\D/g, "").slice(-10);
    return Client.find({ phone: new RegExp(digits.split("").join("\\D*")) }).lean();
}

async function main() {
    await mongoose.connect(process.env.MONGOURL);
    const today = getTodayAlmaty();
    const clients = await findClients();
    if (clients.length === 0) console.log("Клиент не найден");
    // Несколько документов на один телефон — частая причина «не тех» заказов в ритме
    if (clients.length > 1) console.log(`Внимание: найдено клиентов с этим номером — ${clients.length}`);

    const rhythms = await loadClientsRhythm(clients.map((client) => client._id), today);
    for (const client of clients) {
        console.log(`\nКлиент ${client._id} «${client.userName || client.fullName}», партнёр: ${client.referredByPartner ?? "нет"}`);
        const orders = await Order.find({ client: client._id })
            .select("date status createdAt")
            .sort({ "date.d": -1 })
            .limit(RECENT_ORDERS)
            .lean();
        for (const order of orders) {
            console.log(`  ${order.date?.d ?? "—"}  ${order.status}  (создан ${order.createdAt?.toISOString().slice(0, 10) ?? "—"})`);
        }
        console.log(`  Ритм на ${today}:`, rhythms.get(String(client._id)) ?? "нет неотменённых заказов");
    }
    await mongoose.disconnect();
}

main().catch((error) => {
    console.error("Ошибка диагностики:", error);
    process.exit(1);
});
