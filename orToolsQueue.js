import orTools from './orTools.js';

class OrToolsQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.currentExecution = null;
    }

    async add(requestId = null) {
        return new Promise((resolve, reject) => {
            const request = {
                id: requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                resolve,
                reject,
                timestamp: new Date()
            };

            this.queue.push(request);
            console.log(`📋 Запрос ${request.id} добавлен в очередь. Позиция: ${this.queue.length}`);
            
            this.processNext();
        });
    }

    async processNext() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const request = this.queue.shift();
        this.currentExecution = request;

        console.log(`🚀 Начинаем выполнение запроса ${request.id}. Осталось в очереди: ${this.queue.length}`);

        try {
            const result = await orTools();
            console.log(`✅ Запрос ${request.id} выполнен успешно`);
            request.resolve(result);
        } catch (error) {
            console.error(`❌ Ошибка при выполнении запроса ${request.id}:`, error);
            request.reject(error);
        } finally {
            this.isProcessing = false;
            this.currentExecution = null;
            
            // Обрабатываем следующий запрос в очереди
            if (this.queue.length > 0) {
                console.log(`⏭️  Переходим к следующему запросу. В очереди: ${this.queue.length}`);
                setTimeout(() => this.processNext(), 1000); // Небольшая задержка между запросами
            } else {
                console.log(`🏁 Очередь пуста. Все запросы обработаны.`);
            }
        }
    }

    getStatus() {
        return {
            isProcessing: this.isProcessing,
            queueLength: this.queue.length,
            currentExecution: this.currentExecution ? {
                id: this.currentExecution.id,
                timestamp: this.currentExecution.timestamp
            } : null,
            queueItems: this.queue.map(req => ({
                id: req.id,
                timestamp: req.timestamp
            }))
        };
    }

    // Очистить очередь (в случае экстренной необходимости)
    clear() {
        console.log(`🧹 Очищаем очередь. Отменяем ${this.queue.length} запросов`);
        
        this.queue.forEach(request => {
            request.reject(new Error('Запрос отменен: очередь очищена'));
        });
        
        this.queue = [];
    }
}

// Создаем единственный экземпляр очереди
const orToolsQueue = new OrToolsQueue();

// Экспортируем функцию для добавления в очередь
export const queueOrTools = async (requestId = null) => {
    return await orToolsQueue.add(requestId);
};

// Экспортируем функцию для получения статуса очереди
export const getQueueStatus = () => {
    return orToolsQueue.getStatus();
};

// Экспортируем функцию для очистки очереди
export const clearQueue = () => {
    orToolsQueue.clear();
};

export default queueOrTools; 