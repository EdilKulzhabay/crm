# BullMQ для orTools

Этот документ описывает, как использовать BullMQ для выполнения orTools в отдельном процессе.

## Установка и настройка

### 1. Установка зависимостей
```bash
npm install bullmq ioredis
```

### 2. Настройка Redis
Добавьте следующие переменные в ваш `.env` файл:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### 3. Установка Redis (если не установлен)
#### macOS:
```bash
brew install redis
brew services start redis
```

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

## Запуск

### 1. Запуск основного сервера
```bash
npm run server
```

### 2. Запуск воркера (в отдельном терминале)
```bash
npm run worker
```

### 3. Запуск всего вместе (сервер + клиент + воркер)
```bash
npm run dev-full
```

## API Эндпоинты

### Добавить задачу в очередь
```http
POST /api/bullmq/add-job
Content-Type: application/json

{
    "requestId": "optional_custom_id",
    "options": {
        "delay": 5000,
        "priority": 1
    }
}
```

### Получить статус очереди
```http
GET /api/bullmq/status
```

### Получить результат конкретной задачи
```http
GET /api/bullmq/job/{jobId}
```

### Ожидать завершения задачи
```http
GET /api/bullmq/wait/{jobId}?timeout=300000
```

### Выполнить задачу синхронно (дождаться результата)
```http
POST /api/bullmq/execute
Content-Type: application/json

{
    "requestId": "optional_custom_id",
    "timeout": 300000
}
```

### Очистить очередь
```http
DELETE /api/bullmq/clear
```

## Тестирование

### Запуск теста
```bash
npm run test-bullmq
```

Этот тест:
1. Проверяет подключение к Redis
2. Добавляет тестовую задачу в очередь
3. Ожидает завершения задачи
4. Выводит результаты

## Мониторинг

### Статус очереди
```javascript
import { getQueueStatus } from './bullmqOrTools.js';

const status = await getQueueStatus();
console.log(status);
// {
//   waiting: 2,
//   active: 1,
//   completed: 10,
//   failed: 0,
//   total: 13,
//   activeJobs: [...],
//   waitingJobs: [...]
// }
```

### Результат конкретной задачи
```javascript
import { getJobResult } from './bullmqOrTools.js';

const result = await getJobResult('job_id');
console.log(result);
// {
//   id: 'job_id',
//   state: 'completed',
//   result: { ... },
//   timestamp: '2024-01-01T00:00:00.000Z',
//   requestId: 'custom_id'
// }
```

## Преимущества BullMQ

1. **Отдельный процесс**: orTools выполняется в отдельном процессе, не блокируя основной сервер
2. **Надежность**: Автоматические повторы при ошибках
3. **Мониторинг**: Детальная информация о статусе задач
4. **Масштабируемость**: Можно запускать несколько воркеров
5. **Персистентность**: Задачи сохраняются в Redis и не теряются при перезапуске

## Миграция с существующей очереди

### Старый способ:
```javascript
import queueOrTools from './orToolsQueue.js';
await queueOrTools('request_id');
```

### Новый способ:
```javascript
import { addOrToolsJob } from './bullmqOrTools.js';

// Асинхронно
const job = await addOrToolsJob('request_id');

// Синхронно (дождаться результата)
import { waitForJobCompletion } from './bullmqOrTools.js';
const result = await waitForJobCompletion(job.id);
```

## Устранение неполадок

### Redis не подключен
```bash
# Проверьте, что Redis запущен
redis-cli ping
# Должен ответить: PONG
```

### Воркер не обрабатывает задачи
1. Убедитесь, что воркер запущен: `npm run worker`
2. Проверьте логи воркера на наличие ошибок
3. Убедитесь, что Redis доступен

### Задачи зависают
1. Проверьте логи orTools на наличие ошибок
2. Увеличьте timeout в настройках
3. Проверьте доступность Python и зависимостей

## Производительность

- **Concurrency**: По умолчанию 1 задача одновременно
- **Retry**: 3 попытки с экспоненциальной задержкой
- **Timeout**: 5 минут на задачу по умолчанию
- **Memory**: Задачи автоматически удаляются после завершения 