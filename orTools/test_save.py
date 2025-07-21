import json
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import math
from datetime import datetime, timedelta
import sys

input_data = json.load(sys.stdin)
common_depot = input_data["common_depot"]
couriers_data = input_data["couriers"]
orders_data = input_data["orders"]
courier_restrictions = input_data["courier_restrictions"]

# Ваши данные о курьерах и заказах (остаются прежними)
# couriers_data = [
#     {
#         'id': 'courier_1',
#         'lat': 43.282268, 'lon': 76.921119,
#         'capacity_12': 0,
#         'capacity_19': 30,
#         'order': None,  # Активного заказа нет
#     },
#     {
#         'id': 'courier_2',
#         'lat': 43.24,
#         'lon': 76.91,
#         'capacity_12': 10,
#         'capacity_19': 30,
#         'order': None,  # Активного заказа нет
#     },
#     {
#         'id': 'courier_3',
#         'lat': 43.168277314921774,
#         'lon': 76.89654142009347,
#         'capacity_12': 0,
#         'capacity_19': 40,
#         'order': {'id': 'active_order_3', 'lat': 43.170000, 'lon': 76.898000, 'bottles_12': 0, 'bottles_19': 5},  # Пример активного заказа
#     },
#     {
#         'id': 'courier_4',
#         'lat': 43.16,
#         'lon': 76.87,
#         'capacity_12': 6,
#         'capacity_19': 10,
#         'order': None,  # Активного заказа нет
#     }
# ]

