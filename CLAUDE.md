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
| `PartnerManagementController` | CRM-страница «Партнёры»: список с аналитикой, блокировка, заявки на вывод (только суперадмин) |
| `DeliveryPartnerController` / `DeliveryPartnerAdminController` | Кабинет партнёра по доставке (заказы его курьеров) / управление партнёрами и привязка курьеров (суперадмин) |

## Модели (Mongoose)

`Client`, `Order`, `Courier`, `CourierAggregator`, `User`, `Department`, `DepartmentHistory`, `Subscription`, `Notification`, `ClientNotificationLog`, `AquaMarket`, `AquaMarketHistory`, `PromoCode`, `Accessories`, `MobileAppSettings`, `Faq`, `InvoiceGlobalCounter`, `ClientPayment`, `ApiPayInvoice`, `Pickup`, `Queue`, `SupportContacts`, `CourierRestrictions`, `Partner`, `CarWash`, `CarWashUser`, `CarWashCoupon`, `CarWashCouponEngagement` (купон на мойку, см. раздел ниже), `DeliveryPartner` (партнёр по доставке, см. раздел ниже)

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
- Технические работы в клиентском приложении: `MobileAppSettings.maintenanceEnabled` / `maintenanceMessage`; CRM суперадмин → «Версия приложения» (`/setMaintenanceSettings`); приложение читает открытый `GET /getMaintenanceStatusMobile` при запуске, возврате в приложение и каждые 5 мин (пока модалка открыта — каждую минуту), модалка `src/components/MaintenanceModal.tsx` не закрывается вручную.

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
- Бонус за заказы: партнёру 200 ₸ за бутыль 18,9 л (`b19`) и 100 ₸ за бутыль 12,5 л (`b12`) доставленного заказа его клиента (`orderBottleBonus`) — `utils/partnerLedger.js#applyPartnerOrderBonus(orderId)`, вызывается рядом с `applyReferrerBonusOnFirstDeliveredOrder` во всех трёх местах доставки (`OrderController`, `CourierController`, `CourierAggregatorController`). Один раз на заказ (уникальный индекс `order + type`), количества перечитываются из БД на момент доставки.
- Журнал: `PartnerTransaction` (`referral_bonus` +200 / `withdrawal` −сумма, статусы `completed`/`pending`/`paid`/`rejected`). Бонус за клиента — не более одного раза (уникальный индекс).
- Вывод как у курьеров: `POST /requestPartnerWithdrawal {amount, requestId}` — требует реквизиты (`/updatePartnerCardData {accountNumber, IIN, fullName}`), сумма **сразу списывается** с баланса (у партнёров нет страницы в CRM для ручного списания), заявка `pending`, сообщение в Telegram (`telegram/sendPartnerWithdraw.js`, env `TELEGRAM_BOT_TOKEN_SUPPORT` + `TELEGRAM_PARTNER_WITHDRAW_CHAT_ID` или `TELEGRAM_WITHDRAW_CHAT_ID`). Повтор с тем же `requestId` не списывает второй раз. Минимум 5000 ₸ (`PARTNER_MIN_WITHDRAWAL`); комиссия 2,5%, не меньше 200 ₸, округление вверх (`withdrawalFee`) — списывается вся сумма, к переводу `payoutAmount = сумма − fee`. Заявки обрабатываются в CRM (страница «Партнёры»): «выплачено» / «отклонено» (возврат всей суммы).
- Данные для приложения: `/getPartnerDataMobile` (профиль, баланс, реквизиты), `/getPartnerClients`, `/getPartnerTransactions` — все за `checkAuthPartner`, партнёр только из токена.
- Вход/регистрация как у клиента, код в WhatsApp: `/sendPartnerRegisterOtp` → `/partnerCodeConfirm` → `/partnerRegister`; вход `/sendPartnerLoginOtp` → `/partnerLoginOtp`.
- Токен партнёра подписан ключом, производным от `SecretKey` (`utils/partnerToken.js`) — не проходит `checkAuth`/`checkAuthAggregator`, и наоборот.
- OTP: `utils/phoneOtpStore.js` — TTL 5 мин, cooldown 60 с (отдельно для входа и регистрации), 5 попыток на код и не более 10 неверных вводов на телефон в час; в памяти процесса.
- Ритм заказов клиентов партнёров (`utils/partnerClientActivity.js`): интервал = среднее двух промежутков между последними тремя доставленными заказами (`Order.date.d`), с округлением вверх. Клиент «перестал заказывать», если с последнего заказа прошло больше интервала и нет заказа в работе. Cron `utils/partnerLapseCheck.js` (11:00 Asia/Almaty) шлёт партнёру push один раз на перерыв (`Client.partnerLapseNotifiedDay`). Тот же расчёт отдаётся в `/getPartnerClients` (`lastOrderDay`, `intervalDays`, `isLapsed`). Индекс `Order { client: 1, "date.d": -1 }`.
- CRM, страница клиента (только `superAdmin`, `utils/requireSuperAdmin.js`): блок «Партнёр» (`client/src/Components/ClientPartnerBinding.js`) — `/searchPartnersAdmin`, `/getClientPartnerAdmin`, `/setClientPartner {clientId, partnerId|null}`. Привязка начисляет бонусы как регистрация по коду (`applyPartnerBindingBonuses`).
- Проверка партнёра: `Partner.verification {status: waiting|verified|denied, message}`; без поля (партнёры до введения) = `waiting`. Решение — суперадмин в CRM (`/setPartnerVerificationAdmin`, страница «Партнёры»), партнёру push `type: verification`. До `verified`: приложение показывает только экран ожидания, сервер отдаёт лишь профиль и push-токены (`utils/requireVerifiedPartner.js` на клиентах, истории, реквизитах и выводе), код партнёра не принимается при регистрации клиента.
- «Ушедший» клиент (`isChurned` в `/getPartnerClients`): с последнего заказа прошло больше `CHURN_INTERVAL_MULTIPLIER` (3) обычных интервалов. Партнёр может убрать его из списка — `/hidePartnerClient {clientId}` (сервер сам проверяет `isChurned`), в `Client.partnerHiddenOrderDay` запоминается день последнего заказа. Привязка и начисления не меняются (оферта, п. 4.8); новый заказ возвращает клиента в список (`isHiddenFromPartner`).
- Удаление аккаунта: `/deletePartnerAccount` → `Partner.status = "deleted"`, `deletedAt`, push-токены очищаются. Данные не стираются. `checkAuthPartner` отвечает 401 (приложение выходит на всех устройствах), вход и повторная регистрация с этим номером запрещены. Восстановить может суперадмин (`active`); ставить `deleted` из CRM нельзя (`ADMIN_SETTABLE_PARTNER_STATUSES`).
- Вход без кода (тестовый аккаунт для проверки App Store / Google Play): номера из env `PARTNER_LOGIN_WITHOUT_OTP_PHONES` (через запятую, `7XXXXXXXXXX`; по умолчанию `77006837203`, пустая строка — выключено). `/sendPartnerLoginOtp` для них сразу отдаёт `{ accessToken, partnerData }` без WhatsApp, приложение входит без экрана кода. Только вход в существующий активный аккаунт.
- Уведомление партнёру от администратора (без страницы в CRM): `POST /sendPartnerNotificationAdmin {partnerId, title, body, changedBy, reason}` — `checkAuth` + `requireSuperAdmin`, только активному партнёру, push `data.type: admin_message`. Ответ `{ success, sent }` — на сколько устройств принято (0 — нет устройств с уведомлениями).
- Документы партнёра (оферта, политика конфиденциальности) — на сайте `tibetskaya/client`: `/partnerOffer`, `/partnerPrivacyPolicy`.
- Тесты: `npm run test:partner`.

