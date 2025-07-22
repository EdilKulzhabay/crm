import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Конфигурация Redis
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true, // Не подключаемся сразу
    retryDelayOnClusterDown: 300,
    enableReadyCheck: false,
    maxLoadingTimeout: 10000,
};

// Создаем подключение к Redis
const redisConnection = new Redis(redisConfig);

// Обработчики событий Redis
redisConnection.on('connect', () => {
    console.log('🔗 Подключение к Redis установлено');
});

redisConnection.on('ready', () => {
    console.log('✅ Redis готов к работе');
});

redisConnection.on('error', (error) => {
    console.error('❌ Ошибка Redis:', error);
});

redisConnection.on('close', () => {
    console.log('🔌 Соединение с Redis закрыто');
});

redisConnection.on('reconnecting', () => {
    console.log('🔄 Переподключение к Redis...');
});

// Функция для проверки подключения
export const testRedisConnection = async () => {
    try {
        await redisConnection.ping();
        console.log('✅ Redis подключение работает');
        return true;
    } catch (error) {
        console.error('❌ Ошибка подключения к Redis:', error);
        return false;
    }
};

// Функция для закрытия подключения
export const closeRedisConnection = async () => {
    try {
        await redisConnection.quit();
        console.log('🔌 Соединение с Redis закрыто');
    } catch (error) {
        console.error('❌ Ошибка при закрытии Redis:', error);
    }
};

export default redisConnection; 