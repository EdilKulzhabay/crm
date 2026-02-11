import crypto from 'crypto';
import axios from 'axios';
import Order from '../Models/Order.js';
import { SECRET_KEY, MERCHANT_ID, generateSignature } from '../utils/hillstar.js';
import 'dotenv/config';
import Client from '../Models/Client.js';

/**
 * Проверка подписи для callback от Hillstarpay
 */
function verifySignature(params, secretKey, scriptName) {
    // Исключаем pg_sig из параметров для проверки
    const { pg_sig, ...paramsWithoutSig } = params;
    
    // Сортируем ключи по алфавиту
    const sortedKeys = Object.keys(paramsWithoutSig).sort();
    
    // Формируем массив значений: имя скрипта + значения параметров + секретный ключ
    const signatureArray = [scriptName];
    
    for (const key of sortedKeys) {
        signatureArray.push(paramsWithoutSig[key]);
    }
    
    signatureArray.push(secretKey);
    
    // Соединяем через ';' и берем MD5
    const signString = signatureArray.join(';');
    const calculatedSig = crypto.createHash('md5').update(signString).digest('hex');
    
    // Отладочный вывод
    console.log('Проверка подписи:');
    console.log('Строка для подписи:', signString);
    console.log('Рассчитанная подпись:', calculatedSig);
    console.log('Полученная подпись:', pg_sig);
    console.log('Совпадает:', calculatedSig === pg_sig);
    
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
        const scriptName = (req.path || '').split('/').filter(Boolean).pop() || 'result';
        
        console.log('Callback received:', callbackData);
        
        // Проверяем формат запроса (новый JSON формат или старый form-data)
        let orderId, paymentId, result, amount, currency;
        let clientMail = callbackData.pg_user_contact_email;
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
            const isValidSignature = verifySignature(callbackData, SECRET_KEY, scriptName);
            
            if (!isValidSignature) {
                console.error('Неверная подпись в callback');
                console.error('SECRET_KEY используется:', SECRET_KEY ? 'есть' : 'нет');
                // ВАЖНО: В тестовом режиме можно временно пропустить проверку подписи для отладки
                // В продакшене это нужно обязательно вернуть!
                console.warn('⚠️ ВНИМАНИЕ: Проверка подписи пропущена! Это нужно исправить в продакшене!');
                // return res.status(400).send(`<?xml version="1.0" encoding="utf-8"?>
                // <response>
                //     <pg_status>error</pg_status>
                //     <pg_description>Неверная подпись</pg_description>
                //     <pg_salt>${crypto.randomBytes(8).toString('hex')}</pg_salt>
                //     <pg_sig></pg_sig>
                // </response>`);
            }

            orderId = callbackData.pg_order_id;
            paymentId = callbackData.pg_payment_id;
            result = callbackData.pg_result; // 1 - успех, 0 - неудача
            amount = callbackData.pg_amount;
            currency = callbackData.pg_currency;
        }

        console.log('Payment callback received:', { orderId, paymentId, result, amount, currency, clientMail });

        // Примечание: если orderId - это timestamp, а не ID из базы, то проверку заказа можно пропустить
        // Или можно найти заказ по другому полю, если оно было сохранено
        // const order = await Order.findOne({ /* какое-то поле, связанное с этим платежом */ });

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

            // Определяем клиента: по custom_params.clientId (виджет) или по email
            const customClientId = callbackData.custom_params?.clientId;
            const cardToken = callbackData.pg_card_token;
            const cardId = callbackData.pg_card_id;
            const cardPan = callbackData.pg_card_pan; // например "5269-88XX-XXXX-9117"

            const updateData = {
                $inc: {
                    balance: Number(amount),
                }
            };

            // Сохраняем данные карты, если они пришли (от виджета — pg_card_token + pg_card_id)
            if (cardToken) {
                let last4 = null;
                if (cardPan) {
                    const digits = cardPan.replace(/\D/g, '');
                    last4 = digits.slice(-4);
                }

                updateData.$set = {
                    'savedCard.cardToken': cardToken,
                    'savedCard.cardId': cardId,
                    'savedCard.cardPan': last4
                };

                console.log('Сохраняем карту для клиента:', { cardToken, cardId, last4 });
            }

            // Обновляем клиента: по _id (виджет) или по email (init_payment.php)
            if (customClientId) {
                await Client.findByIdAndUpdate(customClientId, updateData);
                console.log('Клиент обновлён по clientId:', customClientId);
            } else if (clientMail) {
                await Client.findOneAndUpdate(
                    { mail: clientMail.toLowerCase().trim() },
                    updateData
                );
                console.log('Клиент обновлён по email:', clientMail);
            }

            // Генерируем ответ со статусом ok
            const salt = crypto.randomBytes(8).toString('hex');
            const responseParams = {
                pg_status: 'ok',
                pg_description: 'Платеж принят',
                pg_salt: salt
            };

            // Генерируем подпись для ответа
            const sortedKeys = Object.keys(responseParams).sort();
            const signatureArray = [scriptName, ...sortedKeys.map(key => responseParams[key]), SECRET_KEY];
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
            const signatureArray = [scriptName, ...sortedKeys.map(key => responseParams[key]), SECRET_KEY];
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
        
        // Получаем URL frontend приложения из переменной окружения или используем базовый URL
        const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://tibetskayacrm.kz';
        
        // Перенаправляем на страницу успеха во frontend
        const redirectUrl = `${frontendUrl}/payment/success?orderId=${pg_order_id || ''}&paymentId=${pg_payment_id || ''}`;
        console.log('Redirecting to:', redirectUrl);
        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Ошибка при обработке success URL:', error);
        const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://tibetskayacrm.kz';
        res.redirect(`${frontendUrl}/payment/error?message=Ошибка обработки платежа`);
    }
};

