import crypto from 'crypto';
import Order from '../Models/Order.js';
import { SECRET_KEY } from '../utils/hillstar.js';

/**
 * Проверка подписи для callback от Hillstarpay
 */
function verifySignature(params, secretKey) {
    // Исключаем pg_sig из параметров для проверки
    const { pg_sig, ...paramsWithoutSig } = params;
    
    // Сортируем ключи по алфавиту
    const sortedKeys = Object.keys(paramsWithoutSig).sort();
    
    // Формируем массив значений: имя скрипта (result) + значения параметров + секретный ключ
    const signatureArray = ['result'];
    
    for (const key of sortedKeys) {
        signatureArray.push(paramsWithoutSig[key]);
    }
    
    signatureArray.push(secretKey);
    
    // Соединяем через ';' и берем MD5
    const signString = signatureArray.join(';');
    const calculatedSig = crypto.createHash('md5').update(signString).digest('hex');
    
    return calculatedSig === pg_sig;
}

/**
 * Обработка callback от Hillstarpay (result_url)
 * POST /api/payment/callback
 * Может принимать form-data, x-www-form-urlencoded или JSON
 */
export const handlePaymentCallback = async (req, res) => {
    try {
        // Получаем данные из запроса
        const callbackData = req.body;
        
        console.log('Callback received:', callbackData);
        
        // Проверяем формат запроса (новый JSON формат или старый form-data)
        let orderId, paymentId, result, amount, currency;
        
        if (callbackData.order && callbackData.status) {
            // Новый JSON формат
            orderId = callbackData.order.toString();
            paymentId = callbackData.id?.toString();
            result = callbackData.status?.code === 'success' ? 1 : 0;
            amount = callbackData.amount;
            currency = callbackData.currency;
            
            // Для нового формата проверяем подпись по-другому
            // sig формируется из всех полей кроме sig, отсортированных по алфавиту
            const { sig, ...dataWithoutSig } = callbackData;
            const sortedKeys = Object.keys(dataWithoutSig).sort();
            const signatureArray = sortedKeys.map(key => {
                if (typeof dataWithoutSig[key] === 'object') {
                    return JSON.stringify(dataWithoutSig[key]);
                }
                return dataWithoutSig[key];
            });
            signatureArray.push(SECRET_KEY);
            const calculatedSig = crypto.createHash('md5').update(signatureArray.join(';')).digest('hex');
            
            if (calculatedSig !== sig) {
                console.error('Неверная подпись в JSON callback');
                return res.status(400).json({ status: 'error' });
            }
            
            // Для нового формата проверяем заказ и возвращаем JSON
            const order = await Order.findById(orderId);
            if (!order) {
                console.error('Заказ не найден:', orderId);
                return res.status(400).json({ status: 'error' });
            }
            
            if (result === 1) {
                console.log('Платеж успешно обработан для заказа:', orderId);
                // Здесь можно обновить статус заказа
                return res.json({ status: 'ok' });
            } else {
                console.log('Платеж не прошел для заказа:', orderId);
                return res.json({ status: 'ok' });
            }
        } else {
            // Старый формат (form-data или URL-encoded)
            // Проверяем подпись для старого формата
            if (!verifySignature(callbackData, SECRET_KEY)) {
                console.error('Неверная подпись в callback', callbackData);
                return res.status(400).send(`<?xml version="1.0" encoding="utf-8"?>
<response>
    <pg_status>error</pg_status>
    <pg_description>Неверная подпись</pg_description>
    <pg_salt>${crypto.randomBytes(8).toString('hex')}</pg_salt>
    <pg_sig></pg_sig>
</response>`);
            }

            orderId = callbackData.pg_order_id;
            paymentId = callbackData.pg_payment_id;
            result = callbackData.pg_result; // 1 - успех, 0 - неудача
            amount = callbackData.pg_amount;
            currency = callbackData.pg_currency;
        }

        console.log('Payment callback received:', { orderId, paymentId, result, amount, currency });

        // Находим заказ
        const order = await Order.findById(orderId);
        
        if (!order) {
            console.error('Заказ не найден:', orderId);
            return res.status(400).send(`<?xml version="1.0" encoding="utf-8"?>
<response>
    <pg_status>error</pg_status>
    <pg_description>Заказ не найден</pg_description>
    <pg_salt>${crypto.randomBytes(8).toString('hex')}</pg_salt>
    <pg_sig></pg_sig>
</response>`);
        }

        // Если платеж успешен (pg_result = 1)
        if (result == 1) {
            // Здесь можно обновить статус заказа или выполнить другие действия
            // Например, обновить баланс клиента, создать транзакцию и т.д.
            
            // Опционально: обновить заказ, если нужно
            // await Order.findByIdAndUpdate(orderId, { 
            //     paymentStatus: 'paid',
            //     paymentId: paymentId
            // });

            console.log('Платеж успешно обработан для заказа:', orderId);

            // Генерируем ответ со статусом ok
            const salt = crypto.randomBytes(8).toString('hex');
            const responseParams = {
                pg_status: 'ok',
                pg_description: 'Платеж принят',
                pg_salt: salt
            };

            // Генерируем подпись для ответа
            const sortedKeys = Object.keys(responseParams).sort();
            const signatureArray = ['result', ...sortedKeys.map(key => responseParams[key]), SECRET_KEY];
            const signString = signatureArray.join(';');
            const responseSig = crypto.createHash('md5').update(signString).digest('hex');
            responseParams.pg_sig = responseSig;

            return res.send(`<?xml version="1.0" encoding="utf-8"?>
<response>
    <pg_status>${responseParams.pg_status}</pg_status>
    <pg_description>${responseParams.pg_description}</pg_description>
    <pg_salt>${responseParams.pg_salt}</pg_salt>
    <pg_sig>${responseParams.pg_sig}</pg_sig>
</response>`);
        } else {
            // Платеж не прошел
            console.log('Платеж не прошел для заказа:', orderId);
            
            // Генерируем ответ со статусом ok (все равно нужно подтвердить получение)
            const salt = crypto.randomBytes(8).toString('hex');
            const responseParams = {
                pg_status: 'ok',
                pg_description: 'Платеж отклонен',
                pg_salt: salt
            };

            const sortedKeys = Object.keys(responseParams).sort();
            const signatureArray = ['result', ...sortedKeys.map(key => responseParams[key]), SECRET_KEY];
            const signString = signatureArray.join(';');
            const responseSig = crypto.createHash('md5').update(signString).digest('hex');
            responseParams.pg_sig = responseSig;

            return res.send(`<?xml version="1.0" encoding="utf-8"?>
<response>
    <pg_status>${responseParams.pg_status}</pg_status>
    <pg_description>${responseParams.pg_description}</pg_description>
    <pg_salt>${responseParams.pg_salt}</pg_salt>
    <pg_sig>${responseParams.pg_sig}</pg_sig>
</response>`);
        }
    } catch (error) {
        console.error('Ошибка при обработке callback:', error);
        return res.status(500).send(`<?xml version="1.0" encoding="utf-8"?>
<response>
    <pg_status>error</pg_status>
    <pg_description>Внутренняя ошибка сервера</pg_description>
    <pg_salt>${crypto.randomBytes(8).toString('hex')}</pg_salt>
    <pg_sig></pg_sig>
</response>`);
    }
};

/**
 * Обработка успешного платежа (success_url)
 * GET /api/payment/success
 */
export const handlePaymentSuccess = async (req, res) => {
    try {
        const { pg_order_id, pg_payment_id } = req.query;
        
        // Перенаправляем на страницу успеха во frontend
        res.redirect(`/payment/success?orderId=${pg_order_id}&paymentId=${pg_payment_id || ''}`);
    } catch (error) {
        console.error('Ошибка при обработке success URL:', error);
        res.redirect('/payment/error?message=Ошибка обработки платежа');
    }
};

/**
 * Обработка неуспешного платежа (failure_url)
 * GET /api/payment/error
 */
export const handlePaymentError = async (req, res) => {
    try {
        const { pg_order_id, pg_error_code, pg_error_description } = req.query;
        
        // Перенаправляем на страницу ошибки во frontend
        const errorMessage = pg_error_description || 'Ошибка при обработке платежа';
        res.redirect(`/payment/error?orderId=${pg_order_id || ''}&message=${encodeURIComponent(errorMessage)}`);
    } catch (error) {
        console.error('Ошибка при обработке error URL:', error);
        res.redirect('/payment/error?message=Ошибка обработки платежа');
    }
};

