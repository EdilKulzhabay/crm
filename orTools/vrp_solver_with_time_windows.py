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
                    # print(f"Заказ {order['id']} пропущен - временное окно закрыто", file=sys.stderr)
                    continue
                
                # Проверяем, не будет ли заказ ждать слишком долго
                if start_time_seconds > current_time_in_seconds + max_wait_time_seconds:
                    # print(f"Заказ {order['id']} пропущен - слишком долгое ожидание (окно: {start_time_str}-{end_time_str})", file=sys.stderr)
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
    is_urgent = order.get('isUrgent', False) or order.get('is_urgent', False)
    # print(f"Проверка заказа {order['id']}: isUrgent={order.get('isUrgent', 'НЕТ')}, is_urgent={order.get('is_urgent', 'НЕТ')}, итого={is_urgent}", file=sys.stderr)
    
    if is_urgent:
        urgent_orders.append(order)
        # print(f"🚨 СРОЧНЫЙ заказ {order['id']} добавлен в приоритетную очередь", file=sys.stderr)
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
    routing_enums_pb2.FirstSolutionStrategy.SAVINGS)  # Хорошая начальная стратегия
search_params.local_search_metaheuristic = (
    routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH)  # Лучше чем TABU_SEARCH для оптимизации
search_params.time_limit.seconds = 20  # Увеличиваем время для лучшего решения
search_params.log_search = False  # Отключаем логирование поиска

# Дополнительные параметры для лучшей оптимизации
search_params.use_cp_sat = False  # Используем CP solver для VRP
search_params.use_cp = True  # Включаем CP solver