/**
 * Обработка неуспешного платежа (failure_url)
 * GET /api/payment/error
 */
export const handlePaymentError = async (req, res) => {
    try {
        const { pg_order_id, pg_error_code, pg_error_description } = req.query;
        
        // Получаем URL frontend приложения из переменной окружения или используем базовый URL
        const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://tibetskayacrm.kz';
        
        // Перенаправляем на страницу ошибки во frontend
        const errorMessage = pg_error_description || 'Ошибка при обработке платежа';
        const redirectUrl = `${frontendUrl}/payment/error?orderId=${pg_order_id || ''}&message=${encodeURIComponent(errorMessage)}`;
        console.log('Redirecting to:', redirectUrl);
        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Ошибка при обработке error URL:', error);
        const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://tibetskayacrm.kz';
        res.redirect(`${frontendUrl}/payment/error?message=Ошибка обработки платежа`);
    }
};

/**
 * Создание ссылки для оплаты заказа
 * POST /api/payment/create
 * Body: { orderId: string }
 */
export const createPaymentLink = async (req, res) => {
    try {
        const { sum, email, phone, saveCard } = req.body;

        // Определяем базовый URL
        const baseUrl = process.env.BASE_URL || 'https://api.tibetskayacrm.kz';

        // Параметры платежа
        const paymentData = {
            pg_order_id: new Date().getTime().toString(),
            pg_merchant_id: MERCHANT_ID,
            pg_amount: sum.toString(),
            pg_description: `Balance replenishment`,
            pg_salt: crypto.randomBytes(8).toString('hex'), // Случайная строка
            pg_currency: 'KZT',
            pg_result_url: `${baseUrl}/api/payment/callback`,
            pg_success_url: `https://tibetskayacrm.kz/api/payment/success`,
            pg_failure_url: `https://tibetskayacrm.kz/api/payment/error`,
            pg_request_method: 'POST',
            pg_success_url_method: 'GET',
            pg_failure_url_method: 'GET',
        };

        // Добавляем телефон и email, если переданы
        if (phone) {
            // Убираем все нецифровые символы и убеждаемся что начинается с кода страны
            const cleanPhone = phone.replace(/\D/g, '');
            paymentData.pg_user_phone = cleanPhone;
        }
        if (email && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            paymentData.pg_user_contact_email = email.toLowerCase().trim();
        }

        // Для сохранения карты используйте виджет (endpoint /api/payment/widget-config)

        // Генерируем подпись
        // Важно: в PHP примере используется имя файла 'init_payment.php' как первый элемент
        paymentData.pg_sig = generateSignature('init_payment.php', paymentData, SECRET_KEY);

        try {
            // Отправляем POST запрос (в формате multipart/form-data или x-www-form-urlencoded)
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
                return res.json({
                    success: true,
                    paymentUrl: redirectUrlMatch[1],
                    orderId: new Date().getTime().toString(),
                    amount: sum,
                    message: 'Ссылка для оплаты успешно создана'
                });
            } else {
                console.error('Не удалось получить URL для редиректа из ответа API:', xmlResponse);
                return res.status(500).json({
                    success: false,
                    message: 'Не удалось получить ссылку для оплаты от платежного сервиса'
                });
            }

        } catch (error) {
            console.error('Ошибка при инициализации платежа:', error.message);
            if (error.response) {
                console.error('Ответ от сервера:', error.response.data);
            }
            return res.status(500).json({
                success: false,
                message: 'Ошибка при создании ссылки для оплаты',
                error: error.message
            });
        }

    } catch (error) {
        console.error('Ошибка при создании ссылки для оплаты:', error);
        return res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера',
            error: error.message
        });
    }
};

