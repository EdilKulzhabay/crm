from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import math
import sys
import json
from datetime import datetime, timedelta
import copy

input_data = json.load(sys.stdin)

# Общая точка возврата для всех курьеров
common_depot = {"id": "depot", "lat": 43.16857, "lon": 76.89642}

couriers = input_data["couriers"]
orders = input_data["orders"]
courier_restrictions = input_data["courier_restrictions"]

# Скорость курьеров (60 км/ч)
speed_mps = 25 * 1000 / 3600  # Скорость в метрах в секунду

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

# ПРОВЕРКИ НА КОРРЕКТНОСТЬ ДАННЫХ
print("=== ПРОВЕРКА ВХОДНЫХ ДАННЫХ ===", file=sys.stderr)

# Определяем текущее время в Алматы динамически
now = datetime.now()
current_time_in_seconds = now.hour * 3600 + now.minute * 60 + now.second
print(f"Текущее время: {now.strftime('%H:%M:%S')} ({current_time_in_seconds} секунд)", file=sys.stderr)

# Фильтруем заказы: убираем те, которые уже нельзя выполнить по времени
valid_orders = []
max_wait_time_seconds = 60 * 60  # Максимальное время ожидания: 1 час

for order in orders:
    # Проверяем временные окна
    if 'date.time' in order:
        time_window = order['date.time']
        if time_window:
            try:
                time_parts = time_window.split(' - ')
                start_time_str = time_parts[0].strip()
                end_time_str = time_parts[1].strip()
                
                # Конвертируем в секунды от начала дня
                start_time_seconds = int(start_time_str.split(':')[0]) * 3600 + int(start_time_str.split(':')[1]) * 60
                end_time_seconds = int(end_time_str.split(':')[0]) * 3600 + int(end_time_str.split(':')[1]) * 60
                
                # Если временное окно уже закрылось, пропускаем заказ
                if end_time_seconds < current_time_in_seconds:
                    print(f"Заказ {order['id']} пропущен - временное окно закрыто", file=sys.stderr)
                    continue
                
                # Проверяем, не будет ли заказ ждать слишком долго
                if start_time_seconds > current_time_in_seconds + max_wait_time_seconds:
                    print(f"Заказ {order['id']} пропущен - слишком долгое ожидание (окно: {start_time_str}-{end_time_str})", file=sys.stderr)
                    continue
                    
            except Exception as e:
                print(f"Ошибка парсинга временного окна для {order['id']}: {e}", file=sys.stderr)
                continue
    
    valid_orders.append(order)

orders = valid_orders
print(f"Количество валидных заказов: {len(orders)}", file=sys.stderr)

# ТРЕХЭТАПНОЕ РАСПРЕДЕЛЕНИЕ ЗАКАЗОВ
print("=== ТРЕХЭТАПНОЕ РАСПРЕДЕЛЕНИЕ ЗАКАЗОВ ===", file=sys.stderr)

# 1. Разделяем заказы на активные, срочные и обычные
active_orders_list = []
urgent_orders = []
regular_orders = []

# Сначала обрабатываем активные заказы из структуры курьеров
for courier in couriers:
    if courier.get("order") and courier["order"].get("status") == "onTheWay":
        active_order = courier["order"]
        active_order_data = {
            "id": active_order["orderId"],
            "lat": active_order["lat"],
            "lon": active_order["lon"],
            "bottles_12": active_order.get("bottles_12", 0),
            "bottles_19": active_order.get("bottles_19", 0),
            "status": "onTheWay"
        }
        active_orders_list.append(active_order_data)
        print(f"🚚 АКТИВНЫЙ заказ {active_order['orderId']} добавлен в приоритетную очередь", file=sys.stderr)

# Затем обрабатываем обычные заказы с правильной приоритизацией
for order in orders:
    # Проверяем, является ли заказ активным (уже добавлен выше)
    is_active = any(active_order['id'] == order['id'] for active_order in active_orders_list)
    
    if is_active:
        continue  # Пропускаем, если уже добавлен как активный
    
    # ПРИОРИТЕТ 1: Срочные заказы (isUrgent: true)
    if order.get('isUrgent', False) or order.get('is_urgent', False):
        urgent_orders.append(order)
        print(f"🚨 СРОЧНЫЙ заказ {order['id']} добавлен в приоритетную очередь", file=sys.stderr)
    else:
        regular_orders.append(order)

print(f"Активных заказов: {len(active_orders_list)}, срочных заказов: {len(urgent_orders)}, обычных заказов: {len(regular_orders)}", file=sys.stderr)

# Специальные ограничения для конкретных курьеров
COURIER_SPECIAL_RESTRICTIONS = {}

