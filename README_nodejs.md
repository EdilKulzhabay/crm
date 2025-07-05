# Node.js API для VRP (Vehicle Routing Problem)

Этот проект предоставляет Node.js API для вызова Python скриптов решения задачи маршрутизации транспортных средств (VRP) и создания визуализации маршрутов.

## Структура проекта

```
├── vrp_api.js              # Основной Node.js API (ES модули)
├── test_vrp_api.js         # Тестовый файл (ES модули)
├── vrp_solver_api.py       # Python скрипт для решения VRP
├── visualize_routes_api.py # Python скрипт для визуализации
├── package.json            # Конфигурация Node.js (type: "module")
└── requirements.txt        # Python зависимости
```

## Установка

### 1. Python зависимости

```bash
# Создание виртуального окружения
python3 -m venv venv
source venv/bin/activate  # На Windows: venv\Scripts\activate

# Установка зависимостей
pip install -r requirements.txt
```

### 2. Node.js зависимости

```bash
npm install
```

## Использование

### Импорт в Node.js (ES модули)

```javascript
import { solveVRP, visualizeRoutes, solveAndVisualize } from './vrp_api.js';
```

### Функции API

#### 1. `solveVRP(couriers, orders, courierRestrictions, commonDepot)`

Решает задачу VRP и возвращает оптимальные маршруты.

**Параметры:**
- `couriers` - массив курьеров с координатами
- `orders` - массив заказов с координатами  
- `courierRestrictions` - ограничения на курьеров (опционально)
- `commonDepot` - общий депо для возврата (опционально)

**Пример:**
```javascript
const couriers = [
    {"id": "courier1", "lat": 43.207262, "lon": 76.893349},
    {"id": "courier2", "lat": 43.22000, "lon": 76.85000}
];

const orders = [
    {"id": "order1", "lat": 43.212409, "lon": 76.842149},
    {"id": "order2", "lat": 43.249392, "lon": 76.887507}
];

const restrictions = {
    "order1": [1, 2],  // только courier2 и courier3
    "order2": [1]      // только courier2
};

const result = await solveVRP(couriers, orders, restrictions);
console.log(result);
```

#### 2. `visualizeRoutes(couriers, orders, routes, commonDepot)`

Создает визуализацию маршрутов на карте.

**Параметры:**
- `couriers` - массив курьеров
- `orders` - массив заказов
- `routes` - результат решения VRP
- `commonDepot` - общий депо (опционально)

**Пример:**
```javascript
const vizResult = await visualizeRoutes(couriers, orders, routes);
console.log(vizResult.image_path); // Путь к созданному изображению
```

#### 3. `solveAndVisualize(couriers, orders, courierRestrictions, commonDepot)`

Выполняет полный цикл: решение VRP + создание визуализации.

**Пример:**
```javascript
const fullResult = await solveAndVisualize(couriers, orders, restrictions);
console.log(fullResult.vrp_result);    // Результат VRP
console.log(fullResult.visualization); // Результат визуализации
```

## Формат данных

### Курьеры
```javascript
[
    {
        "id": "courier1",
        "lat": 43.207262,
        "lon": 76.893349
    }
]
```

### Заказы
```javascript
[
    {
        "id": "order1", 
        "lat": 43.212409,
        "lon": 76.842149
    }
]
```

### Ограничения курьеров
```javascript
{
    "order1": [1, 2],  // order1 могут обслужить только courier2 и courier3
    "order2": [1],     // order2 может обслужить только courier2
    "order3": []       // order3 никто не может обслужить
}
```

**Примечание:** Индексы курьеров начинаются с 1 (1-based).

### Общий депо
```javascript
{
    "id": "depot",
    "lat": 43.16857,
    "lon": 76.89642
}
```

## Результат VRP

```javascript
{
    "routes": [
        {
            "courier_id": "courier1",
            "orders": ["order1", "order3"],
            "orders_count": 2,
            "distance_meters": 5420,
            "distance_km": 5.42
        }
    ],
    "total_distance_km": 15.67,
    "total_distance_meters": 15670,
    "total_orders_served": 8,
    "couriers_used": 3,
    "total_couriers": 3
}
```

## Результат визуализации

```javascript
{
    "success": true,
    "image_path": "vrp_routes_visualization.png",
    "total_distance_km": 15.67,
    "total_orders_served": 8,
    "total_orders": 10,
    "couriers_used": 3
}
```

## Тестирование

```bash
# Запуск тестов
node test_vrp_api.js

# Или через npm
npm run test-vrp

# Запуск основного API
npm run vrp-api
```

## Обработка ошибок

Все функции возвращают Promise и могут выбрасывать ошибки:

```javascript
try {
    const result = await solveVRP(couriers, orders);
    console.log('Успех:', result);
} catch (error) {
    console.error('Ошибка:', error.message);
}
```

## Пример полного использования

```javascript
// main.js
import { solveAndVisualize } from './vrp_api.js';

const couriers = [
    {"id": "courier1", "lat": 43.207262, "lon": 76.893349},
    {"id": "courier2", "lat": 43.22000, "lon": 76.85000},
    {"id": "courier3", "lat": 43.28000, "lon": 76.95000}
];

const orders = [
    {"id": "order1", "lat": 43.212409, "lon": 76.842149},
    {"id": "order2", "lat": 43.249392, "lon": 76.887507},
    {"id": "order3", "lat": 43.245447, "lon": 76.903766}
];

const restrictions = {
    "order1": [1, 2],  // только courier2 и courier3
    "order2": [2]      // только courier3
};

try {
    const result = await solveAndVisualize(couriers, orders, restrictions);
    console.log('Маршруты:', result.vrp_result.routes);
    console.log('Изображение:', result.visualization.image_path);
} catch (error) {
    console.error('Ошибка:', error.message);
}
```

## Требования

- **Python 3.7+** с установленными пакетами:
  - ortools
  - matplotlib
  - numpy
- **Node.js 14+** с поддержкой ES модулей

## Особенности ES модулей

- Проект использует `"type": "module"` в package.json
- Все импорты должны включать расширение `.js`
- Используется `import.meta.url` вместо `require.main === module`
- Для получения `__dirname` используется `fileURLToPath(import.meta.url)`

## Примечания

- Временные файлы автоматически удаляются после выполнения
- Визуализация сохраняется в файл `vrp_routes_visualization.png`
- Все расстояния рассчитываются по формуле гаверсинуса
- Поддерживаются ограничения на курьеров для определенных заказов 