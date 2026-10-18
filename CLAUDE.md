# CRM-система (crm)

Full-stack: Node.js/Express бэкенд + React.js фронтенд. MongoDB. Socket.io. JWT auth.

## Запуск

```bash
npm run dev       # Одновременно сервер (nodemon) + клиент (React)
npm run server    # Только бэкенд (nodemon index.js)
npm run client    # Только фронтенд (cd client && npm start)
npm start         # Только бэкенд (node index.js)
```

Бэкенд: порт из `.env`. Фронтенд: `client/` — Create React App, порт 3000.

## Бэкенд — структура

```
index.js                # Express app, MongoDB connect, Socket.io, все роуты
Controllers/            # Контроллеры (ES modules, .js)
Models/                 # Mongoose схемы
utils/
  checkAuth.js          # JWT middleware (Bearer)
  checkRole.js          # Проверка роли пользователя
  checkAuthAggregator.js
FireBase/               # Firebase Admin SDK
migrations/             # Одноразовые скрипты миграции
uploads/                # Загруженные файлы
addressImages/          # Фото адресов (создаётся автоматически)
telegram/               # Telegram bot
whatsApp/               # WhatsApp Web client (waWebClient.js)
paymentRoutes.js        # Роуты оплаты (ApiPay)
excelProcessor.js       # Обработка Excel-файлов
pushNotification.js     # Пуши для курьеров
pushNotificationClient.js # Пуши для клиентов
```

## Контроллеры

| Контроллер | Назначение |
|-----------|-----------|
| `UserController` | Пользователи CRM (менеджеры, операторы) |
| `ClientController` | Клиенты (физ/юр лица) |
| `CourierController` | Курьеры |
| `CourierAggregatorController` | Агрегаторы курьеров |
| `OrderController` | Заказы |
| `SubscriptionController` | Подписки клиентов |
| `DepartmentController` | Филиалы/отделы |
| `MobileController` | API для мобильных приложений |
| `NotificationController` | Push-уведомления |
| `AnalyticsController` | Аналитика и отчёты |
| `AquaMarketController` | Аква-маркет |
| `FaqController` | FAQ |
| `PaymentController` | Платежи |
| `PromoCodeController` | Промокоды |
| `InvoiceCounterController` | Счётчик инвойсов |
| `MobileAppSettingsController` | Настройки мобильных приложений |
| `BussinessCenterController` | Бизнес-центры |
| `ApiPayController` | Интеграция ApiPay |
| `PartnerController` | Авторизация приложения партнёров (tibetskaya_partner) |

## Модели (Mongoose)

`Client`, `Order`, `Courier`, `CourierAggregator`, `User`, `Department`, `DepartmentHistory`, `Subscription`, `Notification`, `ClientNotificationLog`, `AquaMarket`, `AquaMarketHistory`, `PromoCode`, `Accessories`, `MobileAppSettings`, `Faq`, `InvoiceGlobalCounter`, `ClientPayment`, `ApiPayInvoice`, `Pickup`, `Queue`, `SupportContacts`, `CourierRestrictions`, `Partner`

## Бэкенд — технологии

- `express` — HTTP сервер
- `mongoose` — MongoDB ODM
- `socket.io` — WebSocket (real-time обновления)
- `jsonwebtoken` — JWT (checkAuth middleware)
- `bcrypt` — хэширование паролей
- `firebase-admin` — отправка push-уведомлений
- `multer` — загрузка файлов
- `pdfkit` — генерация PDF
- `node-cron` / `node-schedule` — планировщик задач
- `nodemailer` — email-рассылка
- `axios` — внешние HTTP-запросы
- `expo-server-sdk` — Expo push-уведомления
- `moment-timezone` — работа с временными зонами (UTC+5)
- `concurrently` — параллельный запуск сервер+клиент

## Фронтенд (`client/`) — React.js

```
client/src/
  App.js              # Роутинг (react-router-dom), AuthContext
  AuthContext.js      # Контекст авторизации
  api.js              # Axios instance
  auth.hook.js        # useAuth хук
  routes.js           # Конфиг маршрутов
  Pages/              # Страницы (см. ниже)
  Components/         # Переиспользуемые компоненты
  customHooks/        # Кастомные хуки
  utils/              # Утилиты
```

