# Интеграция Payplus.kz

Документация: https://payplus.kz/docs/en/

## 1. Переменные окружения

Добавьте в `.env`:

```
PAYPLUS_BASE_URL=https://payplus.kz
PAYPLUS_MERCHANT=ВАШ_MERCHANT_ID
PAYPLUS_SECRET=ВАШ_SECRET_KEY
API_BASE_URL=https://api.tibetskayacrm.kz
FRONTEND_URL=https://tibetskayacrm.kz
```

- `PAYPLUS_BASE_URL` — базовый URL API Payplus (уточните у поддержки после активации)
- `PAYPLUS_MERCHANT` — ID мерчанта из личного кабинета Payplus
- `PAYPLUS_SECRET` — секретный ключ мерчанта
- `API_BASE_URL` — URL вашего API (для callback и виджета)
- `FRONTEND_URL` — URL фронтенда (для редиректа после оплаты)

## 2. Настройка мерчанта в Payplus

В личном кабинете Payplus ([payplus.kz](https://payplus.kz)) укажите:

- **process_url**: `https://api.tibetskayacrm.kz/api/payment/payplus-callback`  
  (куда Payplus отправляет результат платежа, метод POST)

- **success_url**: `https://api.tibetskayacrm.kz/api/payment/success`  
  (редирект пользователя при успехе)

- **fail_url**: `https://api.tibetskayacrm.kz/api/payment/error`  
  (редирект при ошибке)

## 3. API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/payment/create | Создание платежа (sum, email, phone?, clientId?) |
| POST | /api/payment/widget-config | Конфиг для мобильного приложения (userId, amount, email?, phone?) |
| GET | /api/payment/widget-page?sessionId=xxx | HTML-страница для WebView |
| POST/GET | /api/payment/payplus-callback | Callback от Payplus |
| GET | /api/payment/success | Страница успешной оплаты |
| GET | /api/payment/error | Страница ошибки оплаты |

## 4. Web-страница оплаты

- Форма: сумма, email, телефон
- POST /api/payment/create → paymentUrl → открывается в новом окне
- После оплаты Payplus перенаправляет на success/error → postMessage → navigate на фронтенд

## 5. Мобильное приложение

Приложение вызывает `POST /api/payment/widget-config` с `userId` и `amount`, получает `widgetPageUrl` и открывает его в WebView. После оплаты Payplus перенаправляет на success/error, откуда WebView отправляет postMessage в React Native.

## 6. Модель PaymentSession

Используется для хранения сессий платежей. Уже импортируется в PaymentController.
