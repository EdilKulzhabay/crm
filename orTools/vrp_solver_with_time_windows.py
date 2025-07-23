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

# Создаем список локаций: депо + курьеры + заказы
locations = [common_depot] + couriers + orders

# Создаем матрицу времени в пути
time_matrix = create_time_matrix(locations, speed_mps=speed_mps)

num_couriers = len(couriers)
num_orders = len(orders)
num_locations = len(locations)

print(f"\nКоличество курьеров: {num_couriers}", file=sys.stderr)
print(f"Количество заказов: {num_orders}", file=sys.stderr)
print(f"Общее количество локаций: {num_locations}", file=sys.stderr)

# ОТКРЫТЫЕ МАРШРУТЫ: Создаем виртуальные конечные точки
print("\n=== НАСТРОЙКА ОТКРЫТЫХ МАРШРУТОВ ===", file=sys.stderr)
starts = list(range(1, num_couriers + 1))

# Виртуальные конечные точки позволяют курьерам заканчивать маршрут в любом заказе
virtual_ends = []
for vehicle_id in range(num_couriers):
    virtual_end_index = num_locations + vehicle_id
    virtual_ends.append(virtual_end_index)

# Общее количество локаций включая виртуальные конечные точки
total_locations = num_locations + num_couriers

print(f"Стартовые точки курьеров: {starts}", file=sys.stderr)
print(f"Виртуальные конечные точки: {virtual_ends}", file=sys.stderr)
print(f"Общее количество локаций (с виртуальными): {total_locations}", file=sys.stderr)

manager = pywrapcp.RoutingIndexManager(total_locations, num_couriers, starts, virtual_ends)
routing = pywrapcp.RoutingModel(manager)

# Функция расчета времени для открытых маршрутов с учетом активных заказов
def time_callback(from_index, to_index):
    try:
        if from_index < 0 or to_index < 0:
            return 999999
        
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        
        # Если это переход к виртуальной конечной точке - стоимость 0
        if to_node >= num_locations:
            return 0
        
        # Если это переход от виртуальной конечной точки - недопустимо
        if from_node >= num_locations:
            return 999999
        
        # Базовое время в пути между точками
        travel_time = time_matrix[from_node][to_node]
        
        # Добавляем время обслуживания для заказов (15 минут)
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

# Добавляем ограничения для заказов
for order_idx in range(num_couriers + 1, num_locations):
    routing.AddDisjunction([manager.NodeToIndex(order_idx)], 10000)

# Предварительное определение типов курьеров для использования в ограничениях
courier_capacities = []
courier_types = []

for courier in couriers:
    capacity_12 = courier.get("capacity_12", 0)
    capacity_19 = courier.get("capacity_19", 0)
    
    # Проверяем, есть ли активный заказ
    has_active_order = (courier.get("order") and courier["order"].get("status") == "onTheWay")
    
    if capacity_12 == 0 and capacity_19 == 0:
        courier_type = 'empty'
        total_capacity = courier.get("capacity", 100)
        print(f"Курьер {courier['id']}: ПУСТОЙ (0 бутылок 12л и 19л), можно назначить любые заказы", file=sys.stderr)
    else:
        courier_type = 'loaded'
        total_capacity = capacity_12 + capacity_19
        
        bottles_info = []
        if capacity_12 > 0:
            bottles_info.append(f"12л={capacity_12}")
        if capacity_19 > 0:
            bottles_info.append(f"19л={capacity_19}")
        
        print(f"Курьер {courier['id']}: ЗАГРУЖЕННЫЙ ({', '.join(bottles_info)})", file=sys.stderr)
    
    courier_capacities.append(total_capacity)
    courier_types.append(courier_type)
    
    print(f"Курьер {courier['id']}: тип={courier_type}, вместимость={total_capacity} бутылок (12л={capacity_12}, 19л={capacity_19})", file=sys.stderr)

# ДОБАВЛЯЕМ СТРОГУЮ ПРОВЕРКУ СОВМЕСТИМОСТИ ЗАКАЗОВ С ТИПАМИ БУТЫЛОК КУРЬЕРОВ
print("\n=== ПРОВЕРКА СОВМЕСТИМОСТИ ЗАКАЗОВ С ТИПАМИ БУТЫЛОК КУРЬЕРОВ ===", file=sys.stderr)

