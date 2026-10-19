/**
 * Снимает прежний уникальный индекс partnertransactions { client: 1, type: 1 } (referral_bonus).
 * Он разрешал бонус за клиента только одному партнёру; теперь уникальность — { client, partner, type },
 * чтобы при смене партнёра клиента в CRM новый партнёр тоже получал бонус. Новый индекс создаёт Mongoose.
 *
 * Запуск (до деплоя или сразу после): node migrations/drop_partner_referral_client_index.js
 * Повторный запуск безопасен.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URL = process.env.MONGOURL;
const LEGACY_INDEX = 'client_1_type_1';
const INDEX_NOT_FOUND = 27;

if (!MONGO_URL) {
  console.error('❌ MONGOURL не задан в .env');
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(MONGO_URL);
  try {
    await mongoose.connection.db.collection('partnertransactions').dropIndex(LEGACY_INDEX);
    console.log(`✅ Индекс ${LEGACY_INDEX} удалён`);
  } catch (error) {
    if (error?.code !== INDEX_NOT_FOUND) throw error;
    console.log(`ℹ️ Индекса ${LEGACY_INDEX} нет — уже удалён`);
  } finally {
    await mongoose.disconnect();
  }
}

migrate().catch((error) => {
  console.error('❌ Миграция не выполнена:', error);
  process.exit(1);
});
