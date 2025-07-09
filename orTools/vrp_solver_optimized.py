from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import math
import sys
import json

input_data = json.load(sys.stdin)

# Общая точка возврата для всех курьеров
common_depot = {"id": "depot", "lat": 43.16857, "lon": 76.89642}

couriers = input_data["couriers"]
orders = input_data["orders"]
courier_restrictions = input_data["courier_restrictions"]

# ПРОВЕРКИ НА КОРРЕКТНОСТЬ ДАННЫХ
print("=== ПРОВЕРКА ВХОДНЫХ ДАННЫХ ===", file=sys.stderr)

# Проверяем курьеров
valid_couriers = []
for i, courier in enumerate(couriers):
    if courier.get("lat") is not None and courier.get("lon") is not None:
        valid_couriers.append(courier)
        print(f"✅ Курьер {courier['id']}: ({courier['lat']}, {courier['lon']})", file=sys.stderr)
    else:
        print(f"❌ Курьер {courier['id']}: отсутствуют координаты", file=sys.stderr)

# Проверяем заказы
valid_orders = []
for i, order in enumerate(orders):
    if order.get("lat") is not None and order.get("lon") is not None:
        valid_orders.append(order)
        print(f"✅ Заказ {order['id']}: ({order['lat']}, {order['lon']})", file=sys.stderr)
    else:
        print(f"❌ Заказ {order['id']}: отсутствуют координаты", file=sys.stderr)

# Обновляем списки валидными данными
couriers = valid_couriers
orders = valid_orders

print(f"\nВалидные курьеры: {len(couriers)}", file=sys.stderr)
print(f"Валидные заказы: {len(orders)}", file=sys.stderr)

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

# Выводим информацию о курьерах и их общей вместимости
print("\n=== ИНФОРМАЦИЯ О КУРЬЕРАХ ===", file=sys.stderr)
for courier in couriers:
    # Проверяем, есть ли поле capacity или нужно считать из capacity_12 и capacity_19
    if 'capacity' in courier:
        total_capacity = courier.get("capacity", 0)
        capacity_12 = courier.get("capacity_12", 0)
        capacity_19 = courier.get("capacity_19", 0)
    else:
        capacity_12 = courier.get("capacity_12", 0)
        capacity_19 = courier.get("capacity_19", 0)
        total_capacity = capacity_12 + capacity_19
    
    print(f"Курьер {courier['id']}: общая вместимость = {total_capacity} бутылок", file=sys.stderr)

# Выводим информацию о заказах
print("\n=== ИНФОРМАЦИЯ О ЗАКАЗАХ ===", file=sys.stderr)
for order in orders:
    total_bottles = order.get("bottles_12", 0) + order.get("bottles_19", 0)
    print(f"Заказ {order['id']}: {order.get('bottles_12', 0)} x 12л + {order.get('bottles_19', 0)} x 19л = {total_bottles} бутылок", file=sys.stderr)

print("Ограничения на курьеров:", file=sys.stderr)
for order_id, allowed_couriers in courier_restrictions.items():
    if not allowed_couriers:
        print(f"  {order_id}: исключен из обслуживания", file=sys.stderr)
    else:
        courier_names = [couriers[i]['id'] for i in allowed_couriers if i < len(couriers)]
        print(f"  {order_id}: только {', '.join(courier_names)}", file=sys.stderr)

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

# Функция расчета расстояний для открытых маршрутов
def distance_callback(from_index, to_index):
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
        
        return distance_matrix[from_node][to_node]
    except Exception as e:
        print(f"Ошибка в distance_callback: {e}", file=sys.stderr)
        return 999999

transit_callback_index = routing.RegisterTransitCallback(distance_callback)
routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

# Добавляем ограничения для заказов
for order_idx in range(num_couriers + 1, num_locations):
    routing.AddDisjunction([manager.NodeToIndex(order_idx)], 10000)

# Применяем ограничения на курьеров (только из courier_restrictions)
for i, order in enumerate(orders):
    order_node_index = num_couriers + 1 + i
    order_routing_index = manager.NodeToIndex(order_node_index)
    
    if order['id'] in courier_restrictions:
        allowed_couriers = courier_restrictions[order['id']]
        if not allowed_couriers:
            routing.AddDisjunction([order_routing_index], 100000)
        else:
            routing.SetAllowedVehiclesForIndex(allowed_couriers, order_routing_index)

# БАЛАНСИРОВКА НАГРУЗКИ
ideal_orders_per_courier = num_orders // num_couriers
remainder = num_orders % num_couriers

min_orders_per_courier = ideal_orders_per_courier
max_orders_per_courier = ideal_orders_per_courier + (1 if remainder > 0 else 0)

print(f"\nИдеальное количество заказов на курьера: {ideal_orders_per_courier}", file=sys.stderr)
print(f"Остаток: {remainder}", file=sys.stderr)
print(f"Минимум заказов на курьера: {min_orders_per_courier}", file=sys.stderr)
print(f"Максимум заказов на курьера: {max_orders_per_courier}", file=sys.stderr)

