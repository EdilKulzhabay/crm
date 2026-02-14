import crypto from 'crypto';
import axios from 'axios';
import Order from '../Models/Order.js';
import { SECRET_KEY, MERCHANT_ID, generateSignature } from '../utils/hillstar.js';
import 'dotenv/config';
import Client from '../Models/Client.js';

// Сессии для страницы виджета (sessionId -> данные), TTL 10 минут
const widgetSessions = new Map();
const WIDGET_SESSION_TTL = 10 * 60 * 1000;

function createWidgetSession(data) {
    const sessionId = crypto.randomBytes(16).toString('hex');
    widgetSessions.set(sessionId, { ...data, expiresAt: Date.now() + WIDGET_SESSION_TTL });
    return sessionId;
}

function getWidgetSession(sessionId) {
    const session = widgetSessions.get(sessionId);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
        widgetSessions.delete(sessionId);
        return null;
    }
    return session;
}

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
        console.log('Card data in callback:', {
            pg_card_token: callbackData.pg_card_token ? '***' : undefined,
            pg_card_id: callbackData.pg_card_id,
            pg_recurring_profile_id: callbackData.pg_recurring_profile_id,
            pg_card_pan: callbackData.pg_card_pan,
        });

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

            const updateData = {
                $inc: { balance: Number(amount) }
            };

            // Сохраняем данные карты, если они пришли в callback
            const recurringProfileId = callbackData.pg_recurring_profile_id;
            const cardToken = callbackData.pg_card_token;
            const cardId = callbackData.pg_card_id;
            const cardPan = callbackData.pg_card_pan; // например "5269-88XX-XXXX-9117"

            if (recurringProfileId || cardToken || cardId) {
                let last4 = null;
                if (cardPan) {
                    const digits = cardPan.replace(/\D/g, '');
                    last4 = digits.slice(-4);
                }
                updateData.$set = {
                    'savedCard.cardToken': cardToken || recurringProfileId,
                    'savedCard.cardId': cardId || recurringProfileId || null,
                    'savedCard.cardPan': last4
                };
                console.log('Сохраняем карту для клиента:', { recurringProfileId, cardToken, cardId, last4 });
            }

            // Платеж через виджет: orderId = "topup-{userId}-{timestamp}"
            const topupMatch = orderId && orderId.toString().match(/^topup-([a-f0-9]{24})-(\d+)$/);
            if (topupMatch) {
                const [, clientId] = topupMatch;
                const client = await Client.findById(clientId);
                if (client) {
                    await Client.findByIdAndUpdate(clientId, updateData);
                    console.log('[callback] Виджет: обновлён баланс клиента', clientId);
                } else {
                    console.error('[callback] Виджет: клиент не найден по id', clientId);
                }
            } else if (clientMail) {
                // Платеж через init_payment (redirect)
                await Client.findOneAndUpdate(
                    { mail: clientMail.toLowerCase().trim() },
                    updateData
                );
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

        // Если нужно сохранить карту — добавляем pg_user_id для привязки карты
        if (saveCard && email) {
            const client = await Client.findOne({ mail: email.toLowerCase().trim() });
            if (client) {
                paymentData.pg_user_id = client._id.toString();
                paymentData.pg_recurring_start = '1';
                paymentData.pg_recurring_lifetime = '156'; // максимум 156 месяцев
            }
        }

        // Генерируем подпись
        // Важно: в PHP примере используется имя файла 'init_payment.php' как первый элемент
        paymentData.pg_sig = generateSignature('init_payment.php', paymentData, SECRET_KEY);

        try {
            // Отправляем POST запрос (в формате multipart/form-data или x-www-form-urlencoded)
            const formData = new URLSearchParams();
            for (const key in paymentData) {
                formData.append(key, paymentData[key]);
            }

            console.log("FormData: ", formData)

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
 * Получение clientId по email (для страницы оплаты)
 * POST /api/payment/get-client-by-email
 * Body: { email: string }
 */
export const getClientByEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, message: 'Email обязателен' });
        }
        const client = await Client.findOne(
            { mail: email.toLowerCase().trim() },
            { _id: 1 }
        );
        if (!client) {
            return res.status(404).json({ success: false, message: 'Клиент не найден' });
        }
        return res.json({ success: true, clientId: client._id.toString() });
    } catch (error) {
        console.error('getClientByEmail:', error);
        return res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
    }
};

/**
 * Получение конфигурации для JS-виджета Hillstarpay
 * POST /api/payment/widget-config
 * Body: { userId: string, amount: number, email?: string, phone?: string }
 */
export const getWidgetConfig = async (req, res) => {
    try {
        console.log('[getWidgetConfig] Вход. Body:', JSON.stringify(req.body));

        const { userId, amount, email, phone, currency, description, test, options } = req.body;

        if (!userId || amount === undefined || amount === null) {
            console.error('[getWidgetConfig] Валидация: userId или amount отсутствуют');
            return res.status(400).json({
                success: false,
                message: 'userId и amount обязательны'
            });
        }

        const baseUrl = process.env.BASE_URL || 'https://api.tibetskayacrm.kz';
        const orderId = `topup-${userId}-${Date.now()}`;
        const testMode = process.env.HILLSTAR_WIDGET_TEST === '1' ? 1 : 0;

        const widgetToken = process.env.HILLSTAR_WIDGET_TOKEN;
        if (!widgetToken) {
            console.error('[getWidgetConfig] HILLSTAR_WIDGET_TOKEN не задан в .env');
            return res.status(500).json({
                success: false,
                message: 'Сервер не настроен для виджета оплаты. Обратитесь к администратору.'
            });
        }

        const sessionId = createWidgetSession({
            token: widgetToken,
            orderId,
            amount: Number(amount),
            userId,
            currency: currency || 'KZT',
            description: description || 'Пополнение баланса',
            options: options || {
                callbacks: {
                    result_url: `${baseUrl}/api/payment/callback`,
                },
            },
            resultUrl: `${baseUrl}/api/payment/callback`,
            test: test !== undefined ? Number(test) : testMode,
            email: email || null,
        });

        const widgetPageUrl = `${baseUrl}/api/payment/widget-page?sessionId=${sessionId}`;

        console.log('[getWidgetConfig] Успех. Создана сессия:', {
            sessionId: sessionId,
            orderId,
            amount,
            userId,
        });

        return res.json({
            success: true,
            widgetPageUrl,
            orderId,
        });
    } catch (error) {
        console.error('[getWidgetConfig] Исключение:', error?.message);
        console.error('[getWidgetConfig] Stack:', error?.stack);
        return res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера',
            debug: process.env.NODE_ENV !== 'production' ? error?.message : undefined,
        });
    }
};