## Счета юрлиц и сверка с выпиской ForteBusiness

- Счёт: клиентское приложение → `POST /generateInvoicePdfMobile` (`checkAuth`, клиент только из токена) → PDF + документ `Invoice` (снимок количества, цен, `buyerBin` = `Client.bin` или 12 цифр из `invoiceLegalData`). В PDF строка «Назначение платежа: Оплата по счёту № N». В ответе `invoiceId` и `total`.
- Аренда возвратной тары: в запросе `rent19` / `rent12` (шт., необязательно — старые версии приложения не присылают). Цена одна для всех — `utils/invoiceRental.js#RENTAL_PRICES` (18,9 л — 3500 ₸, 12,5 л — 2500 ₸; в приложении та же константа `RENTAL_PRICES` в `BusinessInvoice.tsx`). В `Invoice` снимок `rent19/rent12/rentPrice19/rentPrice12`, `total` = вода + аренда. При оплате аренда только фиксируется: `coupon` получает бутыли воды, `balance` — оплату минус сумму аренды.
- Зачисление — только `utils/invoicePayment.js#applyInvoicePayment`: атомарно `issued → paid`, затем `$inc` клиенту, затем `creditApplied: true` (без транзакций; `paid` + `creditApplied: false` = сбой между шагами, CRM показывает). `coupon` → `paidBootlesFor19/12` из счёта (+ переплата на `balance`), `balance` → вся сумма в тенге. Недоплата и `fakt` автоматически не зачисляются (`REVIEW`); менеджер может подтвердить `fakt` без зачисления. Пишет `ClientOperationLog`, `ClientPayment` (`sessionOrderId: INV-<номер>`, в истории «Оплата по счёту»), push `balanceTopUpSuccess`.
- Выписка: `utils/forteBusiness.js` (fincore, только чтение). Шлюз требует заголовок `X-Gravitee-Api-Key`, токен 10 мин, даты `dd.mm.yyyy`, страницы с 0. `utils/bankStatementSync.js`: cron каждый час в :55 по Алматы (`startBankStatementSync` в `server.listen`), читает выписку только за сегодня (`getTodayPeriod`; запуск в 23:55 закрывает сутки). Кнопка суперадмина «Сверить с выпиской сейчас» добирает пропущенное: от последней сохранённой операции минус 5 дней, не дальше 31 дня (`getSyncPeriod`, `todayOnly: false`), операции в `BankTransaction` (уникальный `bankRef`), правила сопоставления — `utils/invoiceMatching.js` (номер счёта из назначения + совпадение БИН; без номера — единственный неоплаченный счёт этого БИН на ту же сумму). Одна операция закрывает максимум один счёт (`Invoice.paymentRef` уникален, `forte:<id>`).
- CRM: карточка клиента — поле «БИН/ИИН покупателя» и список счетов (кнопки «Оплачен» / «Отменить», суперадмин и франчайзи своих клиентов); суперадмин → «Счета юрлиц и поступления ForteBank» (`/superAdminInvoices`): разбор «Требует проверки», «Сверить с выпиской сейчас».
- Эндпоинты: `/getInvoices`, `/confirmInvoicePayment`, `/cancelInvoice` (`checkAuth`, доступ по `Invoice.franchisee`); `/getBankTransactionsAdmin`, `/resolveBankTransactionAdmin`, `/syncBankStatementAdmin` (`requireSuperAdmin`); `/checkInvoicePaymentMobile` (клиент; только статус счетов из базы, банк не опрашивает; кнопки в приложении нет — эндпоинт оставлен для старых версий, итог — `utils/invoicePaymentCheck.js`).
- Env: `FORTE_BUSINESS_CLIENT_ID`, `FORTE_BUSINESS_CLIENT_SECRET`, `FORTE_BUSINESS_API_KEY`, `FORTE_BUSINESS_ACCOUNT` (р/с), необязательно `FORTE_BUSINESS_BASE_URL`. Не заданы — сверка выключена, ручное подтверждение работает.
- Тесты: `npm run test:partner` (`invoiceMatching`, `invoicePayment`, `forteBusiness`, `bankStatementSync`).