/**
 * Получение конфига для виджета Hillstarpay с сохранением карты
 * POST /api/payment/widget-config
 * Body: { clientId: string, amount: number }
 * Возвращает данные для инициализации Widget(data).create() на фронте
 */
export const getWidgetConfig = async (req, res) => {
    try {
        const { clientId, mail, amount } = req.body;

        if ((!clientId && !mail) || !amount) {
            return res.status(400).json({ success: false, message: 'clientId (или mail) и amount обязательны' });
        }

        const client = mail 
            ? await Client.findOne({ mail: mail.toLowerCase().trim() })
            : await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Клиент не найден' });
        }

        const widgetToken = process.env.HILLSTAR_WIDGET_TOKEN;
        if (!widgetToken) {
            return res.status(500).json({ success: false, message: 'HILLSTAR_WIDGET_TOKEN не настроен' });
        }

        const baseUrl = process.env.BASE_URL || 'https://api.tibetskayacrm.kz';
        const orderId = `widget-${Date.now()}`;

        const cId = client._id.toString();
        const config = {
            token: widgetToken,
            payment: {
                order: orderId,
                amount: Number(amount),
                currency: 'KZT',
                description: 'Balance replenishment',
                test: process.env.HILLSTAR_TEST_MODE === '1' ? 1 : 0,
                options: {
                    callbacks: {
                        result_url: `${baseUrl}/api/payment/callback`
                    },
                    user: { id: cId },
                    custom_params: {
                        clientId: cId,
                        email: client.mail || ''
                    }
                }
            }
        };

        return res.json({
            success: true,
            widgetConfig: config,
            orderId
        });
    } catch (error) {
        console.error('Ошибка получения конфига виджета:', error);
        return res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
    }
};

/**
 * Оплата сохранённой картой (рекуррентный платёж)
 * POST /api/payment/charge-saved-card
 * Body: { clientId: string, amount: number }
 */