for i, order in enumerate(orders):
    order_node_index = num_couriers + 1 + i
    order_routing_index = manager.NodeToIndex(order_node_index)
    
    order_bottles_12 = order.get("bottles_12", 0)
    order_bottles_19 = order.get("bottles_19", 0)
    
    # Определяем курьеров, которые могут выполнить этот заказ по типам бутылок
    compatible_courier_indices = []
    
    for courier_idx, courier in enumerate(couriers):
        courier_capacity_12 = courier.get("capacity_12", 0)
        courier_capacity_19 = courier.get("capacity_19", 0)
        courier_name = courier.get("id", "")
        courier_type = courier_types[courier_idx]
        
        # Проверяем специальные ограничения для курьера
        if courier_name in COURIER_SPECIAL_RESTRICTIONS:
            special_restrictions = COURIER_SPECIAL_RESTRICTIONS[courier_name]
            max_bottles_12 = special_restrictions["max_bottles_12"]
            max_bottles_19 = special_restrictions["max_bottles_19"]
            
            if order_bottles_12 <= max_bottles_12 and order_bottles_19 <= max_bottles_19:
                compatible_courier_indices.append(courier_idx)
                print(f"  ✅ Заказ {order['id']} совместим с курьером {courier_name} (специальные ограничения)", file=sys.stderr)
            else:
                print(f"  🚫 Заказ {order['id']} НЕ совместим с курьером {courier_name} (специальные ограничения)", file=sys.stderr)
        
        elif courier_type == 'empty':
            compatible_courier_indices.append(courier_idx)
            print(f"  ✅ Заказ {order['id']} совместим с ПУСТЫМ курьером {courier_name}", file=sys.stderr)
        
        else:
            can_handle_12 = (order_bottles_12 == 0) or (courier_capacity_12 > 0 and courier_capacity_12 >= order_bottles_12)
            can_handle_19 = (order_bottles_19 == 0) or (courier_capacity_19 > 0 and courier_capacity_19 >= order_bottles_19)
            
            if can_handle_12 and can_handle_19:
                compatible_courier_indices.append(courier_idx)
                print(f"  ✅ Заказ {order['id']} совместим с ЗАГРУЖЕННЫМ курьером {courier_name}", file=sys.stderr)
            else:
                reasons = []
                if not can_handle_12:
                    if order_bottles_12 > 0 and courier_capacity_12 == 0:
                        reasons.append(f"нет 12л бутылок для заказа с {order_bottles_12} x 12л")
                    elif order_bottles_12 > courier_capacity_12:
                        reasons.append(f"недостаточно 12л: нужно {order_bottles_12}, есть {courier_capacity_12}")
                
                if not can_handle_19:
                    if order_bottles_19 > 0 and courier_capacity_19 == 0:
                        reasons.append(f"нет 19л бутылок для заказа с {order_bottles_19} x 19л")
                    elif order_bottles_19 > courier_capacity_19:
                        reasons.append(f"недостаточно 19л: нужно {order_bottles_19}, есть {courier_capacity_19}")
                
                print(f"  🚫 Заказ {order['id']} НЕ совместим с курьером {courier_name} ({'; '.join(reasons)})", file=sys.stderr)
    
    # Применяем ограничения совместимости
    if not compatible_courier_indices:
        routing.AddDisjunction([order_routing_index], 100000)
        print(f"  ❌ ЗАКАЗ {order['id']} ИСКЛЮЧЕН: ни один курьер не может его выполнить", file=sys.stderr)
    else:
        if order['id'] in courier_restrictions:
            allowed_courier_ids = courier_restrictions[order['id']]
            if allowed_courier_ids:
                restricted_courier_indices = []
                for courier_id in allowed_courier_ids:
                    for j, courier in enumerate(couriers):
                        if str(courier['id']) == str(courier_id):
                            restricted_courier_indices.append(j)
                            break
                
                final_allowed_indices = list(set(compatible_courier_indices) & set(restricted_courier_indices))
                
                if final_allowed_indices:
                    routing.SetAllowedVehiclesForIndex(final_allowed_indices, order_routing_index)
                    print(f"  ✅ Заказ {order['id']}: разрешен для курьеров с индексами {final_allowed_indices}", file=sys.stderr)
                else:
                    routing.AddDisjunction([order_routing_index], 100000)
                    print(f"  ❌ ЗАКАЗ {order['id']} ИСКЛЮЧЕН: нет совместимых курьеров", file=sys.stderr)
            else:
                routing.AddDisjunction([order_routing_index], 100000)
                print(f"  ❌ ЗАКАЗ {order['id']} ИСКЛЮЧЕН: полностью исключен ограничениями", file=sys.stderr)
        else:
            routing.SetAllowedVehiclesForIndex(compatible_courier_indices, order_routing_index)
            print(f"  ✅ Заказ {order['id']}: разрешен для совместимых курьеров с индексами {compatible_courier_indices}", file=sys.stderr)

