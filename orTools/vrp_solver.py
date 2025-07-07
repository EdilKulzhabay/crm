from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import math
import sys
import json

# Общая точка возврата для всех курьеров
common_depot = {"id": "depot", "lat": 43.16857, "lon": 76.89642}

# Курьеры в разных районах города 43.207262, 76.893349
couriers = [
    {"id": "courier1", "lat": 43.207262, "lon": 76.893349},  # Центр
    {"id": "courier2", "lat": 43.22000, "lon": 76.85000},  # Запад
    {"id": "courier3", "lat": 43.28000, "lon": 76.95000},  # Север-Восток
]

# Реальные заказы из базы данных на 2025-07-04 (только с валидными координатами)
orders = [
    {"id": "order1", "lat": 43.212409, "lon": 76.842149},
    {"id": "order2", "lat": 43.249392, "lon": 76.887507},
    {"id": "order3", "lat": 43.245447, "lon": 76.903766},
    {"id": "order4", "lat": 43.230026, "lon": 76.94556},
    {"id": "order5", "lat": 43.228736, "lon": 76.839826},
    {"id": "order6", "lat": 43.292268, "lon": 76.931119},
    {"id": "order7", "lat": 43.261362, "lon": 76.929122},
    {"id": "order8", "lat": 43.236701, "lon": 76.845539},
    {"id": "order9", "lat": 43.257476, "lon": 76.905942},
    {"id": "order10", "lat": 43.236031, "lon": 76.837653},
]

courier_restrictions = {}

# Проверяем курьеров
valid_couriers = []
for i, courier in enumerate(couriers):
    if courier.get("lat") is not None and courier.get("lon") is not None:
        valid_couriers.append(courier)
        print(f"✅ Курьер {courier['id']}: ({courier['lat']}, {courier['lon']})")
    else:
        print(f"❌ Курьер {courier['id']}: отсутствуют координаты")

# Проверяем заказы
valid_orders = []
for i, order in enumerate(orders):
    if order.get("lat") is not None and order.get("lon") is not None:
        valid_orders.append(order)
        print(f"✅ Заказ {order['id']}: ({order['lat']}, {order['lon']})")
    else:
        print(f"❌ Заказ {order['id']}: отсутствуют координаты")

# Обновляем списки валидными данными
couriers = valid_couriers
orders = valid_orders

print(f"\nВалидные курьеры: {len(couriers)}")
print(f"Валидные заказы: {len(orders)}")

# Проверяем минимальные требования
if len(couriers) == 0:
    print("❌ ОШИБКА: Нет курьеров с корректными координатами!")
    print("[]", file=sys.stdout)  # Возвращаем пустой результат
    sys.exit(0)

if len(orders) == 0:
    print("❌ ПРЕДУПРЕЖДЕНИЕ: Нет заказов для распределения!")
    print("[]", file=sys.stdout)  # Возвращаем пустой результат
    sys.exit(0)

if len(orders) < len(couriers):
    print(f"❌ ПРЕДУПРЕЖДЕНИЕ: Заказов ({len(orders)}) меньше чем курьеров ({len(couriers)})")
    print("Некоторые курьеры останутся без заказов")

print("✅ Данные корректны, продолжаем оптимизацию...")

print(f"couriers = {couriers}")
print(f"orders = {orders}")

print("Ограничения на курьеров:")
for order_id, allowed_couriers in courier_restrictions.items():
    if not allowed_couriers:
        print(f"  {order_id}: исключен из обслуживания")
    else:
        courier_names = [couriers[i]['id'] for i in allowed_couriers if i < len(couriers)]
        print(f"  {order_id}: только {', '.join(courier_names)}")