print(f"=== СПЕЦИАЛЬНЫЕ ОГРАНИЧЕНИЯ КУРЬЕРОВ ===", file=sys.stderr)
for courier_name, restrictions in COURIER_SPECIAL_RESTRICTIONS.items():
    print(f"Курьер {courier_name}: макс. 12л={restrictions['max_bottles_12']}, макс. 19л={restrictions['max_bottles_19']} ({restrictions['reason']})", file=sys.stderr)

# Проверяем курьеров
valid_couriers = []
for i, courier in enumerate(couriers):
    if courier.get("lat") is not None and courier.get("lon") is not None:
        valid_couriers.append(courier)
        print(f"✅ Курьер {courier['id']}: ({courier['lat']}, {courier['lon']})", file=sys.stderr)
        
        # Проверяем активные заказы
        if courier.get("order") and courier["order"].get("status") == "onTheWay":
            active_order_id = courier["order"]["orderId"]
            print(f"   🚚 Активный заказ: {active_order_id}", file=sys.stderr)
        else:
            print(f"   ⏳ Нет активных заказов", file=sys.stderr)
    else:
        print(f"❌ Курьер {courier['id']}: отсутствуют координаты", file=sys.stderr)

# Проверяем заказы
active_order_ids = set()

# Собираем ID активных заказов из структуры курьеров
for courier in valid_couriers:
    if courier.get("order") and courier["order"].get("status") == "onTheWay":
        active_order_ids.add(courier["order"]["orderId"])

# Создаем виртуальные записи для активных заказов
active_orders_data = {}
for courier in valid_couriers:
    if courier.get("order") and courier["order"].get("status") == "onTheWay":
        active_order = courier["order"]
        active_orders_data[active_order["orderId"]] = {
            "id": active_order["orderId"],
            "lat": active_order["lat"],
            "lon": active_order["lon"],
            "bottles_12": active_order.get("bottles_12", 0),
            "bottles_19": active_order.get("bottles_19", 0),
            "status": "onTheWay"
        }

for i, order in enumerate(orders):
    if order.get("lat") is not None and order.get("lon") is not None:
        status_info = " (АКТИВНЫЙ)" if order['id'] in active_order_ids else ""
        print(f"✅ Заказ {order['id']}: ({order['lat']}, {order['lon']}){status_info}", file=sys.stderr)
    else:
        print(f"❌ Заказ {order['id']}: отсутствуют координаты", file=sys.stderr)

# Добавляем активные заказы в список для обработки алгоритмом
for active_order_id, active_order_data in active_orders_data.items():
    orders.append(active_order_data)
    print(f"✅ Активный заказ {active_order_id}: ({active_order_data['lat']}, {active_order_data['lon']}) (АКТИВНЫЙ)", file=sys.stderr)

# Обновляем списки валидными данными
couriers = valid_couriers

print(f"\nВалидные курьеры: {len(couriers)}", file=sys.stderr)
print(f"Валидные заказы: {len(orders)}", file=sys.stderr)
print(f"Активные заказы: {len(active_order_ids)}", file=sys.stderr)

# Проверяем минимальные требования
if len(couriers) == 0:
    print("❌ ОШИБКА: Нет курьеров с корректными координатами!", file=sys.stderr)
    print("[]", file=sys.stdout)
    sys.exit(0)

if len(orders) == 0:
    print("❌ ПРЕДУПРЕЖДЕНИЕ: Нет заказов для распределения!", file=sys.stderr)
    print("[]", file=sys.stdout)
    sys.exit(0)

print("✅ Данные корректны, продолжаем оптимизацию...", file=sys.stderr)

# Параметры поиска решения
search_params = pywrapcp.DefaultRoutingSearchParameters()
search_params.first_solution_strategy = (
    routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)
search_params.local_search_metaheuristic = (
    routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH)
search_params.time_limit.seconds = 30  # Увеличиваем время поиска
search_params.log_search = True  # Включаем логирование поиска