# orders_data = [
#     {'id': 'order_1', 'lat': 43.292268, 'lon': 76.931119, 'bottles_12': 5, 'bottles_19': 0, 'status': "awaitingOrder", 'priority': 1, 'isUrgent': False},
#     {'id': 'order_2', 'lat': 43.261362, 'lon': 76.929122, 'bottles_12': 3, 'bottles_19': 0, 'status': "awaitingOrder", 'priority': 2, 'isUrgent': False},
#     {'id': 'order_3', 'lat': 43.151319, 'lon': 76.901267, 'bottles_12': 0, 'bottles_19': 3, 'status': "awaitingOrder", 'date.time': "11:00 - 13:00", 'priority': 1, 'isUrgent': True},
#     {'id': 'order_4', 'lat': 43.228644, 'lon': 76.866358, 'bottles_12': 0, 'bottles_19': 3, 'status': "awaitingOrder", 'date.time': "10:30 - 10:40", 'priority': 1, 'isUrgent': True},
#     {'id': 'order_5', 'lat': 43.187654, 'lon': 76.898765, 'bottles_12': 0, 'bottles_19': 2, 'status': "awaitingOrder", 'priority': 2, 'isUrgent': False},
#     {'id': 'order_6', 'lat': 43.254082, 'lon': 76.918261, 'bottles_12': 0, 'bottles_19': 5, 'status': "awaitingOrder", 'date.time': "16:30 - 18:00", 'priority': 1, 'isUrgent': False},
#     {'id': 'order_7', 'lat': 43.198765, 'lon': 76.923456, 'bottles_12': 0, 'bottles_19': 4, 'status': "awaitingOrder", 'priority': 2, 'isUrgent': False},
#     {'id': 'order_8', 'lat': 43.237369, 'lon': 76.938627, 'bottles_12': 0, 'bottles_19': 6, 'status': "awaitingOrder", 'priority': 1, 'isUrgent': True},
#     {'id': 'order_9', 'lat': 43.252214, 'lon': 76.90054, 'bottles_12': 0, 'bottles_19': 2, 'status': "awaitingOrder", 'priority': 3, 'isUrgent': False},
#     {'id': 'order_10', 'lat': 43.187654, 'lon': 76.912345, 'bottles_12': 0, 'bottles_19': 2, 'status': "awaitingOrder", 'priority': 2, 'isUrgent': False},
#     {'id': 'order_11', 'lat': 43.194514, 'lon': 76.896529, 'bottles_12': 4, 'bottles_19': 0, 'status': "awaitingOrder", 'priority': 3, 'isUrgent': False},
#     {'id': 'order_12', 'lat': 43.168765, 'lon': 76.873977, 'bottles_12': 0, 'bottles_19': 2, 'status': "awaitingOrder", 'priority': 2, 'isUrgent': False},
#     {'id': 'order_13', 'lat': 43.175432, 'lon': 76.923456, 'bottles_12': 0, 'bottles_19': 4, 'status': "awaitingOrder", 'priority': 1, 'isUrgent': False},
#     {'id': 'order_14', 'lat': 43.234567, 'lon': 76.912345, 'bottles_12': 4, 'bottles_19': 0, 'status': "awaitingOrder", 'priority': 3, 'isUrgent': False},
#     {'id': 'order_15', 'lat': 43.212045, 'lon': 76.872848, 'bottles_12': 0, 'bottles_19': 15, 'status': "awaitingOrder", 'priority': 3, 'isUrgent': False},
#     {'id': 'order_16', 'lat': 43.223456, 'lon': 76.934567, 'bottles_12': 0, 'bottles_19': 10, 'status': "awaitingOrder", 'priority': 2, 'isUrgent': False},
#     {'id': 'order_17', 'lat': 43.264191, 'lon': 76.932518, 'bottles_12': 0, 'bottles_19': 20, 'status': "awaitingOrder", 'date.time': "16:30 - 17:40", 'priority': 1, 'isUrgent': False},
#     {'id': 'order_18', 'lat': 43.245678, 'lon': 76.887654, 'bottles_12': 0, 'bottles_19': 3, 'status': "awaitingOrder", 'priority': 3, 'isUrgent': False},
#     {'id': 'order_19', 'lat': 43.212345, 'lon': 76.945678, 'bottles_12': 0, 'bottles_19': 4, 'status': "awaitingOrder", 'priority': 2, 'isUrgent': False},
#     {'id': 'order_20', 'lat': 43.242453, 'lon': 76.9409, 'bottles_12': 0, 'bottles_19': 2, 'status': "awaitingOrder", 'priority': 1, 'isUrgent': False},
#     {'id': 'order_21', 'lat': 43.234567, 'lon': 76.923456, 'bottles_12': 0, 'bottles_19': 2, 'status': "awaitingOrder", 'priority': 2, 'isUrgent': False},
#     {'id': 'order_22', 'lat': 43.198765, 'lon': 76.934567, 'bottles_12': 10, 'bottles_19': 0, 'status': "awaitingOrder", 'priority': 1, 'isUrgent': False}
# ]

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Вычисляет расстояние между двумя точками по координатам (в метрах).
    Использует формулу гаверсинусов.
    """
    R = 6371000  # Радиус Земли в метрах
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad

    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance = R * c
    return distance

# Изменяем скорость курьеров на 60 км/ч
speed_mps = 60 * 1000 / 3600  # Скорость в метрах в секунду (60 км/ч)

def create_time_matrix(locations, speed_mps=speed_mps):
    """Создает матрицу времени в пути между всеми локациями (в секундах)."""
    num_locations = len(locations)
    time_matrix = [[0] * num_locations for _ in range(num_locations)]
    for i in range(num_locations):
        for j in range(num_locations):
            if i != j:
                distance = haversine_distance(
                    locations[i]['lat'], locations[i]['lon'],
                    locations[j]['lat'], locations[j]['lon']
                )
                # Время = Расстояние / Скорость
                time_matrix[i][j] = int(distance / speed_mps)
    return time_matrix

def solve_vrp_no_depot_time(couriers, orders):
    """Решает задачу VRP без возвращения в депо, с учетом активных заказов и временных окон."""

    # Определяем текущее время в Алматы динамически
    # now = datetime.now()  # Используем актуальное текущее время
    now = datetime(2025, 7, 21, 10, 30, 0)
    print(now, file=sys.stderr)
    current_time_in_seconds = now.hour * 3600 + now.minute * 60 + now.second

    print(f"Текущее время: {now.strftime('%H:%M:%S')} ({current_time_in_seconds} секунд)", file=sys.stderr)

    # Фильтруем заказы: убираем те, которые уже нельзя выполнить по времени
    valid_orders = []
    for order in orders:
        if 'date.time' in order:
            time_window_str = order['date.time'].split(' - ')
            end_time_str = time_window_str[1]
            h, m = map(int, end_time_str.split(':'))
            end_time_seconds = h * 3600 + m * 60
            
            # Если временное окно уже закрылось, пропускаем заказ
            if end_time_seconds < current_time_in_seconds:
                print(f"Заказ {order['id']} пропущен - временное окно закрыто", file=sys.stderr)
                continue
        
        valid_orders.append(order)

    orders = valid_orders
    print(f"Количество валидных заказов: {len(orders)}", file=sys.stderr)

    if not orders:
        print("Нет заказов для обработки", file=sys.stderr)
        return []

    # Проверяем возможность выполнения заказов по вместимости
    total_bottles_12 = sum(order.get('bottles_12', 0) for order in orders)
    total_bottles_19 = sum(order.get('bottles_19', 0) for order in orders)
    total_capacity_12 = sum(courier['capacity_12'] for courier in couriers)
    total_capacity_19 = sum(courier['capacity_19'] for courier in couriers)

    print(f"Требуется бутылей: 12л - {total_bottles_12}, 19л - {total_bottles_19}", file=sys.stderr)
    print(f"Доступная вместимость: 12л - {total_capacity_12}, 19л - {total_capacity_19}", file=sys.stderr)

    all_locations = []  
    start_nodes = []  
    order_location_indices = [] 

    # 1. Добавляем начальные точки курьеров
    for i, courier in enumerate(couriers):
        if courier['order']:
            # Если есть активный заказ, начальная точка - это место активного заказа
            active_order_data = {
                'id': f'active_order_{courier["id"]}',
                'lat': courier['order']['lat'],
                'lon': courier['order']['lon'],
                'bottles_12': courier['order'].get('bottles_12', 0),
                'bottles_19': courier['order'].get('bottles_19', 0),
                'is_active_order': True,
                'courier_id': courier['id']
            }
            all_locations.append(active_order_data)
            start_nodes.append(len(all_locations) - 1)
        else:
            # Если активного заказа нет, начальная точка - текущее местоположение курьера
            all_locations.append({
                'id': f'courier_{courier["id"]}_start',
                'lat': courier['lat'],
                'lon': courier['lon'],
                'bottles_12': 0,
                'bottles_19': 0,
                'is_courier_start': True,
                'courier_id': courier['id']
            })
            start_nodes.append(len(all_locations) - 1)

    # 2. Добавляем точки новых заказов
    for order in orders:
        all_locations.append(order)
        order_location_indices.append(len(all_locations) - 1)

    num_locations = len(all_locations)
    num_vehicles = len(couriers)

    print(f"Общее количество локаций: {num_locations}", file=sys.stderr)
    print(f"Количество курьеров: {num_vehicles}", file=sys.stderr)

    # 3. Создаем матрицу времени в пути
    time_matrix = create_time_matrix(all_locations, speed_mps=speed_mps)

    # 4. ИСПРАВЛЕНО: Используем депо-модель с фиктивным депо
    # Добавляем фиктивное депо в конец
    depot_location = {'id': 'depot', 'lat': all_locations[0]['lat'], 'lon': all_locations[0]['lon'], 'bottles_12': 0, 'bottles_19': 0}
    all_locations.append(depot_location)
    depot_index = len(all_locations) - 1
    
    # Расширяем матрицу времени для депо
    for i in range(len(time_matrix)):
        time_matrix[i].append(0)  # Время до депо = 0
    time_matrix.append([0] * (len(all_locations)))  # Время от депо = 0
    
    manager = pywrapcp.RoutingIndexManager(len(all_locations), num_vehicles, depot_index)
    routing = pywrapcp.RoutingModel(manager)

    # --- Обратные вызовы для измерений ---

    def demand_12_callback(from_index):
        node = manager.IndexToNode(from_index)
        if node == depot_index:
            return 0
        return all_locations[node].get('bottles_12', 0)

    demand_12_callback_index = routing.RegisterUnaryTransitCallback(demand_12_callback)

    def demand_19_callback(from_index):
        node = manager.IndexToNode(from_index)
        if node == depot_index:
            return 0
        return all_locations[node].get('bottles_19', 0)

    demand_19_callback_index = routing.RegisterUnaryTransitCallback(demand_19_callback)

    service_time_per_order = 15 * 60  # 15 минут обслуживания

    def total_time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        
        if from_node == depot_index or to_node == depot_index:
            return 0
            
        travel_time = time_matrix[from_node][to_node]

        # Добавляем время обслуживания для заказов
        if (to_node < len(all_locations) - 1 and  # Не депо
            not all_locations[to_node].get('is_courier_start', False) and
            not all_locations[to_node].get('is_active_order', False)):
            travel_time += service_time_per_order
        return int(travel_time)

    total_time_transit_callback_index = routing.RegisterTransitCallback(total_time_callback)

    # --- Добавляем измерения ---

    # 1. Измерение для вместимости 12л
    routing.AddDimensionWithVehicleCapacity(
        demand_12_callback_index,
        0,  # slack_max
        [courier['capacity_12'] for courier in couriers],  # vehicle_capacities
        True,  # start_cumul_to_zero
        'Capacity_12'
    )

    # 2. Измерение для вместимости 19л
    routing.AddDimensionWithVehicleCapacity(
        demand_19_callback_index,
        0,  # slack_max
        [courier['capacity_19'] for courier in couriers],  # vehicle_capacities
        True,  # start_cumul_to_zero
        'Capacity_19'
    )

    # 3. Измерение для времени
    routing.AddDimension(
        total_time_transit_callback_index,
        7200,  # slack_max (2 часа)
        86400,  # максимальное время маршрута (24 часа)
        False,  # start_cumul_to_zero - НЕ устанавливаем в ноль
        'Time'
    )
    time_dimension = routing.GetDimensionOrDie('Time')

    # Устанавливаем начальное время для всех курьеров равным текущему времени
    for i in range(num_vehicles):
        start_index = routing.Start(i)
        time_dimension.CumulVar(start_index).SetRange(current_time_in_seconds, current_time_in_seconds)
        print(f"Курьер {i} ({couriers[i]['id']}): начальное время = {current_time_in_seconds} сек ({current_time_in_seconds//3600:02d}:{(current_time_in_seconds%3600)//60:02d})", file=sys.stderr)

    # --- Временные окна для заказов ---
    for order in orders:
        if 'date.time' in order:
            order_node_index = None
            for j, loc in enumerate(all_locations[:-1]):  # Исключаем депо
                if 'id' in loc and loc['id'] == order['id']:
                    order_node_index = j
                    break

            if order_node_index is not None:
                order_index = manager.NodeToIndex(order_node_index)
                time_window_str = order['date.time'].split(' - ')
                start_time_str = time_window_str[0]
                end_time_str = time_window_str[1]

                start_h, start_m = map(int, start_time_str.split(':'))
                end_h, end_m = map(int, end_time_str.split(':'))
                
                start_time_seconds = start_h * 3600 + start_m * 60
                end_time_seconds = end_h * 3600 + end_m * 60

                # Убедимся, что временное окно не в прошлом
                start_time_seconds = max(start_time_seconds, current_time_in_seconds)
                
                print(f"Временное окно для {order['id']}: {start_time_seconds} - {end_time_seconds} сек", file=sys.stderr)
                time_dimension.CumulVar(order_index).SetRange(int(start_time_seconds), int(end_time_seconds))

    # --- Принуждение к использованию правильных стартовых точек ---
    for i, courier in enumerate(couriers):
        start_index = routing.Start(i)
        correct_start_node = start_nodes[i]
        correct_start_model_index = manager.NodeToIndex(correct_start_node)
        
        # Принуждаем первый шаг быть к правильной стартовой точке
        routing.NextVar(start_index).SetValues([correct_start_model_index])

    # Добавляем штрафы за неназначенные заказы
    for node_idx in order_location_indices:
        order_id = all_locations[node_idx]['id']
        order_data = next((ord for ord in orders if ord['id'] == order_id), None)
        
        if order_data:
            # Более разумные штрафы
            penalty = 100000 if order_data.get('isUrgent', False) else 50000
            routing.AddDisjunction([manager.NodeToIndex(node_idx)], penalty)

    # --- Параметры поиска и решение ---

    routing.SetArcCostEvaluatorOfAllVehicles(total_time_transit_callback_index)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH)
    search_parameters.time_limit.FromSeconds(60)  # Увеличиваем время поиска

    # Решаем задачу
    solution = routing.SolveWithParameters(search_parameters)

    # --- Обработка результатов ---
    if solution:
        print("Решение найдено!", file=sys.stderr)
        assigned_orders = []
        visited_nodes_in_solution = set()
        routes = []  # Добавляем список маршрутов для визуализации

        for vehicle_id in range(num_vehicles):
            index = routing.Start(vehicle_id)
            plan_output = f'Маршрут для курьера {couriers[vehicle_id]["id"]}:\n'
            route_distance = 0
            route_orders = []  # Список заказов для этого курьера

            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                if node_index == depot_index:
                    index = solution.Value(routing.NextVar(index))
                    continue
                    
                route_load_12 = solution.Value(routing.GetDimensionOrDie('Capacity_12').CumulVar(index))
                route_load_19 = solution.Value(routing.GetDimensionOrDie('Capacity_19').CumulVar(index))
                route_time = solution.Value(time_dimension.CumulVar(index))

                hours = int(route_time // 3600)
                minutes = int((route_time % 3600) // 60)
                time_str = f"{hours:02d}:{minutes:02d}"

                plan_output += f' -> {all_locations[node_index]["id"]} (12л: {route_load_12}, 19л: {route_load_19}, Время: {time_str})'

                # Если это заказ (не стартовая точка и не активный заказ)
                if (not all_locations[node_index].get('is_courier_start', False) and 
                    not all_locations[node_index].get('is_active_order', False)):
                    
                    order_data = next((ord for ord in orders if ord['id'] == all_locations[node_index]['id']), None)
                    if order_data:
                        assigned_orders.append({
                            'order_id': order_data['id'],
                            'courier_id': couriers[vehicle_id]['id'],
                            'arrival_time_seconds': route_time,
                            'bottles_12': order_data.get('bottles_12', 0),
                            'bottles_19': order_data.get('bottles_19', 0),
                            'isUrgent': order_data.get('isUrgent', False)
                        })
                        visited_nodes_in_solution.add(order_data['id'])
                        route_orders.append(order_data['id'])  # Добавляем заказ в маршрут

                index = solution.Value(routing.NextVar(index))

            print(plan_output, file=sys.stderr)
            
            # Создаем информацию о маршруте для визуализации
            if route_orders:
                route_info = {
                    "courier_id": couriers[vehicle_id]["id"],
                    "orders": route_orders,
                    "orders_count": len(route_orders),
                    "travel_time_minutes": route_time,
                    "travel_time_hours": round(route_time/60, 2),
                    "distance_km": round(route_time/60 * 30, 2),  # Примерное расстояние (30 км/ч)
                    "required_bottles": {
                        "bottles_12": sum(o.get('bottles_12', 0) for o in orders if o['id'] in route_orders),
                        "bottles_19": sum(o.get('bottles_19', 0) for o in orders if o['id'] in route_orders),
                        "total": sum(o.get('bottles_12', 0) + o.get('bottles_19', 0) for o in orders if o['id'] in route_orders)
                    },
                    "courier_bottles": {
                        "bottles_12": couriers[vehicle_id].get("capacity_12", 0),
                        "bottles_19": couriers[vehicle_id].get("capacity_19", 0),
                        "total": couriers[vehicle_id].get("capacity_12", 0) + couriers[vehicle_id].get("capacity_19", 0)
                    },
                    "has_active_order": bool(couriers[vehicle_id].get("order")),
                    "courier_type": "loaded" if (couriers[vehicle_id].get("capacity_12", 0) > 0 or couriers[vehicle_id].get("capacity_19", 0) > 0) else "empty"
                }
                routes.append(route_info)

        # Показываем неназначенные заказы
        all_order_ids = {order['id'] for order in orders}
        unassigned_order_ids = all_order_ids - visited_nodes_in_solution

        if unassigned_order_ids:
            print("\nНеназначенные заказы:", file=sys.stderr)
            for order_id in unassigned_order_ids:
                order = next((ord for ord in orders if ord['id'] == order_id), None)
                urgent_status = " (СРОЧНЫЙ!)" if order and order.get('isUrgent', False) else ""
                print(f"- {order_id}{urgent_status}", file=sys.stderr)

        # Возвращаем данные в формате для визуализации
        visualization_data = {
            "couriers": couriers,
            "orders": orders,
            "routes": routes
        }
        
        return assigned_orders, visualization_data

    else:
        print("Решение не найдено.", file=sys.stderr)
        print("Возможные причины:", file=sys.stderr)
        print("1. Недостаточная вместимость курьеров", file=sys.stderr)
        print("2. Слишком жесткие временные ограничения", file=sys.stderr)
        print("3. Невозможная конфигурация маршрутов", file=sys.stderr)
        return [], {"couriers": couriers, "orders": orders, "routes": []}

# Запускаем решатель
assigned_orders_result, visualization_data = solve_vrp_no_depot_time(couriers_data, orders_data)

# Выводим результат назначения заказов
print("\nНазначенные заказы:", file=sys.stderr)
if assigned_orders_result:
    assigned_orders_result.sort(key=lambda x: (not x['isUrgent'], x['arrival_time_seconds']))
    
    for assignment in assigned_orders_result:
        arrival_seconds = assignment['arrival_time_seconds']
        hours = int(arrival_seconds // 3600)
        minutes = int((arrival_seconds % 3600) // 60)
        arrival_time_readable = f"{hours:02d}:{minutes:02d}"
        
        urgent_marker = " (СРОЧНЫЙ!)" if assignment['isUrgent'] else ""
        
        print(f"Заказ {assignment['order_id']}{urgent_marker} (12л: {assignment['bottles_12']}, 19л: {assignment['bottles_19']}) назначен курьеру {assignment['courier_id']} (Время прибытия: {arrival_time_readable})", file=sys.stderr)
else:
    print("Заказы не были назначены.", file=sys.stderr)

routes_output = []

for vehicle_id in range(len(couriers_data)):
    courier_id = couriers_data[vehicle_id]['id']
    
    # Находим все заказы для этого курьера
    courier_orders = [order for order in assigned_orders_result if order['courier_id'] == courier_id]
    
    if courier_orders:
        # Сортируем заказы по времени прибытия
        courier_orders.sort(key=lambda x: x['arrival_time_seconds'])
        
        # Рассчитываем общее расстояние маршрута
        total_distance_meters = 0
        
        # Начальная точка - текущее местоположение курьера или активный заказ
        if couriers_data[vehicle_id].get('order'):
            current_lat = couriers_data[vehicle_id]['order']['lat']
            current_lon = couriers_data[vehicle_id]['order']['lon']
        else:
            current_lat = couriers_data[vehicle_id]['lat']
            current_lon = couriers_data[vehicle_id]['lon']
        
        # Проходим по всем заказам в маршруте
        for order in courier_orders:
            # Находим координаты заказа
            order_data = next((o for o in orders_data if o['id'] == order['order_id']), None)
            if order_data:
                order_lat = order_data['lat']
                order_lon = order_data['lon']
                
                # Добавляем расстояние от текущей точки до заказа
                distance = haversine_distance(current_lat, current_lon, order_lat, order_lon)
                total_distance_meters += distance
                
                # Обновляем текущую точку
                current_lat = order_lat
                current_lon = order_lon
        
        # Собираем информацию о маршруте
        route_info = {
            "courier_id": courier_id,
            "orders": [order['order_id'] for order in courier_orders],
            "orders_count": len(courier_orders),
            "distance_meters": int(total_distance_meters),
            "distance_km": round(total_distance_meters / 1000, 2),
            "required_bottles": {
                "bottles_12": sum(order['bottles_12'] for order in courier_orders),
                "bottles_19": sum(order['bottles_19'] for order in courier_orders),
                "total": sum(order['bottles_12'] + order['bottles_19'] for order in courier_orders)
            },
            "courier_should_take": {
                "bottles_12": 0,  # Пока оставляем 0, можно добавить логику
                "bottles_19": 0,  # Пока оставляем 0, можно добавить логику
                "total": 0
            },
            "capacity_utilization": {
                "percent": round(sum(order['bottles_12'] + order['bottles_19'] for order in courier_orders) / 
                               (couriers_data[vehicle_id].get('capacity_12', 0) + couriers_data[vehicle_id].get('capacity_19', 0)) * 100, 1) if (couriers_data[vehicle_id].get('capacity_12', 0) + couriers_data[vehicle_id].get('capacity_19', 0)) > 0 else 0
            },
            "has_active_order": bool(couriers_data[vehicle_id].get("order")),
            "courier_type": "loaded" if (couriers_data[vehicle_id].get("capacity_12", 0) > 0 or couriers_data[vehicle_id].get("capacity_19", 0) > 0) else "empty",
            "arrival_times": {order['order_id']: order['arrival_time_seconds'] for order in courier_orders}  # Добавляем время прибытия
        }
        
        routes_output.append(route_info)

print(json.dumps(routes_output))