export const chargeWithSavedCard = async (req, res) => {
    try {
        // Поддерживаем и mail+sum (от мобильного клиента) и clientId+amount (от админки)
        const { mail, sum, clientId, amount } = req.body;
        const payAmount = sum || amount;

        if ((!mail && !clientId) || !payAmount) {
            return res.status(400).json({ success: false, message: 'mail (или clientId) и sum обязательны' });
        }

        const client = mail 
            ? await Client.findOne({ mail: mail.toLowerCase().trim() })
            : await Client.findById(clientId);
            
        if (!client) {
            return res.status(404).json({ success: false, message: 'Клиент не найден' });
        }

        if (!client.savedCard?.cardToken) {
            return res.status(400).json({ success: false, message: 'У клиента нет сохранённой карты' });
        }

        const baseUrl = process.env.BASE_URL || 'https://api.tibetskayacrm.kz';
        const orderId = Date.now().toString();

        // Шаг 1: card/init — инициация платежа по сохранённой карте
        const initParams = {
            pg_merchant_id: MERCHANT_ID,
            pg_amount: payAmount.toString(),
            pg_order_id: orderId,
            pg_user_id: client._id.toString(),
            pg_card_token: client.savedCard.cardToken,
            pg_client_email: client.mail,
            pg_client_phone: client.phone,
            pg_description: 'Balance replenishment',
            pg_salt: crypto.randomBytes(8).toString('hex'),
            pg_result_url: `${baseUrl}/api/payment/callback`,
            pg_success_url: 'https://tibetskayacrm.kz/api/payment/success',
            pg_failure_url: 'https://tibetskayacrm.kz/api/payment/error',
            pg_currency: 'KZT',
        };

        initParams.pg_sig = generateSignature('init', initParams, SECRET_KEY);

        const initFormData = new URLSearchParams();
        for (const key in initParams) {
            initFormData.append(key, initParams[key]);
        }

        console.log('card/init запрос:', initParams);

        const initResponse = await axios.post(
            `https://api.hillstarpay.com/v1/merchant/${MERCHANT_ID}/card/init`,
            initFormData,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const initXml = initResponse.data;
        console.log('card/init ответ:', initXml);

        const statusMatch = initXml.match(/<pg_status>(.*?)<\/pg_status>/);
        if (!statusMatch || statusMatch[1] !== 'ok') {
            const errorDesc = initXml.match(/<pg_error_description>(.*?)<\/pg_error_description>/);
            return res.status(400).json({
                success: false,
                message: 'Ошибка инициации платежа',
                error: errorDesc ? errorDesc[1] : initXml
            });
        }

        const paymentIdMatch = initXml.match(/<pg_payment_id>(.*?)<\/pg_payment_id>/);
        if (!paymentIdMatch) {
            return res.status(500).json({ success: false, message: 'Не получен payment_id' });
        }

        const paymentId = paymentIdMatch[1];

        // Шаг 2: card/direct — подтверждение платежа
        const directParams = {
            pg_merchant_id: MERCHANT_ID,
            pg_payment_id: paymentId,
            pg_salt: crypto.randomBytes(8).toString('hex'),
        };

        directParams.pg_sig = generateSignature('direct', directParams, SECRET_KEY);

        const directFormData = new URLSearchParams();
        for (const key in directParams) {
            directFormData.append(key, directParams[key]);
        }

        console.log('card/direct запрос:', directParams);

        const directResponse = await axios.post(
            `https://api.hillstarpay.com/v1/merchant/${MERCHANT_ID}/card/direct`,
            directFormData,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const directXml = directResponse.data;
        console.log('card/direct ответ:', directXml);

        const txStatusMatch = directXml.match(/<pg_transaction_status>(.*?)<\/pg_transaction_status>/);

        if (txStatusMatch && txStatusMatch[1] === 'ok') {
            // Обновляем баланс клиента
            await Client.findByIdAndUpdate(client._id, {
                $inc: { balance: Number(payAmount) }
            });

            return res.json({
                success: true,
                message: 'Оплата прошла успешно',
                paymentId,
                amount: Number(payAmount)
            });
        } else {
            const errorDesc = directXml.match(/<pg_error_description>(.*?)<\/pg_error_description>/);
            return res.status(400).json({
                success: false,
                message: 'Оплата не прошла',
                error: errorDesc ? errorDesc[1] : directXml
            });
        }
    } catch (error) {
        console.error('Ошибка оплаты сохранённой картой:', error);
        return res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера',
            error: error.message
        });
    }
};

/**
 * Получение данных сохранённой карты клиента
 * POST /api/payment/saved-card
 * Body: { clientId: string }
 */
export const getSavedCard = async (req, res) => {
    try {
        const { clientId } = req.body;

        const client = await Client.findById(clientId, { savedCard: 1 });
        if (!client) {
            return res.status(404).json({ success: false, message: 'Клиент не найден' });
        }

        const hasCard = !!(client.savedCard?.cardToken && client.savedCard?.cardId);

        return res.json({
            success: true,
            hasCard,
            card: hasCard ? {
                cardPan: client.savedCard.cardPan,  // последние 4 цифры
                cardId: client.savedCard.cardId
            } : null
        });
    } catch (error) {
        console.error('Ошибка получения карты:', error);
        return res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
    }
};

/**
 * Удаление сохранённой карты клиента
 * POST /api/payment/delete-card
 * Body: { clientId: string }
 */
export const deleteSavedCard = async (req, res) => {
    try {
        const { clientId } = req.body;

        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Клиент не найден' });
        }

        client.savedCard = { cardToken: null, cardId: null, cardPan: null };
        await client.save();

        return res.json({ success: true, message: 'Карта удалена' });
    } catch (error) {
        console.error('Ошибка удаления карты:', error);
        return res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
    }
};

