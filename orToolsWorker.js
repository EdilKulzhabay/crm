import { Worker, QueueScheduler } from 'bullmq';
import redisConnection from './redis-config.js';
import orTools from './orTools.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 Запуск orTools воркера...');

// Создаем планировщик для обработки отложенных задач
const scheduler = new QueueScheduler('orTools', {
    connection: redisConnection,
});

// Создаем воркер для обработки задач
const worker = new Worker('orTools', async (job) => {
    console.log(`🚀 Начинаем выполнение orTools задачи ${job.id}`);
    console.log(`📊 Данные задачи:`, job.data);
    
    try {
        // Выполняем orTools
        const result = await orTools();
        
        console.log(`✅ Задача ${job.id} выполнена успешно`);
        return {
            success: true,
            result,
            completedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error(`❌ Ошибка при выполнении задачи ${job.id}:`, error);
        throw error; // BullMQ автоматически повторит задачу
    }
}, {
    connection: redisConnection,
    concurrency: 1, // Обрабатываем только одну задачу одновременно
});

// Обработчики событий воркера
worker.on('completed', (job, result) => {
    console.log(`✅ Задача ${job.id} завершена успешно`);
    console.log(`📈 Результат:`, result);
});

worker.on('failed', (job, err) => {
    console.error(`❌ Задача ${job.id} завершилась с ошибкой:`, err.message);
    console.error(`🔍 Детали ошибки:`, err);
});

worker.on('error', (err) => {
    console.error('❌ Ошибка воркера:', err);
});

worker.on('stalled', (jobId) => {
    console.warn(`⚠️  Задача ${jobId} зависла`);
});

worker.on('waiting', (jobId) => {
    console.log(`⏳ Задача ${jobId} ожидает выполнения`);
});

worker.on('active', (job) => {
    console.log(`🎯 Задача ${job.id} стала активной`);
});

console.log('✅ orTools воркер запущен и готов к работе');

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Получен сигнал SIGTERM, завершаем работу воркера...');
    await worker.close();
    await scheduler.close();
    await redisConnection.quit();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Получен сигнал SIGINT, завершаем работу воркера...');
    await worker.close();
    await scheduler.close();
    await redisConnection.quit();
    process.exit(0);
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
    console.error('💥 Необработанная ошибка:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Необработанное отклонение промиса:', reason);
    process.exit(1);
}); 