# Создаем список локаций: депо + курьеры + заказы
locations = [common_depot] + couriers + orders

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Радиус Земли в км
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat/2) ** 2 +
        math.cos(math.radians(lat1)) *
        math.cos(math.radians(lat2)) *
        math.sin(d_lon/2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# Строим матрицу расстояний
distance_matrix = []
for from_node in locations:
    row = []
    for to_node in locations:
        row.append(int(haversine(from_node["lat"], from_node["lon"], to_node["lat"], to_node["lon"]) * 1000))  # метры
    distance_matrix.append(row)

# print("Матрица расстояний:")
# for row in distance_matrix:
#     print([f"{dist:6d}" for dist in row])

num_couriers = len(couriers)
num_orders = len(orders)
num_locations = len(locations)

print(f"Количество курьеров: {num_couriers}")
print(f"Количество заказов: {num_orders}")
print(f"Общее количество локаций: {num_locations}")
print(f"Общий депо: ({common_depot['lat']}, {common_depot['lon']})")

# Создаем RoutingIndexManager для мультидепо
starts = list(range(1, num_couriers + 1))
ends = [0] * num_couriers

print("starts = ", starts)
print("ends = ", ends)

manager = pywrapcp.RoutingIndexManager(num_locations, num_couriers, starts, ends)
routing = pywrapcp.RoutingModel(manager)

print("manager = ", manager)
print("routing = ", routing)

def distance_callback(from_index, to_index):
    from_node = manager.IndexToNode(from_index)
    to_node = manager.IndexToNode(to_index)
    return distance_matrix[from_node][to_node]

transit_callback_index = routing.RegisterTransitCallback(distance_callback)
routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

print(f"couriers = {couriers}")
print(f"orders = {orders}")

# Добавляем ограничения для заказов
for order_idx in range(num_couriers + 1, num_locations):
    routing.AddDisjunction([manager.NodeToIndex(order_idx)], 10000)

# Применяем ограничения на курьеров
for i, order in enumerate(orders):
    order_node_index = num_couriers + 1 + i
    order_routing_index = manager.NodeToIndex(order_node_index)
    
    if order['id'] in courier_restrictions:
        allowed_couriers = courier_restrictions[order['id']]
        if not allowed_couriers:
            routing.AddDisjunction([order_routing_index], 100000)
        else:
            routing.SetAllowedVehiclesForIndex(allowed_couriers, order_routing_index)

# УЛУЧШЕННАЯ БАЛАНСИРОВКА НАГРУЗКИ
ideal_orders_per_courier = num_orders // num_couriers
remainder = num_orders % num_couriers

# Более строгие ограничения на количество заказов
min_orders_per_courier = ideal_orders_per_courier
max_orders_per_courier = ideal_orders_per_courier + (1 if remainder > 0 else 0)

print(f"\nИдеальное количество заказов на курьера: {ideal_orders_per_courier}")
print(f"Остаток: {remainder}")
print(f"Минимум заказов на курьера: {min_orders_per_courier}")
print(f"Максимум заказов на курьера: {max_orders_per_courier}")

# Добавляем размерность для подсчета заказов
def unit_callback(from_index, to_index):
    from_node = manager.IndexToNode(from_index)
    to_node = manager.IndexToNode(to_index)
    # Увеличиваем счетчик только при посещении заказа (не депо и не курьера)
    if to_node >= num_couriers + 1:  # Это заказ
        return 1
    return 0

unit_callback_index = routing.RegisterTransitCallback(unit_callback)

# Добавляем ограничения для каждого курьера
for vehicle_id in range(num_couriers):
    # Ограничение на расстояние
    routing.AddDimension(
        transit_callback_index,
        0,  # no slack
        50000,  # максимальное расстояние на курьера (50 км)
        True,  # start cumul to zero
        f"Distance_{vehicle_id}"
    )

# Добавляем общую размерность для подсчета заказов
routing.AddDimension(
    unit_callback_index,
    0,  # no slack
    max_orders_per_courier,  # максимум заказов на курьера
    True,  # start cumul to zero
    "OrderCount"
)

# Получаем размерность для установки ограничений
order_count_dimension = routing.GetDimensionOrDie("OrderCount")

# Устанавливаем ограничения на количество заказов для каждого курьера
for vehicle_id in range(num_couriers):
    # Мягкое ограничение на минимальное количество заказов
    order_count_dimension.SetCumulVarSoftLowerBound(
        routing.End(vehicle_id), 
        min_orders_per_courier, 
        10000  # штраф за невыполнение минимума
    )
    
    # Жесткое ограничение на максимальное количество заказов
    order_count_dimension.SetCumulVarSoftUpperBound(
        routing.End(vehicle_id), 
        max_orders_per_courier, 
        10000  # штраф за превышение максимума
    )

# Увеличиваем штраф за использование курьера для стимуляции равномерного распределения
for vehicle_id in range(num_couriers):
    routing.SetFixedCostOfVehicle(5000, vehicle_id)

# УЛУЧШЕННЫЕ ПАРАМЕТРЫ ПОИСКА
search_params = pywrapcp.DefaultRoutingSearchParameters()

# Пробуем разные стратегии начального решения
search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.SAVINGS
# Альтернативы: PARALLEL_CHEAPEST_INSERTION, CHRISTOFIDES, AUTOMATIC

# Более агрессивная локальная оптимизация
search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.SIMULATED_ANNEALING
# Альтернативы: GUIDED_LOCAL_SEARCH, TABU_SEARCH

# Увеличиваем время решения
search_params.time_limit.seconds = 120

# Настройки для лучшего качества решения
search_params.solution_limit = 100
search_params.lns_time_limit.seconds = 30

print("Начинаем решение с улучшенными параметрами...")
solution = routing.SolveWithParameters(search_params)

if solution:
    print("\nОптимизированное решение найдено!")
    print(f"Общая стоимость: {solution.ObjectiveValue()} метров")
    print(f"Общая стоимость (без базовых затрат): {solution.ObjectiveValue() - num_couriers * 5000} метров")
    print(f"Общая стоимость: {(solution.ObjectiveValue() - num_couriers * 5000)/1000:.2f} км")
    
    routes = []
    total_distance = 0
    active_couriers = 0
    
    for vehicle_id in range(num_couriers):
        index = routing.Start(vehicle_id)
        route_distance = 0
        route_orders = []
        
        print(f"\nМаршрут курьера {couriers[vehicle_id]['id']}:")
        print(f"  Старт: ({couriers[vehicle_id]['lat']}, {couriers[vehicle_id]['lon']})")
        
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            
            if node_index == 0:
                print(f"  -> Возврат в депо: ({common_depot['lat']}, {common_depot['lon']})")
            elif node_index >= num_couriers + 1:
                order = orders[node_index - num_couriers - 1]
                route_orders.append(order["id"])
                print(f"  -> Заказ {order['id']}: ({order['lat']}, {order['lon']})")
            
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            
            if not routing.IsEnd(index):
                route_distance += routing.GetArcCostForVehicle(previous_index, index, vehicle_id)
        
        if route_orders:
            print(f"  Количество заказов: {len(route_orders)}")
            print(f"  Расстояние маршрута: {route_distance} метров ({route_distance/1000:.2f} км)")
            print(f"  Отклонение от идеала: {abs(len(route_orders) - ideal_orders_per_courier)} заказов")
            total_distance += route_distance
            active_couriers += 1
            
            routes.append({
                "courier_id": couriers[vehicle_id]["id"],
                "orders": route_orders,
                "orders_count": len(route_orders),
                "distance_meters": route_distance,
                "distance_km": round(route_distance/1000, 2)
            })
        else:
            print(f"  Нет заказов")
    
    # Проверяем балансировку
    orders_counts = [len(route["orders"]) for route in routes]
    max_orders = max(orders_counts) if orders_counts else 0
    min_orders = min(orders_counts) if orders_counts else 0
    balance_score = max_orders - min_orders
    
    print(f"\nОптимизированные результаты:")
    print(f"Общее расстояние: {total_distance} метров ({total_distance/1000:.2f} км)")
    print(f"Используется курьеров: {active_couriers} из {num_couriers}")
    print(f"Всего заказов обслужено: {sum(len(r['orders']) for r in routes)} из {num_orders}")
    print(f"Балансировка нагрузки: {balance_score} (0 = идеальная балансировка)")
    print(f"Распределение заказов: {orders_counts}")
    
    # Проверяем необслуженные заказы
    served_orders = set()
    for route in routes:
        served_orders.update(route["orders"])
    
    unserved_orders = []
    for order in orders:
        if order["id"] not in served_orders:
            unserved_orders.append(order["id"])
    
    if unserved_orders:
        print(f"Необслуженные заказы: {unserved_orders}")

    print(f"routes = {routes}")
    
else:
    print("Оптимизированное решение не найдено! Возвращаемся к базовому алгоритму.")
    # Здесь можно добавить fallback к исходному алгоритму 