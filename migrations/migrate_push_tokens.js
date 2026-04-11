/**
 * Миграционный скрипт: notificationPushToken (String) → notificationPushTokens (Array)
 *
 * Для каждого клиента, у которого есть непустой notificationPushToken,
 * добавляет его в массив notificationPushTokens (если ещё не присутствует).
 *
 * Запуск:
 *   node --experimental-modules migrations/migrate_push_tokens.js
 *
 * Скрипт использует переменную окружения MONGOURL (из .env) для подключения.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URL = process.env.MONGOURL;

if (!MONGO_URL) {
  console.error('❌ MONGOURL не задан в .env');
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(MONGO_URL);
  console.log('✅ Подключено к MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('clients');

  // 1. Находим клиентов с непустым notificationPushToken
  const cursor = collection.find({
    notificationPushToken: { $exists: true, $ne: '' },
  });

  let updated = 0;
  let skipped = 0;
  let total = 0;

  for await (const client of cursor) {
    total++;
    const token = client.notificationPushToken;
    const existing = client.notificationPushTokens || [];

    if (existing.includes(token)) {
      skipped++;
      continue;
    }

    await collection.updateOne(
      { _id: client._id },
      { $addToSet: { notificationPushTokens: token } }
    );
    updated++;
  }

  // 2. Инициализируем пустой массив у клиентов, где поле вообще отсутствует
  const initResult = await collection.updateMany(
    { notificationPushTokens: { $exists: false } },
    { $set: { notificationPushTokens: [] } }
  );

  console.log(`\n📊 Итоги миграции:`);
  console.log(`   Всего клиентов с notificationPushToken: ${total}`);
  console.log(`   Перенесено в массив: ${updated}`);
  console.log(`   Уже присутствовали в массиве: ${skipped}`);
  console.log(`   Инициализировано пустым массивом: ${initResult.modifiedCount}`);

  await mongoose.connection.close();
  console.log('\n✅ Миграция завершена, соединение закрыто');
}

migrate().catch((err) => {
  console.error('❌ Ошибка миграции:', err);
  process.exit(1);
});