# Функция для подсчета заказов
def unit_callback(from_index, to_index):
    try:
        if from_index < 0 or to_index < 0:
            return 0
        
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        
        # Увеличиваем счетчик только при посещении заказа
        if to_node >= num_couriers + 1 and to_node < num_locations:
            return 1
        return 0
    except Exception as e:
        print(f"Ошибка в unit_callback: {e}", file=sys.stderr)
        return 0

unit_callback_index = routing.RegisterTransitCallback(unit_callback)

# Функция для подсчета общего количества бутылок в заказе
def total_bottles_callback(from_index, to_index):
    try:
        if from_index < 0 or to_index < 0:
            return 0
        
        to_node = manager.IndexToNode(to_index)
        # Если переходим к заказу, возвращаем общее количество бутылок
        if to_node >= num_couriers + 1 and to_node < num_locations:
            order = orders[to_node - num_couriers - 1]
            return order.get("bottles_12", 0) + order.get("bottles_19", 0)
        return 0
    except Exception as e:
        print(f"Ошибка в total_bottles_callback: {e}", file=sys.stderr)
        return 0

total_bottles_callback_index = routing.RegisterTransitCallback(total_bottles_callback)

# Добавляем размерность для общей вместимости курьеров
courier_capacities = []
for courier in couriers:
    # Проверяем, есть ли поле capacity или нужно считать из capacity_12 и capacity_19
    if 'capacity' in courier:
        total_capacity = courier.get("capacity", 0)
    else:
        total_capacity = courier.get("capacity_12", 0) + courier.get("capacity_19", 0)
    
    courier_capacities.append(total_capacity)
    print(f"Курьер {courier['id']}: общая вместимость = {total_capacity}", file=sys.stderr)

routing.AddDimensionWithVehicleCapacity(
    total_bottles_callback_index,
    0,  # no slack
    courier_capacities,  # общая вместимость каждого курьера
    True,
    "TotalBottles"
)

# Добавляем ограничения на расстояние
for vehicle_id in range(num_couriers):
    routing.AddDimension(
        transit_callback_index,
        0,  # no slack
        50000,  # максимальное расстояние на курьера (50 км)
        True,  # start cumul to zero
        f"Distance_{vehicle_id}"
    )

# Добавляем размерность для подсчета заказов
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
    order_count_dimension.SetCumulVarSoftLowerBound(
        routing.End(vehicle_id), 
        min_orders_per_courier, 
        10000
    )
    
    order_count_dimension.SetCumulVarSoftUpperBound(
        routing.End(vehicle_id), 
        max_orders_per_courier, 
        10000
    )

# Штраф за использование курьера
for vehicle_id in range(num_couriers):
    routing.SetFixedCostOfVehicle(5000, vehicle_id)

# ПАРАМЕТРЫ ПОИСКА
search_params = pywrapcp.DefaultRoutingSearchParameters()
search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.SAVINGS
search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.SIMULATED_ANNEALING
search_params.time_limit.seconds = 120
search_params.solution_limit = 100
search_params.lns_time_limit.seconds = 30

print("Начинаем решение с открытыми маршрутами...", file=sys.stderr)
solution = routing.SolveWithParameters(search_params)