### Страницы CRM (`client/src/Pages/`)

| Страница | Назначение |
|---------|-----------|
| `Login` | Вход в систему |
| `ClientList` / `ClientPage` / `AddClient` | Клиенты |
| `OrderList` / `OrderPage` / `AddOrder` / `AddOrder2` | Заказы |
| `CourierList` / `CourierPage` / `AddCourier` | Курьеры |
| `DepartmentList` / `DepartmentPage` / `AddDepartment` | Филиалы |
| `Analytics` / `SAAnalytics` / `Charts` | Аналитика |
| `DistributeOrders` / `TransferOrders` | Распределение заказов |
| `PromoCodeList` / `AddPromoCode` | Промокоды |
| `AquaMarket/*` | Аква-маркет |
| `Courier/*` | Детали курьера |
| `Department/*` | Детали филиала |
| `Admin/*` | Раздел администратора |
| `SuperAdmin/*` | Суперадмин |
| `PaymentPage` / `PaymentSuccess` / `PaymentError` | Оплата |
| `SendNotificationToClients` | Рассылка уведомлений |
| `Support` / `SupportChat` | Поддержка |
| `CompletedOrders` / `OrdersWholeList` / `AdditionalOrdersWholeList` | Сводки заказов |
| `CourierAggregatorPage` / `BusinessCenterCourierAggregatorPage` | Агрегаторы |

### Компоненты (`client/src/Components/`)

`Container`, `MyButton`, `MyInput`, `DataInput`, `Info`, `OrderInfo`, `MyNavigation`, `MySnackBar`, `PrivateRoute`, `ChooseClientModal`, `ChooseCourierModal`, `ChooseFranchiseeModal`, `ChooseCourierAggregatorModal`, `ConfirmDeleteModal`, `NotificationComponent`, `CourierActiveOrders`, `CourierDeliveredOrders`, `UpdateClientData`, `UpdateFranchiseeData`, `ChangePassword`, `LinkButton`, `Li`, `Li2`, `Div`

### Фронтенд — технологии

- `react-router-dom` — маршрутизация
- `axios` — HTTP
- `tailwindcss` — стили
- `socket.io-client` — WebSocket

## Переменные окружения (`.env`)

```
MONGOURL=           # MongoDB connection string
JWT_SECRET=         # JWT secret
PORT=               # Порт сервера
```

## Важно

- `PaymentSession.js` — управление сессиями оплаты
- `updateOrderCoordinates.js` — обновление координат заказов
- `cleanup_duplicates.js` — очистка дубликатов
- `accessoriesImages/` — изображения аксессуаров
- Telegram и WhatsApp интеграции для уведомлений оператора
- `pdfTitle.png` / `pdfEnd.png` — шапка/подвал для генерируемых PDF

## VoIP-звонки клиент ↔ курьер (`calls/`)

WebRTC P2P, сигналинг через Socket.io namespace `/calls`, TURN — coturn на этом же сервере (`deploy/coturn/turnserver.conf.example`).

