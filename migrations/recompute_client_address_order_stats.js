/**
 * Пересчёт по истории заказов для каждого адреса клиента:
 * - lastOrderDate — дата последнего доставленного заказа по адресу
 * - orderPeriodicityDays — средний интервал в днях по последним до 5 доставленным заказам
 * - shouldOrderBySchedule — пора ли заказать (календарь Алматы: сегодня >= last + N дней)
 *
 * Рекомендуется по cron раз в месяц (или чаще при необходимости):
 *   cd crm && node migrations/recompute_client_address_order_stats.js
 *
 * Требуется MONGOURL в .env
 */

import "dotenv/config";
import mongoose from "mongoose";
import Client from "../Models/Client.js";
import Order from "../Models/Order.js";
import { buildUpdatedAddressesWithStats } from "../utils/clientAddressOrderStats.js";

const MONGO_URL = process.env.MONGOURL;

if (!MONGO_URL) {
    console.error("❌ MONGOURL не задан в .env");
    process.exit(1);
}

async function main() {
    await mongoose.connect(MONGO_URL);
    console.log("✅ Подключено к MongoDB");

    const cursor = Client.find({
        addresses: { $exists: true, $type: "array", $ne: [] },
    }).cursor();
    let processed = 0;
    let updated = 0;
    let errors = 0;

    for await (const client of cursor) {
        processed++;
        try {
            const deliveredOrders = await Order.find({
                client: client._id,
                status: "delivered",
            })
                .select("address createdAt")
                .sort({ createdAt: -1 })
                .lean();

            const newAddresses = buildUpdatedAddressesWithStats(
                client,
                deliveredOrders
            );

            await Client.updateOne(
                { _id: client._id },
                { $set: { addresses: newAddresses } }
            );
            updated++;
        } catch (e) {
            errors++;
            console.error(
                `Ошибка клиента ${client._id}:`,
                e?.message || e
            );
        }

        if (processed % 200 === 0) {
            console.log(`… обработано клиентов: ${processed}`);
        }
    }

    console.log(
        `Готово. Клиентов обработано: ${processed}, успешно обновлено: ${updated}, ошибок: ${errors}`
    );
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
