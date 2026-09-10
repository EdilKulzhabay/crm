// OpenAPI 3.0 спецификация для внешнего партнёрского API (/ads/*), отдаваемого
// рекламному агентству. Отображается через swagger-ui-express на GET /ads/docs.
// См. Controllers/AdsAnalyticsController.js и utils/checkAdsApiKey.js.

const dateRangeParams = [
    {
        name: "startDate",
        in: "query",
        required: false,
        description: "Начало периода (YYYY-MM-DD). По умолчанию — 30 дней назад.",
        schema: { type: "string", format: "date", example: "2026-08-01" },
    },
    {
        name: "endDate",
        in: "query",
        required: false,
        description: "Конец периода (YYYY-MM-DD). По умолчанию — сегодня.",
        schema: { type: "string", format: "date", example: "2026-08-31" },
    },
    {
        name: "page",
        in: "query",
        required: false,
        description: "Номер страницы (с 1).",
        schema: { type: "integer", minimum: 1, default: 1 },
    },
    {
        name: "limit",
        in: "query",
        required: false,
        description: "Размер страницы, максимум 2000.",
        schema: { type: "integer", minimum: 1, maximum: 2000, default: 500 },
    },
];

const errorResponses = {
    400: {
        description: "Некорректный формат даты",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                    success: false,
                    message: "Некорректный формат даты. Используйте YYYY-MM-DD в startDate/endDate",
                },
            },
        },
    },
    401: {
        description: "Отсутствует или неверный x-api-key",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: { success: false, message: "Нет доступа" },
            },
        },
    },
    500: {
        description: "Внутренняя ошибка сервера",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: { success: false, message: "Что-то пошло не так" },
            },
        },
    },
};

const adsApiSpec = {
    openapi: "3.0.3",
    info: {
        title: "Tibetskaya — Ads Partner API",
        version: "1.0.0",
        description:
            "Отчётность для рекламного агентства: регистрации, заказы и повторные заказы " +
            "с фильтрацией по датам. Каждая запись содержит userId для сопоставления с " +
            "установками/кликами на стороне агентства (Adjust/AppsFlyer/Meta). Установки " +
            "в этот API не входят — они берутся из SDK-аналитики агентства.",
    },
    servers: [
        { url: "https://api.tibetskayacrm.kz", description: "Production" },
        { url: "http://localhost:4444", description: "Local" },
    ],
    security: [{ ApiKeyAuth: [] }],
    tags: [{ name: "Ads", description: "Партнёрская отчётность для рекламного агентства" }],
    paths: {
        "/ads/registrations": {
            get: {
                tags: ["Ads"],
                summary: "Регистрации",
                description: "Дата регистрации и userId каждого зарегистрированного клиента за период.",
                parameters: dateRangeParams,
                responses: {
                    200: {
                        description: "OK",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/RegistrationsResponse" },
                                example: {
                                    success: true,
                                    count: 2,
                                    page: 1,
                                    limit: 500,
                                    registrations: [
                                        { userId: "66f15c557a27c92d447a16a0", date: "2026-08-05T09:12:00.000Z" },
                                        { userId: "66f15c557a27c92d447a16a1", date: "2026-08-06T14:03:00.000Z" },
                                    ],
                                },
                            },
                        },
                    },
                    ...errorResponses,
                },
            },
        },
        "/ads/orders": {
            get: {
                tags: ["Ads"],
                summary: "Заказы",
                description: "Дата, сумма и userId каждого заказа за период (кто заказал).",
                parameters: dateRangeParams,
                responses: {
                    200: {
                        description: "OK",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/OrdersResponse" },
                                example: {
                                    success: true,
                                    count: 2,
                                    totalSum: 8500,
                                    page: 1,
                                    limit: 500,
                                    orders: [
                                        {
                                            orderId: "66f2a1557a27c92d447a1700",
                                            userId: "66f15c557a27c92d447a16a0",
                                            date: "2026-08-10T11:20:00.000Z",
                                            sum: 4500,
                                            status: "delivered",
                                        },
                                        {
                                            orderId: "66f2a1557a27c92d447a1701",
                                            userId: "66f15c557a27c92d447a16a0",
                                            date: "2026-08-20T08:05:00.000Z",
                                            sum: 4000,
                                            status: "delivered",
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    ...errorResponses,
                },
            },
        },
        "/ads/repeat-orders": {
            get: {
                tags: ["Ads"],
                summary: "Повторные заказы",
                description:
                    "Клиенты с более чем одним заказом за период; у каждого вложенного заказа " +
                    "сохраняется собственный userId (не просто агрегат).",
                parameters: dateRangeParams,
                responses: {
                    200: {
                        description: "OK",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/RepeatOrdersResponse" },
                                example: {
                                    success: true,
                                    count: 1,
                                    page: 1,
                                    limit: 500,
                                    repeatCustomers: [
                                        {
                                            userId: "66f15c557a27c92d447a16a0",
                                            ordersCount: 2,
                                            repeatOrdersCount: 1,
                                            totalSum: 8500,
                                            firstOrderDate: "2026-08-10T11:20:00.000Z",
                                            lastOrderDate: "2026-08-20T08:05:00.000Z",
                                            orders: [
                                                {
                                                    orderId: "66f2a1557a27c92d447a1700",
                                                    date: "2026-08-10T11:20:00.000Z",
                                                    sum: 4500,
                                                    status: "delivered",
                                                },
                                                {
                                                    orderId: "66f2a1557a27c92d447a1701",
                                                    date: "2026-08-20T08:05:00.000Z",
                                                    sum: 4000,
                                                    status: "delivered",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    ...errorResponses,
                },
            },
        },
    },
    components: {
        securitySchemes: {
            ApiKeyAuth: {
                type: "apiKey",
                in: "header",
                name: "x-api-key",
                description: "Ключ, выданный рекламному агентству.",
            },
        },
        schemas: {
            ErrorResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean", example: false },
                    message: { type: "string" },
                },
            },
            RegistrationsResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    count: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    registrations: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                userId: { type: "string" },
                                date: { type: "string", format: "date-time" },
                            },
                        },
                    },
                },
            },
            OrdersResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    count: { type: "integer" },
                    totalSum: { type: "number" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    orders: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                orderId: { type: "string" },
                                userId: { type: "string" },
                                date: { type: "string", format: "date-time" },
                                sum: { type: "number" },
                                status: { type: "string" },
                            },
                        },
                    },
                },
            },
            RepeatOrdersResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    count: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    repeatCustomers: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                userId: { type: "string" },
                                ordersCount: { type: "integer" },
                                repeatOrdersCount: { type: "integer" },
                                totalSum: { type: "number" },
                                firstOrderDate: { type: "string", format: "date-time" },
                                lastOrderDate: { type: "string", format: "date-time" },
                                orders: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            orderId: { type: "string" },
                                            date: { type: "string", format: "date-time" },
                                            sum: { type: "number" },
                                            status: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};

export default adsApiSpec;