- Подключение: `io(`${API}/calls`, { auth: { token: <access JWT>, deviceId?: <id установки приложения> } })`. Токены: клиент `{ client }`, курьер `{ _id, role: "courier" }` (CourierAggregator). Без валидного токена — `connect_error: UNAUTHORIZED`.
- Клиент → сервер (с ack `{ ok, data } | { ok: false, error: { code, message } }`): `call:invite {orderId}`, `call:accept {callId}`, `call:reject {callId}`, `call:end {callId}`, `call:signal {callId, kind: offer|answer|ice, payload}` (только в принятом звонке).
- Сервер → клиент: `call:incoming {callId, orderId, caller}`, `call:accepted {callId}`, `call:signal`, `call:ended {callId, status, reason, durationSec}`, `call:resume` (после переподключения).
- `GET /calls/ice-servers` (Bearer) — STUN/TURN с временной учёткой (HMAC, TTL 4 ч).
- Правило доступа (`callPolicy.js`): только клиент и назначенный курьер заказа; от назначения курьера до 30 мин после `deliveredTime`; не для `cancelled`.
- Живое состояние — в памяти процесса (один инстанс). При кластеризации нужен Redis + `@socket.io/redis-adapter`.
- Env: `TURN_SECRET` (= `static-auth-secret` coturn), `TURN_URLS`, `STUN_URLS` (через запятую).
- Пуши о входящем (`calls/push/`): при каждом `invite` вызываемому уходит VoIP-пуш APNs (iOS, PushKit → CallKit) и high-priority FCM data (Android, `type: incoming_call`); неотвеченный звонок шлёт на Android `type: call_ended`. На iOS отмену не шлём — любой VoIP-пуш обязан показать CallKit. `callUuid` = `callIdToUuid(callId)`.
- Токены устройств: `POST /calls/push-token {platform: ios|android, token, apnsEnvironment: sandbox|production}`, `DELETE /calls/push-token {token}` (Bearer), коллекция `CallPushToken` (до 5 устройств на участника, протухшие удаляются по ответу APNs/FCM).
- Env пушей: `APNS_KEY_PATH` (.p8, тип «Apple Push Notifications service»), `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID_CLIENT` (com.tibetskayaclientapp), `APNS_BUNDLE_ID_COURIER` (com.tibetskayacourier2.app), `COURIER_FIREBASE_SERVICE_ACCOUNT_PATH` (проект courier-74d57), `CLIENT_FIREBASE_SERVICE_ACCOUNT_PATH` (необязательно: по умолчанию используется firebase-приложение `client-app`). Не заданный канал отключается с предупреждением в логе.
- Звонок на устройство заказа: клиентское приложение передаёт `deviceId` (UUID установки) при создании заказа (`Order.clientDeviceId`, в т.ч. в `pendingOrderDraft` ApiPay), в `POST /calls/push-token` и в `auth` сокета. Входящий, пуши и все события звонка идут только на это устройство (комната `client:<id>:device:<deviceId>`), принять звонок с другого устройства аккаунта нельзя. Нет `clientDeviceId` (заказ из CRM / старое приложение) или устройство уже не в аккаунте (нет push-токена и сокета) — звонок на все устройства, как раньше.
- Тесты: `npm run test:calls`.

## Партнёры (`PartnerController`, `PartnerProgramController`, приложение `tibetskaya_partner`)

- Программа: клиент регистрируется в клиентском приложении с кодом партнёра (`Partner.referralCode`, поле «Реферальный код») → клиенту 200 ₸ на `Client.balance`, партнёру 200 ₸ на `Partner.balance` (`MobileController.clientRegister` → `utils/partnerLedger.js#applyPartnerReferralBonus`). У клиента ставится `referredByPartner`. Свой код партнёр использовать не может (сверка по телефону).
- Журнал: `PartnerTransaction` (`referral_bonus` +200 / `withdrawal` −сумма, статусы `completed`/`pending`/`paid`/`rejected`). Бонус за клиента — не более одного раза (уникальный индекс).
- Вывод как у курьеров: `POST /requestPartnerWithdrawal {amount, requestId}` — требует реквизиты (`/updatePartnerCardData {accountNumber, IIN, fullName}`), сумма **сразу списывается** с баланса (у партнёров нет страницы в CRM для ручного списания), заявка `pending`, сообщение в Telegram (`telegram/sendPartnerWithdraw.js`, env `TELEGRAM_BOT_TOKEN_SUPPORT` + `TELEGRAM_PARTNER_WITHDRAW_CHAT_ID` или `TELEGRAM_WITHDRAW_CHAT_ID`). Повтор с тем же `requestId` не списывает второй раз.
- Данные для приложения: `/getPartnerDataMobile` (профиль, баланс, реквизиты), `/getPartnerClients`, `/getPartnerTransactions` — все за `checkAuthPartner`, партнёр только из токена.
- Вход/регистрация как у клиента, код в WhatsApp: `/sendPartnerRegisterOtp` → `/partnerCodeConfirm` → `/partnerRegister`; вход `/sendPartnerLoginOtp` → `/partnerLoginOtp`.
- Токен партнёра подписан ключом, производным от `SecretKey` (`utils/partnerToken.js`) — не проходит `checkAuth`/`checkAuthAggregator`, и наоборот.
- OTP: `utils/phoneOtpStore.js` — TTL 5 мин, cooldown 60 с (отдельно для входа и регистрации), 5 попыток на код и не более 10 неверных вводов на телефон в час; в памяти процесса.
- Тесты: `npm run test:partner`.
