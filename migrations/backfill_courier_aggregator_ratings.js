/**
 * Разовый пересчёт CourierAggregator.raiting по уже существующим отзывам
 * (Order.clientReview на доставленных заказах), чтобы рейтинг курьеров,
 * оформивших доставки до внедрения recalculateCourierAggregatorRating,
 * не оставался равным 0.
 *
 * Запуск:
 *   cd crm && node migrations/backfill_courier_aggregator_ratings.js
 *
 * Требуется MONGOURL в .env
 */

import "dotenv/config";
import mongoose from "mongoose";
import CourierAggregator from "../Models/CourierAggregator.js";
import { recalculateCourierAggregatorRating } from "../utils/courierRating.js";

const MONGO_URL = process.env.MONGOURL;

if (!MONGO_URL) {
    console.error("❌ MONGOURL не задан в .env");
    process.exit(1);
}

async function main() {
    await mongoose.connect(MONGO_URL);
    console.log("✅ Подключено к MongoDB");

    const cursor = CourierAggregator.find({}).select("_id").cursor();
    let processed = 0;
    let errors = 0;

    for await (const courier of cursor) {
        processed++;
        try {
            await recalculateCourierAggregatorRating(courier._id);
        } catch (e) {
            errors++;
            console.error(`Ошибка курьера ${courier._id}:`, e?.message || e);
        }

        if (processed % 200 === 0) {
            console.log(`… обработано курьеров: ${processed}`);
        }
    }

    console.log(`Готово. Курьеров обработано: ${processed}, ошибок: ${errors}`);
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