def solve_vrp_for_orders(couriers_data, orders_data):
    """Решает VRP для заданного набора заказов с учетом вместимости курьеров и без возврата в депо"""
    if not orders_data:
        print("Нет заказов для распределения", file=sys.stderr)
        return []

    updated_couriers = []
    
    for courier in couriers_data:
        courier_copy = courier.copy()
        
        if courier.get("order") and courier["order"].get("status") == "onTheWay":
            active_order = courier["order"]
            
            # Рассчитываем время в пути к активному заказу
            distance = haversine_distance(
                courier["lat"], courier["lon"],
                active_order["lat"], active_order["lon"]
            )
            travel_time = distance / speed_mps
            
            # Если курьер еще в пути, используем позицию активного заказа
            if travel_time > 0:
                courier_copy["lat"] = active_order["lat"]
                courier_copy["lon"] = active_order["lon"]
                print(f"Курьер {courier['id']}: позиция обновлена на активный заказ", file=sys.stderr)
        
        updated_couriers.append(courier_copy)
    
    working_couriers = updated_couriers
    
    # Локации: только курьеры и заказы (депо не включаем)
    locations = working_couriers + orders_data
    
    num_couriers = len(working_couriers)
    num_orders = len(orders_data)
    num_locations = len(locations)
    
    print(f"Решаем VRP: {num_couriers} курьеров, {num_orders} заказов", file=sys.stderr)
    print(f"DEBUG: num_locations={num_locations}, num_couriers={num_couriers}, type(num_locations)={type(num_locations)}, type(num_couriers)={type(num_couriers)}", file=sys.stderr)
    
    # Создаем RoutingIndexManager и RoutingModel
    # Используем конструктор с депо (первый узел)
    depot_index = 0
    manager = pywrapcp.RoutingIndexManager(num_locations, num_couriers, depot_index)
    routing = pywrapcp.RoutingModel(manager)
    
    # Функция расчета времени
    def time_callback(from_index, to_index):
        try:
            if from_index < 0 or to_index < 0:
                return 999999
            
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            
            travel_time = 0
            if from_node != to_node:
                distance = haversine_distance(
                    locations[from_node]['lat'], locations[from_node]['lon'],
                    locations[to_node]['lat'], locations[to_node]['lon']
                )
                travel_time = distance / speed_mps
                
                # УЛУЧШЕННЫЙ ПРИОРИТЕТ ПО РАССТОЯНИЮ
                # Если это переход к срочному заказу - уменьшаем стоимость
                if to_node >= num_couriers:
                    order = orders_data[to_node - num_couriers]
                    if order.get('isUrgent', False) or order.get('is_urgent', False):
                        # Срочные заказы получают приоритет по расстоянию
                        travel_time *= 0.3  # Уменьшаем стоимость в 3 раза (было 0.5)
                
                # ДОПОЛНИТЕЛЬНЫЙ ПРИОРИТЕТ: заказы с временными окнами
                if to_node >= num_couriers:
                    order = orders_data[to_node - num_couriers]
                    if order.get('date.time', '') != "":
                        # Заказы с временными окнами получают небольшой приоритет
                        travel_time *= 0.8  # Уменьшаем стоимость на 20%
                
                # ПРИОРИТЕТ ПО ЗАГРУЗКЕ: предпочитаем курьеров с большей вместимостью
                if from_node < num_couriers and to_node >= num_couriers:
                    courier = working_couriers[from_node]
                    courier_capacity = courier.get('capacity_19', 0) + courier.get('capacity_12', 0)
                    if courier_capacity > 30:  # Если у курьера много места
                        travel_time *= 0.9  # Небольшой приоритет
                    elif courier_capacity < 15:  # Если у курьера мало места
                        travel_time *= 1.2  # Небольшой штраф
            
            service_time_per_order = 5 * 60
            if to_node >= num_couriers:
                travel_time += service_time_per_order
            return int(travel_time)
        except Exception as e:
            print(f"Ошибка в time_callback: {e}", file=sys.stderr)
            return 999999
    
    transit_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    
    # Функции для вместимости (индексация заказов с num_couriers)
    def demand_callback_12(from_index):
        try:
            from_node = manager.IndexToNode(from_index)
            if from_node >= num_couriers:
                order = orders_data[from_node - num_couriers]
                return order.get('bottles_12', 0)
            return 0
        except Exception as e:
            print(f"Ошибка в demand_callback_12: {e}", file=sys.stderr)
            return 0
    def demand_callback_19(from_index):
        try:
            from_node = manager.IndexToNode(from_index)
            if from_node >= num_couriers:
                order = orders_data[from_node - num_couriers]
                return order.get('bottles_19', 0)
            return 0
        except Exception as e:
            print(f"Ошибка в demand_callback_19: {e}", file=sys.stderr)
            return 0
    demand_callback_index_12 = routing.RegisterUnaryTransitCallback(demand_callback_12)
    demand_callback_index_19 = routing.RegisterUnaryTransitCallback(demand_callback_19)
    
    # КРИТИЧЕСКИ ВАЖНО: Добавляем ограничения по вместимости курьеров
    vehicle_capacities_12 = [c.get('capacity_12', 0) for c in working_couriers]
    vehicle_capacities_19 = [c.get('capacity_19', 0) for c in working_couriers]
    
    print(f"DEBUG: Вместимость курьеров 12л: {vehicle_capacities_12}", file=sys.stderr)
    print(f"DEBUG: Вместимость курьеров 19л: {vehicle_capacities_19}", file=sys.stderr)
    
    # ИСПРАВЛЕННАЯ ЛОГИКА: Добавляем ограничения ВСЕГДА
    # Если у курьера 0 бутылей - он НЕ МОЖЕТ брать заказы этого типа
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index_12, 0, vehicle_capacities_12, True, 'Capacity12')
    print("✅ Добавлено ограничение по вместимости 12л", file=sys.stderr)
    
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index_19, 0, vehicle_capacities_19, True, 'Capacity19')
    print("✅ Добавлено ограничение по вместимости 19л", file=sys.stderr)
    # Штрафы за пропуск заказов - УВЕЛИЧЕННЫЕ ДЛЯ ЛУЧШЕГО ПОКРЫТИЯ
    for order_idx in range(num_couriers, num_locations):
        order = orders_data[order_idx - num_couriers]
        
        if order.get('isUrgent', False) or order.get('is_urgent', False):
            # СРОЧНЫЕ ЗАКАЗЫ - высокий приоритет
            penalty = 20000  # Увеличиваем с 5000 до 20000
            routing.AddDisjunction([manager.NodeToIndex(order_idx)], penalty)
        else:
            if order.get('date.time', '') != "":
                # ОБЫЧНЫЙ ЗАКАЗ С ВРЕМЕННЫМ ОКНОМ - средний приоритет
                penalty = 15000  # Увеличиваем с 2000 до 15000
                routing.AddDisjunction([manager.NodeToIndex(order_idx)], penalty)
            else:
                # ОБЫЧНЫЙ ЗАКАЗ БЕЗ ВРЕМЕННОГО ОКНА - низкий приоритет
                penalty = 10000  # Увеличиваем с 500 до 10000
                routing.AddDisjunction([manager.NodeToIndex(order_idx)], penalty)
    
    # Временные окна
    routing.AddDimension(
        transit_callback_index,
        3600,  # slack_max (1 час вместо 30 минут)
        18000,  # максимальное время маршрута (5 часов)
        False,
        'Time'
    )
    time_dimension = routing.GetDimensionOrDie('Time')
    
    # ПРИОРИТЕТ ПО ВРЕМЕНИ ДЛЯ СРОЧНЫХ ЗАКАЗОВ
    urgent_orders = [order for order in orders_data if order.get('isUrgent', False) or order.get('is_urgent', False)]
    for urgent_order in urgent_orders:
        order_node_index = None
        for j, loc in enumerate(locations):
            if 'id' in loc and loc['id'] == urgent_order['id']:
                order_node_index = j
                break
        
        if order_node_index is not None:
            order_index = manager.NodeToIndex(order_node_index)
            try:
                # Устанавливаем приоритет: срочные заказы должны выполняться как можно раньше
                time_dimension.CumulVar(order_index).SetMin(0)
                print(f"⏰ СРОЧНЫЙ заказ {urgent_order['id']} установлен приоритетным по времени", file=sys.stderr)
            except Exception as e:
                print(f"Ошибка при установке приоритета для срочного заказа {urgent_order['id']}: {e}", file=sys.stderr)

    def order_count_callback(from_index, to_index):
        try:
            to_node = manager.IndexToNode(to_index)
            if to_node >= num_couriers:
                return 1
            return 0
        except Exception as e:
            print(f"Ошибка в order_count_callback: {e}", file=sys.stderr)
            return 0
            
    order_count_callback_index = routing.RegisterTransitCallback(order_count_callback)
    # УВЕЛИЧЕННОЕ ограничение на количество заказов
    # Для лучшего покрытия всех заказов
    max_orders_per_courier = max(1, min(20, num_orders // num_couriers + 3))  # Увеличиваем максимум
    routing.AddDimension(
        order_count_callback_index,
        0,
        max_orders_per_courier,
        True,
        'OrderCount'
    )
    
    # Штраф за пустых курьеров (если курьер не получил ни одного заказа)
    for vehicle_id in range(num_couriers):
        start_index = routing.Start(vehicle_id)
        # Высокий штраф если курьер остается без заказов
        empty_courier_penalty = 50000  # Увеличиваем с 1000 до 50000
        routing.AddDisjunction([start_index], empty_courier_penalty)
        
    # Временные окна для заказов - ОТКЛЮЧЕНО ИЗ-ЗА КОНФЛИКТОВ
    # for order in orders_data:
    #     if 'date.time' in order:
    #         order_node_index = None
    #         for j, loc in enumerate(locations):
    #             if 'id' in loc and loc['id'] == order['id']:
    #                 order_node_index = j
    #                 break
    #         if order_node_index is not None:
    #             try:
    #                 time_window = order['date.time']
    #                 if time_window and time_window.strip():
    #                     start_time_str, end_time_str = time_window.split(' - ')
    #                     start_time = datetime.strptime(start_time_str, '%H:%M').time()
    #                     end_time = datetime.strptime(end_time_str, '%H:%M').time()
    #                     
    #                     start_time_seconds = start_time.hour * 3600 + start_time.minute * 60
    #                     end_time_seconds = end_time.hour * 3600 + end_time.minute * 60
    #                     
    #                     order_index = manager.NodeToIndex(order_node_index)
    #                     time_dimension.CumulVar(order_index).SetRange(start_time_seconds, end_time_seconds)
    #                     print(f"⏰ Временное окно для заказа {order['id']}: {start_time_str}-{end_time_str}", file=sys.stderr)
    #             except Exception as e:
    #                 print(f"Ошибка при установке временного окна для заказа {order['id']}: {e}", file=sys.stderr)
    # Решаем задачу с таймаутом
    try:
        print(f"🔄 Запуск OR-Tools (таймаут: 20 сек)...", file=sys.stderr)
        solution = routing.SolveWithParameters(search_params)
        
        if not solution:
            print("⚠️ Основная стратегия не нашла решение, пробуем быструю стратегию (10 сек)", file=sys.stderr)
            fast_params = pywrapcp.DefaultRoutingSearchParameters()
            fast_params.first_solution_strategy = (
                routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)
            fast_params.local_search_metaheuristic = (
                routing_enums_pb2.LocalSearchMetaheuristic.TABU_SEARCH)
            fast_params.time_limit.seconds = 10
            solution = routing.SolveWithParameters(fast_params)
            
        if not solution:
            print("⚠️ Быстрая стратегия не нашла решение, пробуем самую простую (5 сек)", file=sys.stderr)
            simple_params = pywrapcp.DefaultRoutingSearchParameters()
            simple_params.first_solution_strategy = (
                routing_enums_pb2.FirstSolutionStrategy.SAVINGS)
            simple_params.local_search_metaheuristic = (
                routing_enums_pb2.LocalSearchMetaheuristic.GREEDY_DESCENT)
            simple_params.time_limit.seconds = 5
            solution = routing.SolveWithParameters(simple_params)
            
        if solution:
            print(f"✅ OR-Tools нашел решение за {solution.ObjectiveValue()} единиц", file=sys.stderr)
            routes = []
            for vehicle_id in range(num_couriers):
                index = routing.Start(vehicle_id)
                route_orders = []
                while not routing.IsEnd(index):
                    node_index = manager.IndexToNode(index)
                    if node_index >= num_couriers:
                        order = orders_data[node_index - num_couriers]
                        route_orders.append(order["id"])
                    index = solution.Value(routing.NextVar(index))
                if route_orders:
                    routes.append({
                        "courier_id": working_couriers[vehicle_id]["id"],
                        "orders": route_orders
                    })
            return routes
        else:
            print("❌ OR-Tools не смог найти решение даже с простыми стратегиями", file=sys.stderr)
            return []
    except Exception as e:
        print(f"❌ Ошибка при решении VRP: {e}", file=sys.stderr)
        return []

# 2. Копируем курьеров для первого этапа
couriers_for_active = copy.deepcopy(couriers)

# 3. Назначаем активные заказы напрямую (без VRP)
assigned_active = []

if active_orders_list:
    print(f"Назначаем {len(active_orders_list)} активных заказов напрямую...", file=sys.stderr)
    
    # Простое назначение активных заказов их курьерам
    for courier in couriers:
        if courier.get("order") and courier["order"].get("status") == "onTheWay":
            active_order_id = courier["order"]["orderId"]
            assigned_active.append({
                "courier_id": courier["id"],
                "orders": [active_order_id]
            })
            print(f"Активный заказ {active_order_id} назначен курьеру {courier['id']}", file=sys.stderr)
else:
    print("Активных заказов нет", file=sys.stderr)

# 4. Обновляем позиции курьеров (вместимость уже обновлена в системе)
for courier in couriers:
    if courier.get("order") and courier["order"].get("status") == "onTheWay":
        active_order = courier["order"]
        courier['lat'] = active_order['lat']
        courier['lon'] = active_order['lon']
        print(f"Курьер {courier['id']} перемещен в ({active_order['lat']:.6f}, {active_order['lon']:.6f})", file=sys.stderr)

# 5. Назначаем остальные заказы
assigned_orders = []

remaining_orders = urgent_orders + regular_orders
if remaining_orders:
    print(f"Обрабатываем {len(urgent_orders)} срочных и {len(regular_orders)} обычных заказов...", file=sys.stderr)
    try:
        assigned_orders = solve_vrp_for_orders(couriers, remaining_orders)
        print(f"Назначено {len(assigned_orders)} заказов", file=sys.stderr)
    except Exception as e:
        print(f"Ошибка при решении для заказов: {e}", file=sys.stderr)
        assigned_orders = []

# 6. Объединяем результаты
all_routes = assigned_active + assigned_orders

# ИСПРАВЛЕНИЕ ДУБЛИКАТОВ: Объединяем маршруты одного курьера
print("=== ОБЪЕДИНЕНИЕ ДУБЛИКАТОВ КУРЬЕРОВ ===", file=sys.stderr)
consolidated_routes = {}

for route in all_routes:
    courier_id = route["courier_id"]
    if courier_id not in consolidated_routes:
        consolidated_routes[courier_id] = {
            "courier_id": courier_id,
            "orders": route["orders"].copy()
        }
        print(f"Создан маршрут для курьера {courier_id}: {len(route['orders'])} заказов", file=sys.stderr)
    else:
        # Объединяем заказы, избегая дубликатов
        existing_orders = set(consolidated_routes[courier_id]["orders"])
        new_orders = route["orders"]
        
        for order_id in new_orders:
            if order_id not in existing_orders:
                consolidated_routes[courier_id]["orders"].append(order_id)
                existing_orders.add(order_id)
        
        print(f"Объединен маршрут курьера {courier_id}: добавлено {len(new_orders)} заказов, всего {len(consolidated_routes[courier_id]['orders'])}", file=sys.stderr)

# Преобразуем обратно в список
all_routes = list(consolidated_routes.values())
print(f"После объединения: {len(all_routes)} уникальных курьеров", file=sys.stderr)

# 7. ПРОВЕРКА АКТИВНЫХ ЗАКАЗОВ
print("=== ПРОВЕРКА АКТИВНЫХ ЗАКАЗОВ ===", file=sys.stderr)

# Проверяем, что все активные заказы назначены правильным курьерам
for courier in couriers:
    if courier.get("order") and courier["order"].get("status") == "onTheWay":
        active_order_id = courier["order"]["orderId"]
        courier_id = courier["id"]
        
        # Ищем маршрут этого курьера
        courier_route = next((route for route in all_routes if route["courier_id"] == courier_id), None)
        
        if courier_route and active_order_id in courier_route["orders"]:
            print(f"✅ Курьер {courier_id}: активный заказ {active_order_id} найден в маршруте", file=sys.stderr)
        else:
            print(f"❌ Курьер {courier_id}: активный заказ {active_order_id} НЕ найден в маршруте", file=sys.stderr)

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
print(f"Остальных заказов назначено: {len(assigned_orders)}", file=sys.stderr)
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