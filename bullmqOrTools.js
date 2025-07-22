import { Queue, Worker, QueueScheduler } from 'bullmq';
import redisConnection from './redis-config.js';
import orTools from './orTools.js';

// Создаем очередь для orTools задач
const orToolsQueue = new Queue('orTools', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: 10, // Оставляем последние 10 завершенных задач
        removeOnFail: 5,      // Оставляем последние 5 неудачных задач
        attempts: 3,          // Максимум 3 попытки
        backoff: {
            type: 'exponential',
            delay: 2000,      // Начальная задержка 2 секунды
        },
    },
});

// Создаем планировщик для обработки отложенных задач
const scheduler = new QueueScheduler('orTools', {
    connection: redisConnection,
});

// Создаем воркер для обработки задач
const worker = new Worker('orTools', async (job) => {
    console.log(`🚀 Начинаем выполнение orTools задачи ${job.id}`);
    
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
});

worker.on('failed', (job, err) => {
    console.error(`❌ Задача ${job.id} завершилась с ошибкой:`, err.message);
});

worker.on('error', (err) => {
    console.error('❌ Ошибка воркера:', err);
});

// Функция для добавления задачи в очередь
export const addOrToolsJob = async (requestId = null, options = {}) => {
    const jobId = requestId || `orTools_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job = await orToolsQueue.add('optimize', {
        requestId: jobId,
        timestamp: new Date().toISOString(),
    }, {
        jobId,
        ...options,
    });
    
    console.log(`📋 Задача ${jobId} добавлена в очередь BullMQ`);
    return job;
};

// Функция для получения статуса очереди
export const getQueueStatus = async () => {
    const waiting = await orToolsQueue.getWaiting();
    const active = await orToolsQueue.getActive();
    const completed = await orToolsQueue.getCompleted();
    const failed = await orToolsQueue.getFailed();
    
    return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length,
        activeJobs: active.map(job => ({
            id: job.id,
            timestamp: job.data.timestamp,
            requestId: job.data.requestId,
        })),
        waitingJobs: waiting.map(job => ({
            id: job.id,
            timestamp: job.data.timestamp,
            requestId: job.data.requestId,
        })),
    };
};

// Функция для очистки очереди
export const clearQueue = async () => {
    await orToolsQueue.obliterate();
    console.log('🧹 Очередь BullMQ очищена');
};

// Функция для получения результата конкретной задачи
export const getJobResult = async (jobId) => {
    const job = await orToolsQueue.getJob(jobId);
    if (!job) {
        throw new Error(`Задача ${jobId} не найдена`);
    }
    
    const state = await job.getState();
    const result = job.returnvalue;
    const failedReason = job.failedReason;
    
    return {
        id: job.id,
        state,
        result,
        failedReason,
        timestamp: job.data.timestamp,
        requestId: job.data.requestId,
    };
};

// Функция для ожидания завершения задачи
export const waitForJobCompletion = async (jobId, timeout = 300000) => { // 5 минут по умолчанию
    const job = await orToolsQueue.getJob(jobId);
    if (!job) {
        throw new Error(`Задача ${jobId} не найдена`);
    }
    
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Таймаут ожидания задачи ${jobId}`));
        }, timeout);
        
        const checkJob = async () => {
            const state = await job.getState();
            if (state === 'completed') {
                clearTimeout(timeoutId);
                resolve(await getJobResult(jobId));
            } else if (state === 'failed') {
                clearTimeout(timeoutId);
                reject(new Error(`Задача ${jobId} завершилась с ошибкой: ${job.failedReason}`));
            } else {
                // Проверяем каждую секунду
                setTimeout(checkJob, 1000);
            }
        };
        
        checkJob();
    });
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Получен сигнал SIGTERM, завершаем работу...');
    await worker.close();
    await scheduler.close();
    await orToolsQueue.close();
    await redisConnection.quit();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Получен сигнал SIGINT, завершаем работу...');
    await worker.close();
    await scheduler.close();
    await orToolsQueue.close();
    await redisConnection.quit();
    process.exit(0);
});

export default {
    addOrToolsJob,
    getQueueStatus,
    clearQueue,
    getJobResult,
    waitForJobCompletion,
    queue: orToolsQueue,
    worker,
}; 