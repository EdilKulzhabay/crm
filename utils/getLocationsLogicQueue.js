import getLocationsLogic from "./getLocationsLogic.js";

const queue = [];
let isProcessing = false;

async function processQueue() {
    if (isProcessing || queue.length === 0) return; // Если уже идет обработка или очередь пуста — выходим

    isProcessing = true;
    
    while (queue.length > 0) {
        const { orderId, resolve, reject } = queue.shift(); // Берем первую задачу из очереди

        try {
            const result = await getLocationsLogic(orderId);
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }

    isProcessing = false;
}

// Функция для добавления задач в очередь
export default function getLocationsLogicQueue(orderId) {
    return new Promise((resolve, reject) => {
        queue.push({ orderId, resolve, reject });
        processQueue(); // Запускаем обработку, если она не идет
    });
}