import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// 1. Ваши учетные данные (выдаются Hillstarpay)
const MERCHANT_ID = process.env.HILLSTAR_MERCHANT_ID;
const SECRET_KEY = process.env.HILLSTAR_SECRET_KEY;

/**
 * Функция для генерации подписи (аналог логики из PHP примера)
 */
function generateSignature(scriptName, params, secretKey) {
    // 1. Сортируем ключи по алфавиту
    const sortedKeys = Object.keys(params).sort();
    
    // 2. Формируем массив значений: имя скрипта + значения параметров + секретный ключ
    const signatureArray = [scriptName];
    
    for (const key of sortedKeys) {
        signatureArray.push(params[key]);
    }
    
    signatureArray.push(secretKey);
    
    // 3. Соединяем через ';' и берем MD5
    const signString = signatureArray.join(';');
    return crypto.createHash('md5').update(signString).digest('hex');
}

/**
 * Инициализация платежа через Hillstarpay
 * @param {Object} params - Параметры платежа
 * @param {string} params.orderId - ID заказа
 * @param {number} params.amount - Сумма платежа
 * @param {string} params.description - Описание платежа
 * @param {string} params.baseUrl - Базовый URL сервера (например, https://yoursite.com)
 * @param {string} params.currency - Валюта (по умолчанию 'KZT')
 * @param {boolean} params.testingMode - Тестовый режим (по умолчанию true)
 * @returns {Promise<string>} URL для редиректа пользователя на страницу оплаты
 */
export async function initPayment({
    orderId,
    amount,
    description,
    baseUrl,
    currency = 'KZT',
    testingMode = true
}) {
    if (!orderId || !amount || !description || !baseUrl) {
        throw new Error('Необходимы параметры: orderId, amount, description, baseUrl');
    }

    // Формируем URL для callback, success и error
    const resultUrl = `${baseUrl}/api/payment/callback`;
    const successUrl = `${baseUrl}/api/payment/success`;
    const failureUrl = `${baseUrl}/api/payment/error`;

    // Параметры платежа
    const paymentData = {
        pg_order_id: orderId.toString(),
        pg_merchant_id: MERCHANT_ID,
        pg_amount: amount.toString(),
        pg_description: description,
        pg_salt: crypto.randomBytes(8).toString('hex'), // Случайная строка
        pg_currency: currency,
        pg_result_url: resultUrl,
        pg_success_url: successUrl,
        pg_failure_url: failureUrl,
        pg_request_method: 'POST',
        pg_success_url_method: 'GET',
        pg_failure_url_method: 'GET',
    };

    if (testingMode) {
        paymentData.pg_testing_mode = '1';
    }

    // Генерируем подпись
    // Важно: в PHP примере используется имя файла 'init_payment.php' как первый элемент
    paymentData.pg_sig = generateSignature('init_payment.php', paymentData, SECRET_KEY);

    try {
        // Отправляем POST запрос (в формате x-www-form-urlencoded)
        const formData = new URLSearchParams();
        for (const key in paymentData) {
            formData.append(key, paymentData[key]);
        }

        const response = await axios.post('https://api.hillstarpay.com/init_payment.php', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // API возвращает XML, нужно извлечь pg_redirect_url
        const xmlResponse = response.data;
        const redirectUrlMatch = xmlResponse.match(/<pg_redirect_url>(.*?)<\/pg_redirect_url>/);
        
        if (redirectUrlMatch && redirectUrlMatch[1]) {
            return redirectUrlMatch[1];
        } else {
            throw new Error('Не удалось получить URL для редиректа из ответа API');
        }
    } catch (error) {
        console.error('Ошибка при инициализации платежа:', error.message);
        if (error.response) {
            console.error('Ответ от сервера:', error.response.data);
        }
        throw error;
    }
}

// Экспортируем также функцию генерации подписи для использования в контроллере
export { generateSignature, MERCHANT_ID, SECRET_KEY };