def solve_vrp_for_orders(couriers_data, orders_data):
    """Решает VRP для заданного набора заказов с учетом вместимости курьеров"""
    if not orders_data:
        print("Нет заказов для распределения", file=sys.stderr)
        return []
    
    # Создаем список локаций: депо + курьеры + заказы
    locations = [common_depot] + couriers_data + orders_data
    
    # Создаем матрицу времени в пути
    time_matrix = create_time_matrix(locations, speed_mps=speed_mps)
    
    num_couriers = len(couriers_data)
    num_orders = len(orders_data)
    num_locations = len(locations)
    
    print(f"Решаем VRP: {num_couriers} курьеров, {num_orders} заказов", file=sys.stderr)
    
    # ОТКРЫТЫЕ МАРШРУТЫ: Создаем виртуальные конечные точки
    starts = list(range(1, num_couriers + 1))
    virtual_ends = []
    for vehicle_id in range(num_couriers):
        virtual_end_index = num_locations + vehicle_id
        virtual_ends.append(virtual_end_index)
    
    total_locations = num_locations + num_couriers
    
    manager = pywrapcp.RoutingIndexManager(total_locations, num_couriers, starts, virtual_ends)
    routing = pywrapcp.RoutingModel(manager)
    
    # Функция расчета времени
    def time_callback(from_index, to_index):
        try:
            if from_index < 0 or to_index < 0:
                return 999999
            
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            
            if to_node >= num_locations:
                return 0
            
            if from_node >= num_locations:
                return 999999
            
            travel_time = time_matrix[from_node][to_node]
            
            service_time_per_order = 15 * 60
            if (to_node >= num_couriers + 1 and to_node < num_locations and
                not locations[to_node].get('is_courier_start', False) and
                not locations[to_node].get('is_active_order', False)):
                travel_time += service_time_per_order
                
            return int(travel_time)
        except Exception as e:
            print(f"Ошибка в time_callback: {e}", file=sys.stderr)
            return 999999
    
    transit_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    
    # Функция для расчета вместимости (12л бутылки)
    def demand_callback_12(from_index):
        try:
            if from_index < 0:
                return 0
            
            from_node = manager.IndexToNode(from_index)
            if from_node >= num_couriers + 1 and from_node < num_locations:
                order = orders_data[from_node - num_couriers - 1]
                return order.get('bottles_12', 0)
            return 0
        except Exception as e:
            print(f"Ошибка в demand_callback_12: {e}", file=sys.stderr)
            return 0
    
    # Функция для расчета вместимости (19л бутылки)
    def demand_callback_19(from_index):
        try:
            if from_index < 0:
                return 0
            
            from_node = manager.IndexToNode(from_index)
            if from_node >= num_couriers + 1 and from_node < num_locations:
                order = orders_data[from_node - num_couriers - 1]
                return order.get('bottles_19', 0)
            return 0
        except Exception as e:
            print(f"Ошибка в demand_callback_19: {e}", file=sys.stderr)
            return 0
    
    demand_callback_index_12 = routing.RegisterUnaryTransitCallback(demand_callback_12)
    demand_callback_index_19 = routing.RegisterUnaryTransitCallback(demand_callback_19)
    
    # Добавляем ограничения вместимости для каждого курьера
    for i in range(num_couriers):
        courier = couriers_data[i]
        capacity_12 = courier.get('capacity_12', 0)
        capacity_19 = courier.get('capacity_19', 0)
        
        print(f"Курьер {courier['id']}: вместимость 12л={capacity_12}, 19л={capacity_19}", file=sys.stderr)
        
        # Ограничение по 12л бутылкам
        if capacity_12 > 0:
            routing.AddDimensionWithVehicleCapacity(
                demand_callback_index_12,
                0,  # null capacity slack
                [capacity_12],  # vehicle maximum capacities
                True,  # start cumul to zero
                'Capacity12'
            )
        
        # Ограничение по 19л бутылкам
        if capacity_19 > 0:
            routing.AddDimensionWithVehicleCapacity(
                demand_callback_index_19,
                0,  # null capacity slack
                [capacity_19],  # vehicle maximum capacities
                True,  # start cumul to zero
                'Capacity19'
            )
    
    # Добавляем ограничения для заказов с более мягкими штрафами
    for order_idx in range(num_couriers + 1, num_locations):
        order = orders_data[order_idx - num_couriers - 1]
        
        # Более мягкие штрафы для всех заказов
        if order.get('isUrgent', False) or order.get('is_urgent', False):
            penalty = 50000  # Снижаем штраф для срочных заказов
            print(f"🚨 Срочный заказ {order['id']} - штраф за пропуск: {penalty}", file=sys.stderr)
        else:
            penalty = 5000  # Снижаем обычный штраф
        
        routing.AddDisjunction([manager.NodeToIndex(order_idx)], penalty)
    
    # Добавляем размерность для времени с очень мягкими ограничениями
    routing.AddDimension(
        transit_callback_index,
        14400,  # slack_max (4 часа)
        86400,  # максимальное время маршрута (24 часа)
        False,  # start_cumul_to_zero - НЕ устанавливаем в ноль
        'Time'
    )
    time_dimension = routing.GetDimensionOrDie('Time')
    
    # Устанавливаем начальное время для всех курьеров с очень мягкими ограничениями
    try:
        for i in range(num_couriers):
            start_index = routing.Start(i)
            # Очень мягкие ограничения времени
            min_time = 0  # Разрешаем любое время
            max_time = 86400  # Разрешаем любое время в течение дня
            time_dimension.CumulVar(start_index).SetRange(min_time, max_time)
    except Exception as e:
        print(f"Ошибка при установке времени старта: {e}", file=sys.stderr)
        # Пробуем без ограничений времени
        for i in range(num_couriers):
            start_index = routing.Start(i)
            time_dimension.CumulVar(start_index).SetRange(0, 86400)
    
    # ОГРАНИЧЕНИЯ НА КОЛИЧЕСТВО ЗАКАЗОВ ДЛЯ РАВНОМЕРНОГО РАСПРЕДЕЛЕНИЯ
    # Функция подсчета заказов
    def order_count_callback(from_index, to_index):
        try:
            if from_index < 0 or to_index < 0:
                return 0
            
            to_node = manager.IndexToNode(to_index)
            if to_node >= num_couriers + 1 and to_node < num_locations:
                return 1
            return 0
        except Exception as e:
            print(f"Ошибка в order_count_callback: {e}", file=sys.stderr)
            return 0
    
    order_count_callback_index = routing.RegisterTransitCallback(order_count_callback)
    
    # Максимальное количество заказов на курьера (очень мягкие ограничения)
    max_orders_per_courier = max(1, min(20, num_orders // num_couriers + 5))  # Увеличиваем лимит еще больше
    print(f"Максимальное количество заказов на курьера: {max_orders_per_courier}", file=sys.stderr)
    
    # Добавляем ограничение на количество заказов
    routing.AddDimension(
        order_count_callback_index,
        0,  # slack_max
        max_orders_per_courier,  # максимальное количество заказов
        True,  # start_cumul_to_zero
        'OrderCount'
    )
    
    # Временные окна для заказов (только если есть) - делаем более мягкими
    for order in orders_data:
        if 'date.time' in order:
            order_node_index = None
            for j, loc in enumerate(locations[:-1]):
                if 'id' in loc and loc['id'] == order['id']:
                    order_node_index = j
                    break
    
            if order_node_index is not None:
                try:
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
                    
                    # Для срочных заказов делаем временные окна более мягкими
                    if order.get('isUrgent', False) or order.get('is_urgent', False):
                        print(f"🚨 Срочный заказ {order['id']} с временным окном: {start_time_str}-{end_time_str}", file=sys.stderr)
                        # Увеличиваем допустимое время ожидания для срочных заказов
                        max_wait_for_urgent = 60 * 60  # 1 час для срочных
                        if start_time_seconds > current_time_in_seconds + max_wait_for_urgent:
                            print(f"⚠️  Срочный заказ {order['id']} пропущен - слишком долгое ожидание", file=sys.stderr)
                            continue
                    
                    # Делаем временные окна более мягкими
                    time_dimension.CumulVar(order_index).SetRange(int(start_time_seconds), int(end_time_seconds + 3600))  # +1 час к концу окна
                except Exception as e:
                    print(f"Ошибка при установке временного окна для заказа {order['id']}: {e}", file=sys.stderr)
                    continue
    
    # Решаем задачу с обработкой ошибок
    try:
        solution = routing.SolveWithParameters(search_params)
        
        if not solution:
            print("Основная стратегия не нашла решение, пробуем простую стратегию", file=sys.stderr)
            # Пробуем более простую стратегию
            simple_params = pywrapcp.DefaultRoutingSearchParameters()
            simple_params.first_solution_strategy = (
                routing_enums_pb2.FirstSolutionStrategy.SAVINGS)
            simple_params.time_limit.seconds = 10
            solution = routing.SolveWithParameters(simple_params)
        
        if solution:
            routes = []
            for vehicle_id in range(num_couriers):
                index = routing.Start(vehicle_id)
                route_orders = []
                
                while not routing.IsEnd(index):
                    node_index = manager.IndexToNode(index)
                    
                    if node_index >= num_couriers + 1 and node_index < num_locations:
                        order = orders_data[node_index - num_couriers - 1]
                        route_orders.append(order["id"])
                    
                    index = solution.Value(routing.NextVar(index))
                
                if route_orders:
                    routes.append({
                        "courier_id": couriers_data[vehicle_id]["id"],
                        "orders": route_orders
                    })
            
            return routes
        else:
            print("Алгоритм не смог найти решение даже с простой стратегией", file=sys.stderr)
            return []
    except Exception as e:
        print(f"Ошибка при решении VRP: {e}", file=sys.stderr)
        return []

# 2. Копируем курьеров для первого этапа
couriers_for_active = copy.deepcopy(couriers)

# 3. Сначала решаем для активных заказов (обязательно)
assigned_active = []
if active_orders_list:
    print(f"Обрабатываем {len(active_orders_list)} активных заказов...", file=sys.stderr)
    try:
        assigned_active = solve_vrp_for_orders(couriers_for_active, active_orders_list)
        print(f"Назначено {len(assigned_active)} активных заказов", file=sys.stderr)
    except Exception as e:
        print(f"Ошибка при решении для активных заказов: {e}", file=sys.stderr)
        assigned_active = []
else:
    print("Активных заказов нет", file=sys.stderr)

# FALLBACK: Если алгоритм не смог найти решение для активных заказов
if not assigned_active and active_orders_list:
    print("🔄 Используем fallback распределение для активных заказов", file=sys.stderr)
    assigned_active = []
    
    # Принудительное назначение активных заказов их курьерам
    for courier in couriers:
        if courier.get("order") and courier["order"].get("status") == "onTheWay":
            active_order_id = courier["order"]["orderId"]
            assigned_active.append({
                "courier_id": courier["id"],
                "orders": [active_order_id]
            })
            print(f"Fallback: активный заказ {active_order_id} назначен курьеру {courier['id']}", file=sys.stderr)
    
    print(f"Fallback: назначено {len(assigned_active)} маршрутов для {len(active_orders_list)} активных заказов", file=sys.stderr)

# 4. Обновляем состояние курьеров после активных заказов
courier_assignments = {}
for assignment in assigned_active:
    courier_id = assignment['courier_id']
    if courier_id not in courier_assignments:
        courier_assignments[courier_id] = []
    courier_assignments[courier_id].extend(assignment['orders'])

# Обновляем каждого курьера
for courier_id, assigned_order_ids in courier_assignments.items():
    courier = next((c for c in couriers if c['id'] == courier_id), None)
    if courier:
        # Уменьшаем вместимость на все назначенные заказы
        for order_id in assigned_order_ids:
            order = next((o for o in active_orders_list if o['id'] == order_id), None)
            if order:
                courier['capacity_12'] = max(0, courier.get('capacity_12', 0) - order.get('bottles_12', 0))
                courier['capacity_19'] = max(0, courier.get('capacity_19', 0) - order.get('bottles_19', 0))
        
        # Обновляем координаты курьера на координаты последнего заказа
        if assigned_order_ids:
            last_order_id = assigned_order_ids[-1]
            last_order = next((o for o in active_orders_list if o['id'] == last_order_id), None)
            if last_order:
                courier['lat'] = last_order['lat']
                courier['lon'] = last_order['lon']
                print(f"Курьер {courier_id} перемещен в ({last_order['lat']:.6f}, {last_order['lon']:.6f})", file=sys.stderr)

# 5. Решаем для срочных заказов
assigned_urgent = []
if urgent_orders:
    print(f"Обрабатываем {len(urgent_orders)} срочных заказов...", file=sys.stderr)
    try:
        assigned_urgent = solve_vrp_for_orders(couriers, urgent_orders)
        print(f"Назначено {len(assigned_urgent)} срочных заказов", file=sys.stderr)
    except Exception as e:
        print(f"Ошибка при решении для срочных заказов: {e}", file=sys.stderr)
        assigned_urgent = []
else:
    print("Срочных заказов нет", file=sys.stderr)

# FALLBACK: Если алгоритм не смог найти решение для срочных заказов
if not assigned_urgent and urgent_orders:
    print("🔄 Используем fallback распределение для срочных заказов с учетом вместимости", file=sys.stderr)
    assigned_urgent = []
    
    # Создаем копии курьеров для отслеживания оставшейся вместимости
    courier_capacities = {}
    for courier in couriers:
        courier_capacities[courier["id"]] = {
            "capacity_12": courier.get("capacity_12", 0),
            "capacity_19": courier.get("capacity_19", 0)
        }
    
    # Простое распределение срочных заказов по курьерам с учетом вместимости
    for order in urgent_orders:
        order_bottles_12 = order.get("bottles_12", 0)
        order_bottles_19 = order.get("bottles_19", 0)
        
        # Ищем курьера с достаточной вместимостью
        assigned = False
        for courier in couriers:
            courier_id = courier["id"]
            capacity = courier_capacities[courier_id]
            
            if (capacity["capacity_12"] >= order_bottles_12 and 
                capacity["capacity_19"] >= order_bottles_19):
                
                # Находим или создаем маршрут для этого курьера
                existing_route = next((route for route in assigned_urgent if route["courier_id"] == courier_id), None)
                if existing_route:
                    existing_route["orders"].append(order["id"])
                else:
                    assigned_urgent.append({
                        "courier_id": courier_id,
                        "orders": [order["id"]]
                    })
                
                # Обновляем оставшуюся вместимость
                capacity["capacity_12"] -= order_bottles_12
                capacity["capacity_19"] -= order_bottles_19
                assigned = True
                print(f"Fallback: срочный заказ {order['id']} назначен курьеру {courier_id} (осталось: 12л={capacity['capacity_12']}, 19л={capacity['capacity_19']})", file=sys.stderr)
                break
        
        if not assigned:
            print(f"⚠️  Fallback: срочный заказ {order['id']} не может быть назначен - нет курьера с достаточной вместимостью", file=sys.stderr)
    
    print(f"Fallback: назначено {len(assigned_urgent)} маршрутов для {len(urgent_orders)} срочных заказов", file=sys.stderr)

# 6. Обновляем состояние курьеров после срочных заказов
for assignment in assigned_urgent:
    courier_id = assignment['courier_id']
    if courier_id not in courier_assignments:
        courier_assignments[courier_id] = []
    courier_assignments[courier_id].extend(assignment['orders'])

for courier_id, assigned_order_ids in courier_assignments.items():
    courier = next((c for c in couriers if c['id'] == courier_id), None)
    if courier:
        # Уменьшаем вместимость на все назначенные заказы
        for order_id in assigned_order_ids:
            order = next((o for o in urgent_orders if o['id'] == order_id), None)
            if order:
                courier['capacity_12'] = max(0, courier.get('capacity_12', 0) - order.get('bottles_12', 0))
                courier['capacity_19'] = max(0, courier.get('capacity_19', 0) - order.get('bottles_19', 0))
        
        # Обновляем координаты курьера на координаты последнего заказа
        if assigned_order_ids:
            last_order_id = assigned_order_ids[-1]
            last_order = next((o for o in urgent_orders if o['id'] == last_order_id), None)
            if last_order:
                courier['lat'] = last_order['lat']
                courier['lon'] = last_order['lon']
                print(f"Курьер {courier_id} перемещен в ({last_order['lat']:.6f}, {last_order['lon']:.6f})", file=sys.stderr)

# 7. Решаем для обычных заказов
try:
    assigned_regular = solve_vrp_for_orders(couriers, regular_orders)
    print(f"Назначено {len(assigned_regular)} обычных заказов", file=sys.stderr)
except Exception as e:
    print(f"Ошибка при решении для обычных заказов: {e}", file=sys.stderr)
    assigned_regular = []

# FALLBACK: Если алгоритм не смог найти решение, используем простое распределение
if not assigned_regular and regular_orders:
    print("🔄 Используем fallback распределение для обычных заказов с учетом вместимости", file=sys.stderr)
    assigned_regular = []
    
    # Создаем копии курьеров для отслеживания оставшейся вместимости
    courier_capacities = {}
    for courier in couriers:
        courier_capacities[courier["id"]] = {
            "capacity_12": courier.get("capacity_12", 0),
            "capacity_19": courier.get("capacity_19", 0)
        }
    
    # Простое распределение заказов по курьерам с учетом вместимости
    for order in regular_orders:
        order_bottles_12 = order.get("bottles_12", 0)
        order_bottles_19 = order.get("bottles_19", 0)
        
        # Ищем курьера с достаточной вместимостью
        assigned = False
        for courier in couriers:
            courier_id = courier["id"]
            capacity = courier_capacities[courier_id]
            
            if (capacity["capacity_12"] >= order_bottles_12 and 
                capacity["capacity_19"] >= order_bottles_19):
                
                # Находим или создаем маршрут для этого курьера
                existing_route = next((route for route in assigned_regular if route["courier_id"] == courier_id), None)
                if existing_route:
                    existing_route["orders"].append(order["id"])
                else:
                    assigned_regular.append({
                        "courier_id": courier_id,
                        "orders": [order["id"]]
                    })
                
                # Обновляем оставшуюся вместимость
                capacity["capacity_12"] -= order_bottles_12
                capacity["capacity_19"] -= order_bottles_19
                assigned = True
                print(f"Fallback: заказ {order['id']} назначен курьеру {courier_id} (осталось: 12л={capacity['capacity_12']}, 19л={capacity['capacity_19']})", file=sys.stderr)
                break
        
        if not assigned:
            print(f"⚠️  Fallback: заказ {order['id']} не может быть назначен - нет курьера с достаточной вместимостью", file=sys.stderr)
    
    print(f"Fallback: назначено {len(assigned_regular)} маршрутов для {len(regular_orders)} заказов", file=sys.stderr)

# 8. Объединяем результаты
all_routes = assigned_active + assigned_urgent + assigned_regular

# 9. ОБЯЗАТЕЛЬНОЕ НАЗНАЧЕНИЕ АКТИВНЫХ ЗАКАЗОВ
# Проверяем, что все активные заказы назначены
assigned_courier_ids = {route['courier_id'] for route in all_routes}
assigned_order_ids = set()
for route in all_routes:
    assigned_order_ids.update(route['orders'])

# Находим курьеров без маршрутов и их активные заказы
unassigned_couriers = []
for courier in couriers:
    if courier['id'] not in assigned_courier_ids:
        if courier.get("order") and courier["order"].get("status") == "onTheWay":
            active_order_id = courier["order"]["orderId"]
            if active_order_id not in assigned_order_ids:
                # Создаем маршрут только с активным заказом
                unassigned_couriers.append({
                    "courier_id": courier['id'],
                    "orders": [active_order_id]
                })
                print(f"🚚 Принудительно назначен активный заказ {active_order_id} курьеру {courier['id']}", file=sys.stderr)

# Добавляем маршруты для курьеров с активными заказами
all_routes.extend(unassigned_couriers)

# 10. НАЗНАЧЕНИЕ МИНИМУМА ОДНОГО ЗАКАЗА КАЖДОМУ КУРЬЕРУ
# Находим курьеров без заказов
couriers_with_orders = {route['courier_id'] for route in all_routes}
couriers_without_orders = [c for c in couriers if c['id'] not in couriers_with_orders]

if couriers_without_orders and regular_orders:
    print(f"Назначаем минимум один заказ курьерам без заказов: {len(couriers_without_orders)}", file=sys.stderr)
    
    # Находим заказы, которые еще не назначены
    all_assigned_orders = set()
    for route in all_routes:
        all_assigned_orders.update(route['orders'])
    
    available_orders = [o for o in regular_orders if o['id'] not in all_assigned_orders]
    
    # Назначаем по одному заказу каждому курьеру без заказов
    for i, courier in enumerate(couriers_without_orders):
        if i < len(available_orders):
            order = available_orders[i]
            all_routes.append({
                "courier_id": courier['id'],
                "orders": [order['id']]
            })
            print(f"📦 Назначен заказ {order['id']} курьеру {courier['id']} (минимум)", file=sys.stderr)
        else:
            print(f"⚠️  Нет доступных заказов для курьера {courier['id']}", file=sys.stderr)

# 11. БАЛАНСИРОВКА НАГРУЗКИ - ПЕРЕРАСПРЕДЕЛЕНИЕ ИЗБЫТОЧНЫХ ЗАКАЗОВ
print("=== БАЛАНСИРОВКА НАГРУЗКИ ===", file=sys.stderr)

# Подсчитываем количество заказов у каждого курьера
courier_order_counts = {}
for route in all_routes:
    courier_id = route['courier_id']
    courier_order_counts[courier_id] = len(route['orders'])

# Находим курьеров с избыточной нагрузкой
max_recommended_orders = max(1, min(8, len(orders) // len(couriers) + 1))
print(f"Рекомендуемое максимальное количество заказов на курьера: {max_recommended_orders}", file=sys.stderr)

overloaded_couriers = []
underloaded_couriers = []

for courier_id, order_count in courier_order_counts.items():
    if order_count > max_recommended_orders:
        overloaded_couriers.append((courier_id, order_count))
        print(f"⚠️  Курьер {courier_id} перегружен: {order_count} заказов", file=sys.stderr)
    elif order_count < max_recommended_orders and order_count > 0:
        underloaded_couriers.append((courier_id, order_count))
        print(f"📊 Курьер {courier_id} недогружен: {order_count} заказов", file=sys.stderr)

# Пытаемся перераспределить заказы от перегруженных к недогруженным
for overloaded_courier_id, overloaded_count in overloaded_couriers:
    if not underloaded_couriers:
        break
        
    # Находим маршрут перегруженного курьера
    overloaded_route = next((r for r in all_routes if r['courier_id'] == overloaded_courier_id), None)
    if not overloaded_route or len(overloaded_route['orders']) <= 1:
        continue
    
    # Берем последние заказы (не активные) для перераспределения
    orders_to_redistribute = []
    for order_id in reversed(overloaded_route['orders']):
        # Проверяем, что это не активный заказ
        is_active = False
        for courier in couriers:
            if (courier.get("order") and courier["order"].get("status") == "onTheWay" and 
                courier["order"]["orderId"] == order_id):
                is_active = True
                break
        
        if not is_active and len(orders_to_redistribute) < (overloaded_count - max_recommended_orders):
            orders_to_redistribute.append(order_id)
    
    # Перераспределяем заказы
    for order_id in orders_to_redistribute:
        if not underloaded_couriers:
            break
            
        # Находим наименее загруженного курьера
        underloaded_courier_id, underloaded_count = min(underloaded_couriers, key=lambda x: x[1])
        
        # Удаляем заказ у перегруженного курьера
        overloaded_route['orders'].remove(order_id)
        
        # Добавляем заказ недогруженному курьеру
        underloaded_route = next((r for r in all_routes if r['courier_id'] == underloaded_courier_id), None)
        if underloaded_route:
            underloaded_route['orders'].append(order_id)
            print(f"🔄 Заказ {order_id} перераспределен от {overloaded_courier_id} к {underloaded_courier_id}", file=sys.stderr)
        
        # Обновляем счетчики
        courier_order_counts[overloaded_courier_id] -= 1
        courier_order_counts[underloaded_courier_id] += 1
        
        # Обновляем списки
        for i, (courier_id, count) in enumerate(overloaded_couriers):
            if courier_id == overloaded_courier_id:
                overloaded_couriers[i] = (courier_id, count - 1)
                break
        
        for i, (courier_id, count) in enumerate(underloaded_couriers):
            if courier_id == underloaded_courier_id:
                underloaded_couriers[i] = (courier_id, count + 1)
                break

# Формируем финальный результат
final_routes = []
for route in all_routes:
    courier_id = route['courier_id']
    route_orders = route['orders']
    
    # Рассчитываем необходимые бутылки для этого курьера
    total_bottles_12 = 0
    total_bottles_19 = 0
    total_bottles = 0
    
    for order_id in route_orders:
        order_data = next((o for o in orders if o["id"] == order_id), None)
        if order_data:
            bottles_12 = order_data.get("bottles_12") or 0
            bottles_19 = order_data.get("bottles_19") or 0
            total_bottles_12 += bottles_12
            total_bottles_19 += bottles_19
            total_bottles += bottles_12 + bottles_19
    
    # Получаем информацию о курьере
    courier = next((c for c in couriers if c['id'] == courier_id), None)
    if courier:
        courier_type = 'loaded' if (courier.get('capacity_12', 0) > 0 or courier.get('capacity_19', 0) > 0) else 'empty'
        courier_capacity_12 = courier.get("capacity_12", 0)
        courier_capacity_19 = courier.get("capacity_19", 0)
        
        # Логика расчета в зависимости от типа курьера
        if courier_type == 'empty':
            courier_should_take = {
                "bottles_12": total_bottles_12,
                "bottles_19": total_bottles_19,
                "total": total_bottles_12 + total_bottles_19
            }
            courier_total_capacity = courier.get("capacity", 100)
        else:
            courier_should_take = {
                "bottles_12": 0,
                "bottles_19": 0,
                "total": 0
            }
            courier_total_capacity = courier_capacity_12 + courier_capacity_19
        
        # Примерное время в пути (можно уточнить)
        estimated_time_minutes = len(route_orders) * 30  # 30 минут на заказ
        
        route_info = {
            "courier_id": courier_id,
            "orders": route_orders,
            "orders_count": len(route_orders),
            "travel_time_seconds": estimated_time_minutes * 60,
            "travel_time_minutes": estimated_time_minutes,
            "required_bottles": {
                "bottles_12": total_bottles_12,
                "bottles_19": total_bottles_19,
                "total": total_bottles
            },
            "courier_should_take": courier_should_take,
            "capacity_utilization": {
                "percent": round(100 * total_bottles / max(courier_total_capacity, 1), 1)
            },
            "has_active_order": bool(courier.get("order")),
            "courier_type": courier_type
        }
        
        final_routes.append(route_info)

print(f"\n=== РЕЗУЛЬТАТЫ ТРЕХЭТАПНОГО РАСПРЕДЕЛЕНИЯ ===", file=sys.stderr)
print(f"Активных заказов назначено: {len(assigned_active)}", file=sys.stderr)
print(f"Срочных заказов назначено: {len(assigned_urgent)}", file=sys.stderr)
print(f"Обычных заказов назначено: {len(assigned_regular)}", file=sys.stderr)
print(f"Всего маршрутов: {len(final_routes)}", file=sys.stderr)

# Статистика по загрузке курьеров
print(f"\n=== СТАТИСТИКА ЗАГРУЗКИ КУРЬЕРОВ ===", file=sys.stderr)
for route in final_routes:
    courier_id = route['courier_id']
    order_count = len(route['orders'])
    print(f"Курьер {courier_id}: {order_count} заказов", file=sys.stderr)

# Проверяем равномерность распределения
order_counts = [len(route['orders']) for route in final_routes]
if order_counts:
    avg_orders = sum(order_counts) / len(order_counts)
    max_orders = max(order_counts)
    min_orders = min(order_counts)
    print(f"Среднее количество заказов: {avg_orders:.1f}", file=sys.stderr)
    print(f"Максимум заказов: {max_orders}, Минимум заказов: {min_orders}", file=sys.stderr)
    print(f"Разброс нагрузки: {max_orders - min_orders} заказов", file=sys.stderr)

print(json.dumps(final_routes, ensure_ascii=False)) 