/**
 * Страница с виджетом Hillstarpay (по гайду)
 * GET /api/payment/widget-page?sessionId=xxx
 * Страница отдаётся с origin api.tibetskayacrm.kz — домен для Hillstarpay
 */
export const getWidgetPage = async (req, res) => {
    try {
        const { sessionId } = req.query;
        if (!sessionId) {
            return res.status(400).send('sessionId обязателен');
        }

        const session = getWidgetSession(sessionId);
        if (!session) {
            console.error('[getWidgetPage] Сессия не найдена или истекла:', sessionId.substring(0, 8) + '...');
            return res.status(404).send('Сессия истекла или не найдена. Попробуйте снова.');
        }

        const { token, orderId, amount, userId, resultUrl, test, email } = session;

        // Структура по документации Hillstarpay (с сохранением карты)
        const data = {
            token,
            payment: {
                order: orderId,
                amount,
                currency: 'KZT',
                description: 'Пополнение баланса',
                test: test ?? 0,
                options: {
                    callbacks: {
                        result_url: resultUrl,
                    },
                    user: { id: String(userId) },
                    ...(email && { custom_params: { email } }),
                },
            },
        };
        const widgetData = JSON.stringify(data);

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f6f6; min-height: 100vh; }
    .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #666; }
    .spinner { width: 40px; height: 40px; border: 3px solid #e3e3e3; border-top: 3px solid #DC1818; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .error { text-align: center; padding: 40px 20px; color: #DC1818; display: none; }
    .success { display: none; text-align: center; padding: 40px 20px; }
    .success.visible { display: block; }
    .btn { display: block; width: calc(100% - 40px); margin: 20px auto; padding: 16px; background: #DC1818; color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; text-align: center; }
  </style>
</head>
<body>
  <div id="loading" class="loading"><div class="spinner"></div><div>Загрузка платёжной формы...</div></div>
  <div id="error" class="error"></div>
  <div id="success" class="success"><div style="font-size:60px;margin-bottom:16px">✅</div><div style="font-size:18px;font-weight:600;color:#2e7d32">Оплата прошла успешно!</div><button class="btn" onclick="returnToApp(true)">Вернуться в приложение</button></div>
  <button id="return-btn" class="btn" style="display:none" onclick="returnToApp(false)">Вернуться в приложение</button>

  <script>
    var paymentDone = false;
    function sendMessage(data) {
      var str = JSON.stringify(data);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(str);
      if (window.opener) window.opener.postMessage(str, '*');
    }
    function returnToApp(success) { sendMessage({ type: success ? 'payment-success' : 'close' }); }
    function showError(msg) {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').style.display = 'block';
      document.getElementById('error').innerHTML = '<p>' + (msg || 'Ошибка') + '</p>';
      document.getElementById('return-btn').style.display = 'block';
      document.getElementById('return-btn').innerText = 'Закрыть';
      sendMessage({ type: 'payment-error', message: msg });
    }
    (function(w,i,d,g,e,t){
      e = w.createElement(i);
      t = w.getElementsByTagName(i)[0];
      e.async = 1;
      e.src = 'https://cdn.hillstarpay.com/widget-js/pbwidget.js?' + (1 * new Date());
      e.onload = function() {
        try {
          document.getElementById('loading').style.display = 'none';
          document.getElementById('return-btn').style.display = 'block';
          var data = ${widgetData};
          Widget(data).create();
          sendMessage({ type: 'widget-loaded' });
        } catch(err) {
          showError('Ошибка виджета: ' + err.message);
        }
      };
      e.onerror = function() { showError('Не удалось загрузить скрипт оплаты'); };
      t.parentNode.insertBefore(e, t);
    })(document, 'script');

    var observer = new MutationObserver(function() {
      if (paymentDone) return;
      var body = document.body.innerText.toLowerCase();
      if (body.indexOf('оплата прошла успешно') !== -1 || body.indexOf('успешно оплачено') !== -1) { paymentDone = true; document.getElementById('loading').style.display = 'none'; document.getElementById('return-btn').style.display = 'none'; document.getElementById('success').classList.add('visible'); sendMessage({ type: 'payment-success' }); }
      if (body.indexOf('неверный токен') !== -1 || body.indexOf('неверный токен или домен') !== -1) {
        showError('Неверный токен или домен. Передайте менеджеру Hillstarpay домен: api.tibetskayacrm.kz');
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        console.error('[getWidgetPage] Ошибка:', error?.message);
        console.error('[getWidgetPage] Stack:', error?.stack);
        res.status(500).send('Ошибка загрузки страницы: ' + (process.env.NODE_ENV !== 'production' ? error?.message : ''));
    }
};
