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

## Модели (Mongoose)

`Client`, `Order`, `Courier`, `CourierAggregator`, `User`, `Department`, `DepartmentHistory`, `Subscription`, `Notification`, `ClientNotificationLog`, `AquaMarket`, `AquaMarketHistory`, `PromoCode`, `Accessories`, `MobileAppSettings`, `Faq`, `InvoiceGlobalCounter`, `ClientPayment`, `ApiPayInvoice`, `Pickup`, `Queue`, `SupportContacts`, `CourierRestrictions`

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