# Добавляем жесткие ограничения для активных заказов
print("\n=== НАСТРОЙКА ОГРАНИЧЕНИЙ ДЛЯ АКТИВНЫХ ЗАКАЗОВ ===", file=sys.stderr)
for vehicle_id, courier in enumerate(couriers):
    if courier.get("order") and courier["order"].get("status") == "onTheWay":
        active_order_id = courier["order"]["orderId"]
        
        active_order_index = None
        for i, order in enumerate(orders):
            if order["id"] == active_order_id:
                active_order_index = num_couriers + 1 + i
                break
        
        if active_order_index is not None:
            active_order_routing_index = manager.NodeToIndex(active_order_index)
            
            routing.SetAllowedVehiclesForIndex([vehicle_id], active_order_routing_index)
            routing.AddDisjunction([active_order_routing_index], 100000)
            
            courier_type = courier_types[vehicle_id]
            
            routing.solver().Add(
                routing.NextVar(routing.Start(vehicle_id)) == active_order_routing_index
            )
            
            print(f"✅ Курьер {courier['id']} (тип: {courier_type}) должен СНАЧАЛА доехать до активного заказа {active_order_id}", file=sys.stderr)

# Функции для подсчета бутылок
def bottles_12_callback(from_index, to_index):
    try:
        if from_index < 0 or to_index < 0:
            return 0
        
        to_node = manager.IndexToNode(to_index)
        if to_node >= num_couriers + 1 and to_node < num_locations:
            order = orders[to_node - num_couriers - 1]
            return order.get("bottles_12") or 0
        return 0
    except Exception as e:
        print(f"Ошибка в bottles_12_callback: {e}", file=sys.stderr)
        return 0

def bottles_19_callback(from_index, to_index):
    try:
        if from_index < 0 or to_index < 0:
            return 0
        
        to_node = manager.IndexToNode(to_index)
        if to_node >= num_couriers + 1 and to_node < num_locations:
            order = orders[to_node - num_couriers - 1]
            return order.get("bottles_19") or 0
        return 0
    except Exception as e:
        print(f"Ошибка в bottles_19_callback: {e}", file=sys.stderr)
        return 0

bottles_12_callback_index = routing.RegisterTransitCallback(bottles_12_callback)
bottles_19_callback_index = routing.RegisterTransitCallback(bottles_19_callback)

# Раздельные ограничения на бутылки 12л и 19л для каждого курьера
courier_capacities_12 = []
courier_capacities_19 = []

for courier in couriers:
    capacity_12 = courier.get("capacity_12", 0)
    capacity_19 = courier.get("capacity_19", 0)
    courier_type = courier_types[couriers.index(courier)]
    courier_name = courier.get("id", "")
    
    if courier_name in COURIER_SPECIAL_RESTRICTIONS:
        special_restrictions = COURIER_SPECIAL_RESTRICTIONS[courier_name]
        max_bottles_12 = special_restrictions["max_bottles_12"]
        max_bottles_19 = special_restrictions["max_bottles_19"]
        
        courier_capacities_12.append(max_bottles_12)
        courier_capacities_19.append(max_bottles_19)
        
    elif courier_type == 'empty':
        total_capacity = courier.get("capacity", 100)
        courier_capacities_12.append(total_capacity)
        courier_capacities_19.append(total_capacity)
    else:
        courier_capacities_12.append(capacity_12 if capacity_12 > 0 else 0)
        courier_capacities_19.append(capacity_19 if capacity_19 > 0 else 0)

# Добавляем раздельные размерности для бутылок 12л и 19л
bottles_12_dimension = routing.AddDimensionWithVehicleCapacity(
    bottles_12_callback_index,
    0,
    courier_capacities_12,
    True,
    "Bottles12"
)