## Купон на автомойку (`CarWashController`, `CarWashAdminController`, `utils/carWashCoupon.js`)

- Выдача: за каждый доставленный заказ клиенту — купон −20% (`CAR_WASH_COUPON_DISCOUNT_PERCENT`) на 72 часа (`CAR_WASH_COUPON_TTL_MS`), код из 12 латинских букв `XXXX-XXXX-XXXX` (`crypto.randomInt`). `issueCarWashCoupon(orderId)` вызывается рядом с `applyPartnerOrderBonus` во всех трёх местах доставки (`OrderController`, `CourierController`, `CourierAggregatorController`); один купон на заказ (уникальный индекс `CarWashCoupon.order`); не выдаётся, пока нет ни одной активной мойки; никогда не бросает.
- Купонов может быть несколько, скидки не складываются: одна мойка = один код. Статусы `active`/`used`; «истёк» = `active` с `expiresAt` в прошлом (без cron).
- Погашение: сотрудник мойки вводит код в кабинете → `POST /redeemCarWashCoupon {code}` → купон сразу гасится атомарным `findOneAndUpdate` (без подтверждения клиентом). Ошибки с `code`: `INVALID_CODE` 400, `NOT_FOUND` 404, `USED` 409, `EXPIRED` 410. Не больше 10 неверных кодов за 15 мин на сотрудника (`utils/attemptLimiter.js`, в памяти процесса), 5 неверных входов за 15 мин на телефон. После успешного погашения в Telegram-группу уходит сообщение с мойкой, сотрудником и клиентом (`telegram/sendCarWashRedemption.js`, env `TELEGRAM_BOT_TOKEN_SUPPORT` + `TELEGRAM_CAR_WASH_CHAT_ID`); отправка не задерживает ответ, ошибки только в лог.
- Статистика: `POST /trackCarWashCouponEvent {event: "buttonClick" | "screenView"}` (клиент из токена) → `CarWashCouponEngagement` (одна запись на клиента, `$inc` счётчиков). `/getCarWashCouponStatsAdmin` → `{ clickedClients, screenViews }` за всё время: число клиентов, нажавших кнопку, — на главной суперадмина рядом с «Автомойки», всего просмотров экрана с кодом — на `/superAdminCarWashes`.
- Модели: `CarWash` (точка: название, адрес, город, телефон, `mapUrl` — ссылка 2ГИС, только домены 2ГИС через `utils/twoGisUrl.js`; в приложении адрес открывает её; `active`/`blocked`), `CarWashUser` (сотрудник точки, логин — `phoneNormalized`, bcrypt-пароль с `select: false`), `CarWashCoupon` (снимки `carWashName`, `usedByName` на момент погашения). Мойки и сотрудники не удаляются, а блокируются.
- Кабинет мойки — в CRM: `/carWashLogin` → `/carWash` (`client/src/Pages/CarWash/*`, свой axios `client/src/carWashApi.js`, токен `carWashToken` в localStorage). Только ввод кода и последние 50 погашений точки. Токен подписан ключом, производным от `SecretKey` (`utils/carWashToken.js`), не проходит `checkAuth` и наоборот; middleware `utils/checkAuthCarWash.js` (401 — нет сессии, 403 — сотрудник или мойка заблокированы).
- Эндпоинты кабинета: `/carWashLogin {phone, password}`, `/getCarWashMe`, `/redeemCarWashCoupon`, `/getCarWashRedemptions` (`checkAuthCarWash`).
- Клиентское приложение: `/getCarWashCouponsMobile` (`checkAuth` + `checkRole(["client"])`, клиент из токена) → `{ coupons: действующие, carWashes: активные }`.
- CRM, суперадмин → «Автомойки» (`/superAdminCarWashes`): мойки, сотрудники (создание, пароль, блокировка), история погашений с фильтром по мойке и периоду. Эндпоинты `/getCarWashesAdmin`, `/saveCarWashAdmin`, `/setCarWashStatusAdmin`, `/saveCarWashUserAdmin`, `/setCarWashUserStatusAdmin`, `/getCarWashCouponsAdmin` (`requireSuperAdmin`).
- Тесты: `npm run test:partner` (`utils/__tests__/carWashCoupon.test.js`, `Controllers/__tests__/carWashController.test.js`).

