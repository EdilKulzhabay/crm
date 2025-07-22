import { addOrToolsJob, getQueueStatus, getJobResult, waitForJobCompletion } from './bullmqOrTools.js';
import { testRedisConnection } from './redis-config.js';

async function testBullMQ() {
    console.log('🧪 Начинаем тестирование BullMQ...');
    
    // Проверяем подключение к Redis
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
        console.error('❌ Не удалось подключиться к Redis');
        return;
    }
    
    try {
        // Получаем текущий статус очереди
        console.log('\n📊 Текущий статус очереди:');
        const initialStatus = await getQueueStatus();
        console.log(initialStatus);
        
        // Добавляем тестовую задачу
        console.log('\n📋 Добавляем тестовую задачу...');
        const job = await addOrToolsJob('test_bullmq_1');
        console.log(`✅ Задача добавлена с ID: ${job.id}`);
        
        // Получаем обновленный статус
        console.log('\n📊 Обновленный статус очереди:');
        const updatedStatus = await getQueueStatus();
        console.log(updatedStatus);
        
        // Ждем завершения задачи (максимум 5 минут)
        console.log('\n⏳ Ожидаем завершения задачи...');
        const result = await waitForJobCompletion(job.id, 300000);
        console.log('✅ Задача завершена:');
        console.log(result);
        
        // Получаем финальный статус
        console.log('\n📊 Финальный статус очереди:');
        const finalStatus = await getQueueStatus();
        console.log(finalStatus);
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error);
    }
}

// Запускаем тест
testBullMQ().then(() => {
    console.log('\n🏁 Тестирование завершено');
    process.exit(0);
}).catch((error) => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
}); 