bottles_19_dimension = routing.AddDimensionWithVehicleCapacity(
    bottles_19_callback_index,
    0,
    courier_capacities_19,
    True,
    "Bottles19"
)

# Добавляем размерность для времени
routing.AddDimension(
    transit_callback_index,
    7200,  # slack_max (2 часа)
    86400,  # максимальное время маршрута (24 часа)
    False,  # start_cumul_to_zero - НЕ устанавливаем в ноль
    'Time'
)
time_dimension = routing.GetDimensionOrDie('Time')

# Устанавливаем начальное время для всех курьеров равным текущему времени
for i in range(num_couriers):
    start_index = routing.Start(i)
    time_dimension.CumulVar(start_index).SetRange(current_time_in_seconds, current_time_in_seconds)
    print(f"Курьер {i} ({couriers[i]['id']}): начальное время = {current_time_in_seconds} сек", file=sys.stderr)

# Временные окна для заказов
for order in orders:
    if 'date.time' in order:
        order_node_index = None
        for j, loc in enumerate(locations[:-1]):
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

# Улучшаем параметры поиска
search_params = pywrapcp.DefaultRoutingSearchParameters()
search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
search_params.time_limit.seconds = 30

print("Начинаем решение с временными окнами...", file=sys.stderr)
solution = routing.SolveWithParameters(search_params)

if solution:
    print("\n=== МАРШРУТЫ НАЙДЕНЫ ===", file=sys.stderr)
    print(f"Общая стоимость: {solution.ObjectiveValue()} секунд", file=sys.stderr)
    
    routes = []
    total_time = 0
    active_couriers = 0
    
    for vehicle_id in range(num_couriers):
        index = routing.Start(vehicle_id)
        route_time = 0
        route_orders = []
        
        print(f"\nМаршрут курьера {couriers[vehicle_id]['id']}:", file=sys.stderr)
        
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            
            if node_index >= num_couriers + 1 and node_index < num_locations:
                order = orders[node_index - num_couriers - 1]
                route_orders.append(order["id"])
                
                # Получаем время прибытия
                route_time = solution.Value(time_dimension.CumulVar(index))
                hours = int(route_time // 3600)
                minutes = int((route_time % 3600) // 60)
                time_str = f"{hours:02d}:{minutes:02d}"
                
                print(f"  -> Заказ {order['id']}: время прибытия {time_str}", file=sys.stderr)
            
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            
            if not routing.IsEnd(index):
                route_time += routing.GetArcCostForVehicle(previous_index, index, vehicle_id)
        
        if route_orders:
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
            courier = couriers[vehicle_id]
            courier_type = courier_types[vehicle_id]
            courier_capacity_12 = courier.get("capacity_12", 0)
            courier_capacity_19 = courier.get("capacity_19", 0)
            courier_name = courier.get("id", "")
            
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
            
            total_time += route_time
            active_couriers += 1
            
            route_info = {
                "courier_id": couriers[vehicle_id]["id"],
                "orders": route_orders,
                "orders_count": len(route_orders),
                "travel_time_seconds": route_time,
                "travel_time_minutes": round(route_time/60, 2),
                "required_bottles": {
                    "bottles_12": total_bottles_12,
                    "bottles_19": total_bottles_19,
                    "total": total_bottles
                },
                "courier_should_take": courier_should_take,
                "capacity_utilization": {
                    "percent": round(100 * total_bottles / max(courier_total_capacity, 1), 1)
                },
                "has_active_order": bool(couriers[vehicle_id].get("order")),
                "courier_type": courier_type
            }
            
            routes.append(route_info)
        else:
            print(f"  Нет заказов", file=sys.stderr)
    
    print(f"\n=== РЕЗУЛЬТАТЫ РАСПРЕДЕЛЕНИЯ ===", file=sys.stderr)
    print(f"Общее время: {total_time} секунд ({total_time/3600:.2f} часов)", file=sys.stderr)
    print(f"Используется курьеров: {active_couriers} из {num_couriers}", file=sys.stderr)
    print(f"Всего заказов обслужено: {sum(len(r['orders']) for r in routes)} из {num_orders}", file=sys.stderr)
    
    print(json.dumps(routes, ensure_ascii=False))
    
else:
    print("Маршруты не найдены!", file=sys.stderr)
    print("[]") 