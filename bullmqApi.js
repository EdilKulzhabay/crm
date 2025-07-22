import express from 'express';
import { addOrToolsJob, getQueueStatus, clearQueue, getJobResult, waitForJobCompletion } from './bullmqOrTools.js';

const router = express.Router();

// Добавить задачу в очередь
router.post('/add-job', async (req, res) => {
    try {
        const { requestId, options = {} } = req.body;
        const job = await addOrToolsJob(requestId, options);
        
        res.json({
            success: true,
            jobId: job.id,
            message: 'Задача добавлена в очередь',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Ошибка при добавлении задачи:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Получить статус очереди
router.get('/status', async (req, res) => {
    try {
        const status = await getQueueStatus();
        res.json({
            success: true,
            status,
        });
    } catch (error) {
        console.error('Ошибка при получении статуса:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Получить результат конкретной задачи
router.get('/job/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const result = await getJobResult(jobId);
        
        res.json({
            success: true,
            result,
        });
    } catch (error) {
        console.error('Ошибка при получении результата задачи:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Ожидать завершения задачи
router.get('/wait/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { timeout } = req.query;
        
        const result = await waitForJobCompletion(jobId, timeout ? parseInt(timeout) : 300000);
        
        res.json({
            success: true,
            result,
        });
    } catch (error) {
        console.error('Ошибка при ожидании завершения задачи:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Очистить очередь
router.delete('/clear', async (req, res) => {
    try {
        await clearQueue();
        res.json({
            success: true,
            message: 'Очередь очищена',
        });
    } catch (error) {
        console.error('Ошибка при очистке очереди:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Добавить задачу и дождаться результата (синхронный вызов)
router.post('/execute', async (req, res) => {
    try {
        const { requestId, timeout = 300000 } = req.body;
        
        // Добавляем задачу в очередь
        const job = await addOrToolsJob(requestId);
        
        // Ждем завершения
        const result = await waitForJobCompletion(job.id, timeout);
        
        res.json({
            success: true,
            result,
        });
    } catch (error) {
        console.error('Ошибка при выполнении задачи:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router; 