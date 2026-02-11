# Hillstarpay JS-виджет: Подключение, сохранение карты и оплата

## Содержание

1. [Получение доступа](#1-получение-доступа)
2. [Подключение скрипта виджета](#2-подключение-скрипта-виджета)
3. [Простая оплата через виджет](#3-простая-оплата-через-виджет)
4. [Оплата с сохранением карты](#4-оплата-с-сохранением-карты)
5. [Обработка callback (webhook)](#5-обработка-callback-webhook)
6. [Оплата сохранённой картой (рекуррентный платёж)](#6-оплата-сохранённой-картой-рекуррентный-платёж)
7. [Получение статуса платежа](#7-получение-статуса-платежа)
8. [Возврат платежа](#8-возврат-платежа)
9. [Формирование подписи (pg_sig)](#9-формирование-подписи-pg_sig)

---

## 1. Получение доступа

Перед подключением:

- Получите у менеджера Hillstarpay персональный **токен** (для виджета) и **merchant_id** + **secret_key** (для серверного API).
- Передайте менеджеру **домен**, на котором будет использоваться виджет.

---

## 2. Подключение скрипта виджета

Добавьте перед закрывающим тегом `</body>` на странице (или в React — в `index.html`):

```html
<script>
  (function (w, i, d, g, e, t) {
    e = w.createElement(i);
    t = w.getElementsByTagName(i)[0];
    e.async = 1;
    e.src = 'https://cdn.hillstarpay.com/widget-js/pbwidget.js?' + (1 * new Date());
    e.onload = () => {
      // Виджет загружен — можно активировать кнопку оплаты
      document.getElementById('payBtn').disabled = false;
    };
    t.parentNode.insertBefore(e, t);
  })(document, 'script');
</script>
```

> В React/Next.js можно загрузить скрипт динамически в `useEffect`.

---

## 3. Простая оплата через виджет

```html
<button id="payBtn" disabled>Оплатить</button>

<script>
  function startPayment() {
    const data = {
      token: 'ВАШ_ТОКЕН',
      payment: {
        order: 'order-12345',        // уникальный номер заказа
        amount: 1000,                // сумма в тенге
        currency: 'KZT',
        description: 'Пополнение баланса',
        test: 1                      // 1 = тестовый режим, 0 = боевой
      }
    };
    Widget(data).create();
  }

  document.getElementById('payBtn').addEventListener('click', startPayment);
</script>
```

---

## 4. Оплата с сохранением карты

Чтобы при оплате **сохранить карту клиента**, добавьте в `payment` блок `options` с `user.id` и `callbacks.result_url`:

```javascript
function startPaymentWithSaveCard(userId, orderId, amount) {
  const data = {
    token: 'ВАШ_ТОКЕН',
    payment: {
      order: orderId,
      amount: amount,
      currency: 'KZT',
      description: 'Пополнение баланса',
      test: 1,                       // убрать в проде
      options: {
        callbacks: {
          result_url: 'https://api.tibetskayacrm.kz/api/payment/callback'
        },
        user: { id: userId }          // ID клиента в вашей системе
      }
    }
  };
  Widget(data).create();
}
```

### Что происходит:

1. Клиент оплачивает через виджет.
2. Hillstarpay отправляет на `result_url` POST-запрос с данными платежа.
3. В ответе придут поля для повторных списаний:
   - **`pg_card_token`** — токен сохранённой карты
   - **`pg_card_id`** — ID карты
4. Сохраните `pg_card_token` и `pg_card_id` в базе, привязав к `userId`.

### Передача дополнительных параметров (custom_params)

Можно передать произвольные данные, которые вернутся в webhook:

```javascript
options: {
  callbacks: {
    result_url: 'https://api.tibetskayacrm.kz/api/payment/callback'
  },
  user: { id: userId },
  custom_params: {
    email: 'client@example.com',
    clientId: '64abc123def456',
    type: 'balance_replenishment'
  }
}
```

---

## 5. Обработка callback (webhook)

На `result_url` приходит POST-запрос со следующими ключевыми полями:

| Поле | Описание |
|------|----------|
| `pg_result` | `1` — успех, `0` — ошибка |
| `pg_payment_id` | ID транзакции в Hillstarpay |
| `pg_order_id` | Ваш номер заказа |
| `pg_amount` | Сумма |
| `pg_card_token` | Токен карты (если сохранение включено) |
| `pg_card_id` | ID карты (если сохранение включено) |
| `pg_sig` | Подпись для проверки |

### Пример обработки (Node.js / Express):

```javascript
export const handleWidgetCallback = async (req, res) => {
  const data = req.body;
  const { pg_result, pg_order_id, pg_payment_id, pg_amount,
          pg_card_token, pg_card_id, pg_sig } = data;

  // 1. Проверяем подпись
  const isValid = verifySignature(data, SECRET_KEY, 'callback');
  if (!isValid) {
    return res.status(400).json({ status: 'error' });
  }

  // 2. Если платёж успешен
  if (pg_result === '1') {
    // Обновляем баланс клиента, статус заказа и т.д.

    // 3. Если пришёл токен карты — сохраняем
    if (pg_card_token && pg_card_id) {
      await Client.findByIdAndUpdate(clientId, {
        $set: {
          savedCard: {
            cardToken: pg_card_token,
            cardId: pg_card_id
          }
        }
      });
    }
  }

  res.json({ status: 'ok' });
};
```

---

## 6. Оплата сохранённой картой (рекуррентный платёж)

Двухэтапный процесс: **init** (инициация) → **direct** (подтверждение).

### Шаг 1: Инициация платежа

```
POST https://api.hillstarpay.com/v1/merchant/{merchant_id}/card/init
```

| Поле | Обязательное | Описание |
|------|:---:|----------|
| `pg_merchant_id` | да | ID магазина |
| `pg_amount` | да | Сумма (мин. 0.01) |
| `pg_order_id` | да | ID заказа |
| `pg_user_id` | да | ID пользователя (тот же, что при сохранении) |
| `pg_card_token` | да | Токен сохранённой карты |
| `pg_description` | да | Описание платежа |
| `pg_salt` | да | Случайная строка |
| `pg_sig` | да | Подпись запроса |
| `pg_result_url` | нет | URL для webhook результата |
| `pg_success_url` | нет | URL редиректа при успехе |
| `pg_failure_url` | нет | URL редиректа при ошибке |

#### Пример на Node.js:

```javascript
import crypto from 'crypto';
import axios from 'axios';
import { generateSignature, MERCHANT_ID, SECRET_KEY } from '../utils/hillstar.js';

async function initSavedCardPayment({ userId, cardToken, orderId, amount, description }) {
  const params = {
    pg_merchant_id: MERCHANT_ID,
    pg_amount: amount.toString(),
    pg_order_id: orderId,
    pg_user_id: userId,
    pg_card_token: cardToken,
    pg_description: description,
    pg_salt: crypto.randomBytes(8).toString('hex'),
    pg_result_url: 'https://api.tibetskayacrm.kz/api/payment/callback',
  };

  // Подпись: имя скрипта = "card/init"
  params.pg_sig = generateSignature('card/init', params, SECRET_KEY);

  const formData = new URLSearchParams();
  for (const key in params) {
    formData.append(key, params[key]);
  }

  const response = await axios.post(
    `https://api.hillstarpay.com/v1/merchant/${MERCHANT_ID}/card/init`,
    formData,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  // Ответ в XML, извлекаем pg_payment_id
  const xml = response.data;
  const paymentIdMatch = xml.match(/<pg_payment_id>(.*?)<\/pg_payment_id>/);

  if (!paymentIdMatch) {
    throw new Error('Не удалось получить payment_id: ' + xml);
  }

  return paymentIdMatch[1]; // pg_payment_id
}
```

### Шаг 2: Подтверждение платежа

```
POST https://api.hillstarpay.com/v1/merchant/{merchant_id}/card/direct
```

| Поле | Обязательное | Описание |
|------|:---:|----------|
| `pg_merchant_id` | да | ID магазина |
| `pg_payment_id` | да | ID транзакции из шага 1 |
| `pg_salt` | да | Случайная строка |
| `pg_sig` | да | Подпись запроса |

#### Пример на Node.js:

```javascript
async function confirmSavedCardPayment(paymentId) {
  const params = {
    pg_merchant_id: MERCHANT_ID,
    pg_payment_id: paymentId,
    pg_salt: crypto.randomBytes(8).toString('hex'),
  };

  params.pg_sig = generateSignature('card/direct', params, SECRET_KEY);

  const formData = new URLSearchParams();
  for (const key in params) {
    formData.append(key, params[key]);
  }

  const response = await axios.post(
    `https://api.hillstarpay.com/v1/merchant/${MERCHANT_ID}/card/direct`,
    formData,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data; // XML с результатом
}
```

### Полный flow в одном контроллере:

```javascript
export const chargeWithSavedCard = async (req, res) => {
  try {
    const { clientId, amount } = req.body;
    const client = await Client.findById(clientId);

    if (!client?.savedCard?.cardToken) {
      return res.status(400).json({ success: false, message: 'Нет сохранённой карты' });
    }

    // Шаг 1: init
    const paymentId = await initSavedCardPayment({
      userId: clientId,
      cardToken: client.savedCard.cardToken,
      orderId: Date.now().toString(),
      amount,
      description: 'Списание с сохранённой карты',
    });

    // Шаг 2: direct
    const result = await confirmSavedCardPayment(paymentId);

    // Проверяем результат
    const statusMatch = result.match(/<pg_transaction_status>(.*?)<\/pg_transaction_status>/);
    if (statusMatch && statusMatch[1] === 'ok') {
      await Client.findByIdAndUpdate(clientId, { $inc: { balance: amount } });
      return res.json({ success: true, message: 'Оплата прошла успешно' });
    }

    return res.status(400).json({ success: false, message: 'Оплата не прошла', raw: result });
  } catch (error) {
    console.error('Ошибка оплаты сохранённой картой:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
```

---

## 7. Получение статуса платежа

```
POST https://api.hillstarpay.com/get_status3.php
```

| Поле | Описание |
|------|----------|
| `pg_merchant_id` | ID мерчанта |
| `pg_payment_id` | ID платежа (или `pg_order_id`) |
| `pg_salt` | Случайная строка |
| `pg_sig` | Подпись (имя скрипта: `get_status3.php`) |

Ответ содержит: `pg_payment_status` (`success` / `error` / `process`), `pg_amount`, `pg_card_token` и др.

---

## 8. Возврат платежа

```
POST https://api.hillstarpay.com/revoke.php
```

| Поле | Обязательное | Описание |
|------|:---:|----------|
| `pg_merchant_id` | да | ID мерчанта |
| `pg_payment_id` | да | ID платежа |
| `pg_refund_amount` | нет | Сумма возврата (0 или пусто = полный возврат) |
| `pg_salt` | да | Случайная строка |
| `pg_sig` | да | Подпись (имя скрипта: `revoke.php`) |

---

## 9. Формирование подписи (pg_sig)

Алгоритм одинаков для всех запросов:

1. Берём все параметры **кроме** `pg_sig`.
2. Сортируем ключи **по алфавиту**.
3. Формируем массив: `[имя_скрипта, значение1, значение2, ..., secret_key]`.
4. Соединяем через `;`.
5. Берём **MD5** от получившейся строки.

```javascript
import crypto from 'crypto';

function generateSignature(scriptName, params, secretKey) {
  const sortedKeys = Object.keys(params).sort();
  const signatureArray = [scriptName];

  for (const key of sortedKeys) {
    signatureArray.push(params[key]);
  }

  signatureArray.push(secretKey);

  const signString = signatureArray.join(';');
  return crypto.createHash('md5').update(signString).digest('hex');
}
```

### Имена скриптов для разных эндпоинтов:

| Эндпоинт | Имя скрипта |
|----------|-------------|
| Инициация платежа | `init_payment.php` |
| Callback (result_url) | последний сегмент URL (например `callback`) |
| Оплата сохранённой картой (init) | `card/init` |
| Подтверждение (direct) | `card/direct` |
| Статус платежа | `get_status3.php` |
| Возврат | `revoke.php` |

---

## Схема полного flow

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Клиент    │      │  Ваш сервер  │      │ Hillstarpay │
└──────┬──────┘      └──────┬───────┘      └──────┬──────┘
       │                    │                      │
       │  1. Нажимает       │                      │
       │     "Оплатить"     │                      │
       │ ──────────────────>│                      │
       │                    │                      │
       │  2. Widget(data)   │                      │
       │     .create()      │                      │
       │ ──────────────────────────────────────────>│
       │                    │                      │
       │  3. Оплата на      │                      │
       │     странице HS    │                      │
       │ ──────────────────────────────────────────>│
       │                    │                      │
       │                    │  4. POST callback    │
       │                    │  (pg_card_token,     │
       │                    │   pg_card_id)        │
       │                    │<─────────────────────│
       │                    │                      │
       │                    │  5. Сохраняем токен  │
       │                    │     в базу           │
       │                    │                      │
       │  ...позже...       │                      │
       │                    │                      │
       │  6. Повторная      │                      │
       │     оплата         │                      │
       │ ──────────────────>│                      │
       │                    │  7. card/init        │
       │                    │ ────────────────────>│
       │                    │  8. payment_id       │
       │                    │ <────────────────────│
       │                    │  9. card/direct      │
       │                    │ ────────────────────>│
       │                    │  10. ok              │
       │                    │ <────────────────────│
       │  11. Успех         │                      │
       │ <──────────────────│                      │
```