if solution:
    print("\n=== ОТКРЫТЫЕ МАРШРУТЫ НАЙДЕНЫ ===", file=sys.stderr)
    print(f"Общая стоимость: {solution.ObjectiveValue()} метров", file=sys.stderr)
    print(f"Общая стоимость (без базовых затрат): {solution.ObjectiveValue() - num_couriers * 5000} метров", file=sys.stderr)
    print(f"Общая стоимость: {(solution.ObjectiveValue() - num_couriers * 5000)/1000:.2f} км", file=sys.stderr)
    
    routes = []
    total_distance = 0
    active_couriers = 0
    
    for vehicle_id in range(num_couriers):
        index = routing.Start(vehicle_id)
        route_distance = 0
        route_orders = []
        
        print(f"\nМаршрут курьера {couriers[vehicle_id]['id']}:", file=sys.stderr)
        print(f"  Старт: ({couriers[vehicle_id]['lat']}, {couriers[vehicle_id]['lon']})", file=sys.stderr)
        
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            
            if node_index == 0:
                print(f"  -> Депо: ({common_depot['lat']}, {common_depot['lon']})", file=sys.stderr)
            elif node_index >= num_couriers + 1 and node_index < num_locations:
                order = orders[node_index - num_couriers - 1]
                route_orders.append(order["id"])
                print(f"  -> Заказ {order['id']}: ({order['lat']}, {order['lon']})", file=sys.stderr)
            elif node_index >= num_locations:
                print(f"  -> Завершение маршрута", file=sys.stderr)
            
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            
            if not routing.IsEnd(index):
                route_distance += routing.GetArcCostForVehicle(previous_index, index, vehicle_id)
        
        if route_orders:
            # Рассчитываем необходимые бутылки для этого курьера
            total_bottles_12 = 0
            total_bottles_19 = 0
            total_bottles = 0
            
            for order_id in route_orders:
                order_data = next((o for o in orders if o["id"] == order_id), None)
                if order_data:
                    bottles_12 = order_data.get("bottles_12", 0)
                    bottles_19 = order_data.get("bottles_19", 0)
                    total_bottles_12 += bottles_12
                    total_bottles_19 += bottles_19
                    total_bottles += bottles_12 + bottles_19
            
            # Проверяем вместимость курьера
            if 'capacity' in couriers[vehicle_id]:
                courier_total_capacity = couriers[vehicle_id].get("capacity", 0)
                # Для проверки ошибок используем максимальные значения
                courier_capacity_12 = courier_total_capacity
                courier_capacity_19 = courier_total_capacity
            else:
                courier_capacity_12 = couriers[vehicle_id].get("capacity_12", 0)
                courier_capacity_19 = couriers[vehicle_id].get("capacity_19", 0)
                courier_total_capacity = courier_capacity_12 + courier_capacity_19
            
            # Проверяем, помещается ли все в общую вместимость
            if total_bottles > courier_total_capacity:
                print(f"  ❌ ОШИБКА: Требуется {total_bottles} бутылок, но общая вместимость {courier_total_capacity}", file=sys.stderr)
            
            # Курьер должен взять точно то количество, которое требуется для заказов
            bottles_12_needed = total_bottles_12
            bottles_19_needed = total_bottles_19
            
            print(f"  Количество заказов: {len(route_orders)}", file=sys.stderr)
            print(f"  Требуется бутылок: 12л={total_bottles_12}, 19л={total_bottles_19}, всего={total_bottles}", file=sys.stderr)
            print(f"  Курьер должен взять: 12л={bottles_12_needed}, 19л={bottles_19_needed}", file=sys.stderr)
            print(f"  Использование вместимости: {100*total_bottles/max(courier_total_capacity,1):.1f}%", file=sys.stderr)
            
            total_distance += route_distance
            active_couriers += 1
            
            routes.append({
                "courier_id": couriers[vehicle_id]["id"],
                "orders": route_orders,
                "orders_count": len(route_orders),
                "distance_meters": route_distance,
                "distance_km": round(route_distance/1000, 2),
                "required_bottles": {
                    "bottles_12": total_bottles_12,
                    "bottles_19": total_bottles_19,
                    "total": total_bottles
                },
                "courier_should_take": {
                    "bottles_12": bottles_12_needed,
                    "bottles_19": bottles_19_needed,
                    "total": bottles_12_needed + bottles_19_needed
                },
                "capacity_utilization": {
                    "percent": round(100 * total_bottles / max(courier_total_capacity, 1), 1)
                }
            })
        else:
            print(f"  Нет заказов", file=sys.stderr)
    
    # Проверяем балансировку
    orders_counts = [len(route["orders"]) for route in routes]
    max_orders = max(orders_counts) if orders_counts else 0
    min_orders = min(orders_counts) if orders_counts else 0
    balance_score = max_orders - min_orders
    
    print(f"\n=== РЕЗУЛЬТАТЫ РАСПРЕДЕЛЕНИЯ ===", file=sys.stderr)
    print(f"Общее расстояние: {total_distance} метров ({total_distance/1000:.2f} км)", file=sys.stderr)
    print(f"Используется курьеров: {active_couriers} из {num_couriers}", file=sys.stderr)
    print(f"Всего заказов обслужено: {sum(len(r['orders']) for r in routes)} из {num_orders}", file=sys.stderr)
    print(f"Балансировка нагрузки: {balance_score} (0 = идеальная балансировка)", file=sys.stderr)
    print(f"Распределение заказов: {orders_counts}", file=sys.stderr)
    
    # Статистика по бутылкам
    print(f"\n=== СТАТИСТИКА ПО БУТЫЛКАМ ===", file=sys.stderr)
    for route in routes:
        courier_id = route["courier_id"]
        required = route["required_bottles"]
        should_take = route["courier_should_take"]
        utilization = route["capacity_utilization"]["percent"]
        
        print(f"  {courier_id}:", file=sys.stderr)
        print(f"    Требуется: 12л={required['bottles_12']}, 19л={required['bottles_19']}", file=sys.stderr)
        print(f"    Взять: 12л={should_take['bottles_12']}, 19л={should_take['bottles_19']}", file=sys.stderr)
        print(f"    Использование: {utilization}%", file=sys.stderr)
    
    # Проверяем необслуженные заказы
    served_orders = set()
    for route in routes:
        served_orders.update(route["orders"])
    
    unserved_orders = []
    for order in orders:
        if order["id"] not in served_orders:
            unserved_orders.append(order["id"])
    
    if unserved_orders:
        print(f"Необслуженные заказы: {unserved_orders}", file=sys.stderr)
    
    print(json.dumps(routes, ensure_ascii=False))
    
else:
    print("Маршруты не найдены!", file=sys.stderr)
    print("[]") 