## Партнёры по доставке (`DeliveryPartnerController`, `DeliveryPartnerAdminController`)

- Не путать с `Partner` (реферальные партнёры). Партнёр по доставке — компания, чьи курьеры-агрегаторы возят заказы; видит в кабинете CRM только заказы своих курьеров.
- Модель `DeliveryPartner` (название, телефон-логин `phoneNormalized`, bcrypt-пароль `select: false`, `active`/`blocked`). Не удаляется, а блокируется. Курьер: `CourierAggregator.deliveryPartner` (не больше одного партнёра) и `deliveryPartnerLinkedAt`.
- Партнёр видит все заказы своих курьеров за всё время, в т.ч. до привязки (`deliveryPartnerLinkedAt` только для CRM). Отвязанный курьер пропадает из кабинета вместе с заказами. Заказы, с которых курьера сняли (`courierAggregator = null`), партнёр не видит.
- Данные клиента партнёру не отдаются: только дата/время, статус, курьер, `address.actual`, бутыли, сумма, время доставки (`utils/deliveryPartnerOrders.js#toPartnerOrder`, projection `PARTNER_ORDER_FIELDS`).
- Кабинет: `/deliveryPartnerLogin` → `/deliveryPartner` (`client/src/Pages/DeliveryPartner/*`, свой axios `client/src/deliveryPartnerApi.js`, токен `deliveryPartnerToken` в localStorage). Вкладки «В работе» (`awaitingOrder`/`onTheWay`, обновление раз в минуту) и «История» (все заказы, период — необязательный фильтр, итоги по доставленным, фильтр по курьеру, «Скачать Excel» — до 5000 строк).
- Токен подписан ключом, производным от `SecretKey` (`utils/deliveryPartnerToken.js`), не проходит `checkAuth`/`checkAuthAggregator`/`checkAuthCarWash` и наоборот; middleware `utils/checkAuthDeliveryPartner.js` (401 — нет сессии, 403 — заблокирован). Вход: 5 неверных попыток за 15 мин на телефон.
- Эндпоинты кабинета: `/deliveryPartnerLogin {phone, password}`, `/getDeliveryPartnerMe` (профиль + курьеры), `/getDeliveryPartnerOrders {scope: active|history, startDate?, endDate?, courierId?, page?, export?}`.
- CRM, суперадмин → «Партнёры по доставке» (`/superAdminDeliveryPartners`): `/getDeliveryPartnersAdmin`, `/saveDeliveryPartnerAdmin`, `/setDeliveryPartnerStatusAdmin`, `/searchCouriersForDeliveryPartnerAdmin {query}`, `/setCourierDeliveryPartnerAdmin {courierId, deliveryPartnerId|null}` (`requireSuperAdmin`). `/updateCourierAggregatorData` поля `deliveryPartner*` менять не даёт.
- Индексы: `Order { courierAggregator: 1, "date.d": -1 }`, `CourierAggregator { deliveryPartner: 1 }`.
- Тесты: `npm run test:partner` (`Controllers/__tests__/deliveryPartnerController.test.js`).
