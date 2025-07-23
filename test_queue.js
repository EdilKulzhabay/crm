import queueOrTools, { getQueueStatus, clearQueue } from './orToolsQueue.js';

async function testQueue() {
    console.log("🧪 Тестирование очереди orTools...\n");
    
    // Очищаем очередь перед тестом
    clearQueue();
    
    // Проверяем начальный статус
    console.log("📊 Начальный статус очереди:", getQueueStatus());
    
    // Добавляем несколько запросов одновременно
    console.log("\n🚀 Добавляем 3 запроса одновременно...");
    
    const promises = [
        queueOrTools('test_1'),
        queueOrTools('test_2'),
        queueOrTools('test_3')
    ];
    
    // Проверяем статус после добавления
    setTimeout(() => {
        console.log("📊 Статус после добавления запросов:", getQueueStatus());
    }, 100);
    
    try {
        // Ждем выполнения всех запросов
        const results = await Promise.all(promises);
        console.log("\n✅ Все запросы выполнены успешно!");
        console.log("📊 Финальный статус очереди:", getQueueStatus());
    } catch (error) {
        console.error("❌ Ошибка при выполнении запросов:", error);
    }
}

// Запускаем тест
testQueue().catch(console.error); 