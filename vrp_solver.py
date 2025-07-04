from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import math

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

num_couriers = len(couriers)
num_orders = len(orders)
num_locations = len(locations)

print(f"Количество курьеров: {num_couriers}")
print(f"Количество заказов: {num_orders}")
print(f"Общее количество локаций: {num_locations}")
print(f"Общий депо: ({common_depot['lat']}, {common_depot['lon']})")

# Создаем RoutingIndexManager для мультидепо
# Индекс 0 - общий депо
# Индексы 1, 2, 3 - стартовые позиции курьеров
# Все курьеры стартуют со своих позиций и возвращаются в общий депо (индекс 0)
starts = [1, 2, 3]  # Стартовые позиции курьеров
ends = [0, 0, 0]    # Все возвращаются в общий депо

manager = pywrapcp.RoutingIndexManager(num_locations, num_couriers, starts, ends)
routing = pywrapcp.RoutingModel(manager)

print(f"Manager: {manager}")
print(f"Routing: {routing}")

def distance_callback(from_index, to_index):
    from_node = manager.IndexToNode(from_index)
    to_node = manager.IndexToNode(to_index)
    return distance_matrix[from_node][to_node]

transit_callback_index = routing.RegisterTransitCallback(distance_callback)
routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

# Добавляем ограничения для заказов (каждый заказ должен быть посещен)
# Заказы начинаются с индекса 4 (0-депо, 1,2,3-курьеры, 4+ заказы)
for order_idx in range(4, num_locations):
    routing.AddDisjunction([manager.NodeToIndex(order_idx)], 10000)  # штраф за непосещение

# Ограничение: каждый курьер должен обслужить минимум заказов
min_orders_per_courier = max(1, num_orders // num_couriers - 1)
max_orders_per_courier = num_orders // num_couriers + 2

print(f"Минимум заказов на курьера: {min_orders_per_courier}")
print(f"Максимум заказов на курьера: {max_orders_per_courier}")

# Добавляем ограничения на количество заказов для каждого курьера
for vehicle_id in range(num_couriers):
    routing.AddDimension(
        transit_callback_index,
        0,  # no slack
        100000,  # максимальное расстояние
        True,  # start cumul to zero
        f"Distance_{vehicle_id}"
    )
    
    # Ограничение на количество узлов (заказов) для каждого курьера
    count_dimension = "Count"
    routing.AddConstantDimension(
        1,  # каждый узел добавляет 1 к счетчику
        max_orders_per_courier,  # максимум заказов на курьера
        True,  # start cumul to zero
        count_dimension
    )

# Добавляем штраф за использование курьера (чтобы стимулировать использование всех)
for vehicle_id in range(num_couriers):
    routing.SetFixedCostOfVehicle(1000, vehicle_id)  # базовая стоимость использования курьера

# Параметры поиска
search_params = pywrapcp.DefaultRoutingSearchParameters()
search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
search_params.time_limit.seconds = 60

print("Начинаем решение...")
solution = routing.SolveWithParameters(search_params)

if solution:
    print("\nРешение найдено!")
    print(f"Общая стоимость: {solution.ObjectiveValue()} метров")
    print(f"Общая стоимость (без базовых затрат): {solution.ObjectiveValue() - num_couriers * 1000} метров")
    print(f"Общая стоимость: {(solution.ObjectiveValue() - num_couriers * 1000)/1000:.2f} км")
    
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
            
            if node_index == 0:  # Общий депо
                print(f"  -> Возврат в депо: ({common_depot['lat']}, {common_depot['lon']})")
            elif node_index >= 4:  # Это заказ
                order = orders[node_index - 4]  # Заказы начинаются с индекса 4
                route_orders.append(order["id"])
                print(f"  -> Заказ {order['id']}: ({order['lat']}, {order['lon']})")
            
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            
            if not routing.IsEnd(index):
                route_distance += routing.GetArcCostForVehicle(previous_index, index, vehicle_id)
        
        if route_orders:
            print(f"  Количество заказов: {len(route_orders)}")
            print(f"  Расстояние маршрута: {route_distance} метров ({route_distance/1000:.2f} км)")
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
    
    print(f"\nИтоговые результаты:")
    print(f"Общее расстояние: {total_distance} метров ({total_distance/1000:.2f} км)")
    print(f"Используется курьеров: {active_couriers} из {num_couriers}")
    print(f"Всего заказов обслужено: {sum(len(r['orders']) for r in routes)} из {num_orders}")
    
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
    
    print("\nДетальные маршруты:")
    import pprint
    pprint.pprint(routes)
    
else:
    print("Решение не найдено!")
