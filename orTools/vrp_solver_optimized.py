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
        print(f"Курьер {courier['id']}: общая вместимость = {total_capacity} бутылок", file=sys.stderr)
    else:
        capacity_12 = courier.get("capacity_12", 0)
        capacity_19 = courier.get("capacity_19", 0)
        total_capacity = capacity_12 + capacity_19
        print(f"Курьер {courier['id']}: 12л={capacity_12}, 19л={capacity_19}, всего={total_capacity} бутылок", file=sys.stderr)

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

# Функция для оптимизации порядка заказов при необходимости доукомплектования
def optimize_route_for_refill(route_orders, courier_id, refill_needed, orders, couriers, common_depot):
    """
    Оптимизирует порядок заказов для курьера, которому нужно доукомплектование.
    Учитывает реальные потребности в бутылках и находит оптимальную точку доукомплектования.
    """
    if not refill_needed or not route_orders:
        return route_orders, False, None
    
    courier = couriers[courier_id]
    current_12 = courier.get("capacity_12", 0)
    current_19 = courier.get("capacity_19", 0)
    
    # Вычисляем расстояния и создаем информацию о заказах
    order_distances = []
    for order_id in route_orders:
        order_data = next((o for o in orders if o["id"] == order_id), None)
        if order_data:
            distance_to_depot = haversine(
                order_data["lat"], order_data["lon"],
                common_depot["lat"], common_depot["lon"]
            )
            distance_to_start = haversine(
                order_data["lat"], order_data["lon"],
                courier["lat"], courier["lon"]
            )
            order_distances.append({
                "order_id": order_id,
                "distance_to_depot": distance_to_depot,
                "distance_to_start": distance_to_start,
                "order_data": order_data
            })
    
    # ВАРИАНТ 1: Доукомплектование в начале
    distance_start_to_depot = haversine(
        courier["lat"], courier["lon"],
        common_depot["lat"], common_depot["lon"]
    )
    
    orders_sorted_by_depot = sorted(order_distances, key=lambda x: x["distance_to_depot"])
    
    variant1_distance = distance_start_to_depot
    current_lat, current_lon = common_depot["lat"], common_depot["lon"]
    
    for order_info in orders_sorted_by_depot:
        order_data = order_info["order_data"]
        distance = haversine(current_lat, current_lon, order_data["lat"], order_data["lon"])
        variant1_distance += distance
        current_lat, current_lon = order_data["lat"], order_data["lon"]
    
    # ВАРИАНТ 2: Умная стратегия - найти оптимальную точку доукомплектования
    from itertools import permutations
    
    best_strategy = None
    best_distance = float('inf')
    
    # Пробуем все возможные точки доукомплектования (после каждого заказа)
    for refill_after_index in range(len(route_orders) + 1):  # +1 для доукомплектования в начале
        # Создаем стратегию: заказы до доукомплектования и после
        orders_before = route_orders[:refill_after_index]
        orders_after = route_orders[refill_after_index:]
        
        # Проверяем, можем ли выполнить заказы до доукомплектования с текущими запасами
        total_12_before = 0
        total_19_before = 0
        
        for order_id in orders_before:
            order_data = next((o for o in orders if o["id"] == order_id), None)
            if order_data:
                total_12_before += order_data.get("bottles_12", 0)
                total_19_before += order_data.get("bottles_19", 0)
        
        # Если можем выполнить заказы до доукомплектования
        if total_12_before <= current_12 and total_19_before <= current_19:
            # Рассчитываем общее расстояние для этой стратегии
            strategy_distance = 0
            current_lat, current_lon = courier["lat"], courier["lon"]
            
            # Выполняем заказы до доукомплектования (оптимизируем порядок)
            if orders_before:
                remaining_orders = orders_before[:]
                while remaining_orders:
                    closest_order_id = min(remaining_orders, key=lambda oid: 
                                         haversine(current_lat, current_lon, 
                                                  next(o for o in orders if o["id"] == oid)["lat"],
                                                  next(o for o in orders if o["id"] == oid)["lon"]))
                    remaining_orders.remove(closest_order_id)
                    order_data = next(o for o in orders if o["id"] == closest_order_id)
                    
                    distance = haversine(current_lat, current_lon, order_data["lat"], order_data["lon"])
                    strategy_distance += distance
                    current_lat, current_lon = order_data["lat"], order_data["lon"]
            
            # Поездка в депо для доукомплектования
            distance_to_depot = haversine(current_lat, current_lon, common_depot["lat"], common_depot["lon"])
            strategy_distance += distance_to_depot
            current_lat, current_lon = common_depot["lat"], common_depot["lon"]
            
            # Выполняем заказы после доукомплектования (оптимизируем порядок)
            if orders_after:
                remaining_orders = orders_after[:]
                while remaining_orders:
                    closest_order_id = min(remaining_orders, key=lambda oid: 
                                         haversine(current_lat, current_lon, 
                                                  next(o for o in orders if o["id"] == oid)["lat"],
                                                  next(o for o in orders if o["id"] == oid)["lon"]))
                    remaining_orders.remove(closest_order_id)
                    order_data = next(o for o in orders if o["id"] == closest_order_id)
                    
                    distance = haversine(current_lat, current_lon, order_data["lat"], order_data["lon"])
                    strategy_distance += distance
                    current_lat, current_lon = order_data["lat"], order_data["lon"]
            
            # Сохраняем лучшую стратегию
            if strategy_distance < best_distance:
                best_distance = strategy_distance
                best_strategy = {
                    "refill_after_index": refill_after_index,
                    "orders_before": orders_before,
                    "orders_after": orders_after,
                    "distance": strategy_distance
                }
    
    # Выбираем лучший вариант
    print(f"  🚀 Сравнение вариантов доукомплектования:", file=sys.stderr)
    print(f"    Вариант 1 (доукомплектование в начале): {variant1_distance:.2f} км", file=sys.stderr)
    
    if best_strategy is not None:
        print(f"    Вариант 2 (умная стратегия): {best_distance:.2f} км", file=sys.stderr)
    
    if variant1_distance <= best_distance or best_strategy is None:
        print(f"    ✅ Выбран вариант 1: доукомплектование в начале", file=sys.stderr)
        optimized_route = [order_info["order_id"] for order_info in orders_sorted_by_depot]
        refill_point = {
            "after_order_index": None,
            "after_order_id": None,
            "before_order_id": optimized_route[0] if optimized_route else None,
            "before_order_index": 0
        }
        return optimized_route, True, refill_point
    else:
        print(f"    ✅ Выбран вариант 2: умная стратегия", file=sys.stderr)
        
        # Формируем оптимальный маршрут
        optimized_route = []
        
        # Добавляем заказы до доукомплектования (в оптимальном порядке)
        if best_strategy["orders_before"]:
            current_lat, current_lon = courier["lat"], courier["lon"]
            remaining_orders = best_strategy["orders_before"][:]
            
            while remaining_orders:
                closest_order_id = min(remaining_orders, key=lambda oid: 
                                     haversine(current_lat, current_lon, 
                                              next(o for o in orders if o["id"] == oid)["lat"],
                                              next(o for o in orders if o["id"] == oid)["lon"]))
                remaining_orders.remove(closest_order_id)
                optimized_route.append(closest_order_id)
                order_data = next(o for o in orders if o["id"] == closest_order_id)
                current_lat, current_lon = order_data["lat"], order_data["lon"]
        
        # Добавляем заказы после доукомплектования (в оптимальном порядке)
        if best_strategy["orders_after"]:
            current_lat, current_lon = common_depot["lat"], common_depot["lon"]
            remaining_orders = best_strategy["orders_after"][:]
            
            while remaining_orders:
                closest_order_id = min(remaining_orders, key=lambda oid: 
                                     haversine(current_lat, current_lon, 
                                              next(o for o in orders if o["id"] == oid)["lat"],
                                              next(o for o in orders if o["id"] == oid)["lon"]))
                remaining_orders.remove(closest_order_id)
                optimized_route.append(closest_order_id)
                order_data = next(o for o in orders if o["id"] == closest_order_id)
                current_lat, current_lon = order_data["lat"], order_data["lon"]
        
        before_refill_count = len(best_strategy["orders_before"])
        after_refill_count = len(best_strategy["orders_after"])
        
        print(f"      До доукомплектования: {before_refill_count} заказов", file=sys.stderr)
        print(f"      После доукомплектования: {after_refill_count} заказов", file=sys.stderr)
        print(f"      Оптимальный порядок: {optimized_route}", file=sys.stderr)
        
        # Создаем информацию о точке доукомплектования
        if best_strategy["refill_after_index"] == 0:
            print(f"      Доукомплектование в начале маршрута", file=sys.stderr)
            refill_point = {
                "after_order_index": None,
                "after_order_id": None,
                "before_order_id": optimized_route[0] if optimized_route else None,
                "before_order_index": 0
            }
        else:
            refill_after_order = best_strategy["orders_before"][-1]
            print(f"      Доукомплектование после заказа {refill_after_order}", file=sys.stderr)
            refill_point = {
                "after_order_index": best_strategy["refill_after_index"] - 1,
                "after_order_id": refill_after_order,
                "before_order_id": optimized_route[best_strategy["refill_after_index"]] if best_strategy["refill_after_index"] < len(optimized_route) else None,
                "before_order_index": best_strategy["refill_after_index"]
            }
        
        return optimized_route, best_strategy["refill_after_index"] == 0, refill_point  # True если доукомплектование в начале

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

# Функция для подсчета бутылок 12л
def bottle12_callback(from_index, to_index):
    try:
        if from_index < 0 or to_index < 0:
            return 0
        
        to_node = manager.IndexToNode(to_index)
        if to_node >= num_couriers + 1 and to_node < num_locations:
            return orders[to_node - num_couriers - 1].get("bottles_12", 0)
        return 0
    except Exception as e:
        print(f"Ошибка в bottle12_callback: {e}", file=sys.stderr)
        return 0

bottle12_callback_index = routing.RegisterTransitCallback(bottle12_callback)

# Функция для подсчета бутылок 19л
def bottle19_callback(from_index, to_index):
    try:
        if from_index < 0 or to_index < 0:
            return 0
        
        to_node = manager.IndexToNode(to_index)
        if to_node >= num_couriers + 1 and to_node < num_locations:
            return orders[to_node - num_couriers - 1].get("bottles_19", 0)
        return 0
    except Exception as e:
        print(f"Ошибка в bottle19_callback: {e}", file=sys.stderr)
        return 0

bottle19_callback_index = routing.RegisterTransitCallback(bottle19_callback)

# Определяем, какие курьеры имеют конкретные ограничения по типам бутылок
couriers_with_specific_capacity = []
couriers_with_general_capacity = []

for i, courier in enumerate(couriers):
    # Курьер имеет конкретные типы бутылок, если у него есть хотя бы одна бутылка 12л или 19л
    has_specific_bottles = (courier.get("capacity_12", 0) > 0 or courier.get("capacity_19", 0) > 0)
    
    if has_specific_bottles:
        couriers_with_specific_capacity.append(i)
    else:
        couriers_with_general_capacity.append(i)

print(f"\nКурьеры с общей вместимостью: {[couriers[i]['id'] for i in couriers_with_general_capacity]}", file=sys.stderr)
print(f"Курьеры с конкретными типами бутылок: {[couriers[i]['id'] for i in couriers_with_specific_capacity]}", file=sys.stderr)

# Добавляем размерности в зависимости от типа курьеров
if couriers_with_general_capacity:
    # Для курьеров с общей вместимостью - только общее ограничение
    courier_capacities = []
    for courier in couriers:
        if 'capacity' in courier:
            total_capacity = courier.get("capacity", 0)
        else:
            total_capacity = courier.get("capacity_12", 0) + courier.get("capacity_19", 0)
        courier_capacities.append(total_capacity)
    
    routing.AddDimensionWithVehicleCapacity(
        total_bottles_callback_index,
        0,  # no slack
        courier_capacities,  # общая вместимость каждого курьера
        True,
        "TotalBottles"
    )

if couriers_with_specific_capacity:
    # Для курьеров с конкретными типами - отдельные ограничения
    courier_capacities_12 = []
    courier_capacities_19 = []
    
    for courier in couriers:
        # Курьер имеет конкретные типы бутылок, если у него есть хотя бы одна бутылка 12л или 19л
        has_specific_bottles = (courier.get("capacity_12", 0) > 0 or courier.get("capacity_19", 0) > 0)
        
        if has_specific_bottles:
            # Для курьеров с конкретными типами используем максимальную вместимость каждого типа
            # Вместимость = текущие бутылки + возможность доукомплектовать до capacity
            total_capacity = courier.get("capacity", 0)
            current_12 = courier.get("capacity_12", 0)
            current_19 = courier.get("capacity_19", 0)
            current_total = current_12 + current_19
            
            # Если общая вместимость больше текущих бутылок, можно доукомплектовать
            if total_capacity > current_total:
                additional_capacity = total_capacity - current_total
                # Распределяем дополнительную вместимость пропорционально текущим запасам
                if current_total > 0:
                    ratio_12 = current_12 / current_total
                    ratio_19 = current_19 / current_total
                    max_capacity_12 = current_12 + int(additional_capacity * ratio_12)
                    max_capacity_19 = current_19 + int(additional_capacity * ratio_19)
                else:
                    # Если нет текущих бутылок, можно взять любые до общей вместимости
                    max_capacity_12 = total_capacity
                    max_capacity_19 = total_capacity
            else:
                max_capacity_12 = current_12
                max_capacity_19 = current_19
            
            courier_capacities_12.append(max_capacity_12)
            courier_capacities_19.append(max_capacity_19)
        else:
            # Для курьеров с общей вместимостью ставим большие значения
            courier_capacities_12.append(1000)
            courier_capacities_19.append(1000)
    
    routing.AddDimensionWithVehicleCapacity(
        bottle12_callback_index,
        0,
        courier_capacities_12,
        True,
        "Bottle12"
    )
    
    routing.AddDimensionWithVehicleCapacity(
        bottle19_callback_index,
        0,
        courier_capacities_19,
        True,
        "Bottle19"
    )

# Применяем дополнительные ограничения для курьеров с конкретными типами бутылок
print("\n=== ПРИМЕНЕНИЕ ОГРАНИЧЕНИЙ ПО ТИПАМ БУТЫЛОК ===", file=sys.stderr)

for i, order in enumerate(orders):
    order_node_index = num_couriers + 1 + i
    order_routing_index = manager.NodeToIndex(order_node_index)
    
    bottles_12 = order.get("bottles_12", 0)
    bottles_19 = order.get("bottles_19", 0)
    
    # Определяем курьеров, которые могут выполнить этот заказ
    allowed_couriers_for_order = []
    
    for courier_id in range(num_couriers):
        if courier_id in couriers_with_general_capacity:
            # Курьер с общей вместимостью может взять любой заказ
            allowed_couriers_for_order.append(courier_id)
        else:
            # Курьер с конкретными типами - проверяем совместимость с максимальной вместимостью
            total_capacity = couriers[courier_id].get("capacity", 0)
            current_12 = couriers[courier_id].get("capacity_12", 0)
            current_19 = couriers[courier_id].get("capacity_19", 0)
            current_total = current_12 + current_19
            
            # Вычисляем максимальную возможную вместимость каждого типа
            if total_capacity > current_total:
                additional_capacity = total_capacity - current_total
                if current_total > 0:
                    ratio_12 = current_12 / current_total
                    ratio_19 = current_19 / current_total
                    max_capacity_12 = current_12 + int(additional_capacity * ratio_12)
                    max_capacity_19 = current_19 + int(additional_capacity * ratio_19)
                else:
                    max_capacity_12 = total_capacity
                    max_capacity_19 = total_capacity
            else:
                max_capacity_12 = current_12
                max_capacity_19 = current_19
            
            can_handle_12 = bottles_12 == 0 or max_capacity_12 >= bottles_12
            can_handle_19 = bottles_19 == 0 or max_capacity_19 >= bottles_19
            
            if can_handle_12 and can_handle_19:
                allowed_couriers_for_order.append(courier_id)
    
    # Применяем ограничения из courier_restrictions
    if order['id'] in courier_restrictions:
        restricted_couriers = courier_restrictions[order['id']]
        if not restricted_couriers:
            routing.AddDisjunction([order_routing_index], 100000)
            print(f"Заказ {order['id']}: исключен из обслуживания", file=sys.stderr)
            continue
        else:
            allowed_couriers_for_order = list(set(allowed_couriers_for_order) & set(restricted_couriers))
    
    if not allowed_couriers_for_order:
        routing.AddDisjunction([order_routing_index], 100000)
        print(f"Заказ {order['id']}: НЕТ подходящих курьеров (12л:{bottles_12}, 19л:{bottles_19})", file=sys.stderr)
    else:
        routing.SetAllowedVehiclesForIndex(allowed_couriers_for_order, order_routing_index)
        courier_names = [couriers[c]['id'] for c in allowed_couriers_for_order]
        print(f"Заказ {order['id']}: разрешен для {courier_names} (12л:{bottles_12}, 19л:{bottles_19})", file=sys.stderr)

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
            # Курьер имеет конкретные типы бутылок, если у него есть хотя бы одна бутылка 12л или 19л
            courier_has_specific_bottles = (couriers[vehicle_id].get("capacity_12", 0) > 0 or couriers[vehicle_id].get("capacity_19", 0) > 0)
            
            if courier_has_specific_bottles:
                # У курьера есть конкретные типы бутылок
                courier_capacity_12 = couriers[vehicle_id].get("capacity_12", 0)
                courier_capacity_19 = couriers[vehicle_id].get("capacity_19", 0)
                courier_total_capacity = courier_capacity_12 + courier_capacity_19
                
                # Вычисляем максимальную возможную вместимость
                total_capacity = couriers[vehicle_id].get("capacity", 0)
                current_total = courier_capacity_12 + courier_capacity_19
                
                if total_capacity > current_total:
                    additional_capacity = total_capacity - current_total
                    if current_total > 0:
                        ratio_12 = courier_capacity_12 / current_total
                        ratio_19 = courier_capacity_19 / current_total
                        max_capacity_12 = courier_capacity_12 + int(additional_capacity * ratio_12)
                        max_capacity_19 = courier_capacity_19 + int(additional_capacity * ratio_19)
                    else:
                        max_capacity_12 = total_capacity
                        max_capacity_19 = total_capacity
                else:
                    max_capacity_12 = courier_capacity_12
                    max_capacity_19 = courier_capacity_19
                
                print(f"  Количество заказов: {len(route_orders)}", file=sys.stderr)
                print(f"  Требуется бутылок: 12л={total_bottles_12}, 19л={total_bottles_19}, всего={total_bottles}", file=sys.stderr)
                print(f"  У курьера есть: 12л={courier_capacity_12}, 19л={courier_capacity_19}, всего={courier_total_capacity}", file=sys.stderr)
                print(f"  Максимальная вместимость: 12л={max_capacity_12}, 19л={max_capacity_19}, всего={total_capacity}", file=sys.stderr)
                
                # Проверяем достаточность с учетом возможности доукомплектования
                can_handle_with_refill = (total_bottles_12 <= max_capacity_12 and total_bottles_19 <= max_capacity_19)
                
                if can_handle_with_refill:
                    # Рассчитываем необходимое доукомплектование
                    refill_12 = max(0, total_bottles_12 - courier_capacity_12)
                    refill_19 = max(0, total_bottles_19 - courier_capacity_19)
                    
                    if refill_12 > 0 or refill_19 > 0:
                        print(f"  🔄 Нужно доукомплектовать: 12л={refill_12}, 19л={refill_19}", file=sys.stderr)
                    else:
                        print(f"  ✅ Бутылок достаточно", file=sys.stderr)
                else:
                    print(f"  ❌ Недостаточно даже с доукомплектованием!", file=sys.stderr)
                    shortage_12 = max(0, total_bottles_12 - max_capacity_12)
                    shortage_19 = max(0, total_bottles_19 - max_capacity_19)
                    if shortage_12 > 0:
                        print(f"     Не хватает 12л: {shortage_12}", file=sys.stderr)
                    if shortage_19 > 0:
                        print(f"     Не хватает 19л: {shortage_19}", file=sys.stderr)
                
                bottles_12_needed = total_bottles_12
                bottles_19_needed = total_bottles_19
                
            else:
                # У курьера общая вместимость - нужно показать сколько взять
                courier_total_capacity = couriers[vehicle_id].get("capacity", 0)
                
                print(f"  Количество заказов: {len(route_orders)}", file=sys.stderr)
                print(f"  Требуется бутылок: 12л={total_bottles_12}, 19л={total_bottles_19}, всего={total_bottles}", file=sys.stderr)
                print(f"  Общая вместимость курьера: {courier_total_capacity} бутылок", file=sys.stderr)
                print(f"  Курьер должен взять: 12л={total_bottles_12}, 19л={total_bottles_19}", file=sys.stderr)
                
                if total_bottles > courier_total_capacity:
                    print(f"  ❌ ОШИБКА: Требуется {total_bottles} бутылок, но общая вместимость {courier_total_capacity}", file=sys.stderr)
                else:
                    print(f"  ✅ Помещается в общую вместимость", file=sys.stderr)
                
                bottles_12_needed = total_bottles_12
                bottles_19_needed = total_bottles_19
            
            print(f"  Использование вместимости: {100*total_bottles/max(courier_total_capacity,1):.1f}%", file=sys.stderr)
            
            total_distance += route_distance
            active_couriers += 1
            
            # Формируем информацию о курьере
            courier_info = {
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
                "capacity_utilization": {
                    "percent": round(100 * total_bottles / max(courier_total_capacity, 1), 1)
                }
            }
            
            if courier_has_specific_bottles:
                # У курьера есть конкретные типы бутылок
                courier_info["courier_bottles"] = {
                    "bottles_12": courier_capacity_12,
                    "bottles_19": courier_capacity_19,
                    "total": courier_total_capacity
                }
                courier_info["max_capacity"] = {
                    "bottles_12": max_capacity_12,
                    "bottles_19": max_capacity_19,
                    "total": total_capacity
                }
                courier_info["bottles_sufficient"] = can_handle_with_refill
                
                # Рассчитываем необходимое доукомплектование
                refill_12 = max(0, total_bottles_12 - courier_capacity_12)
                refill_19 = max(0, total_bottles_19 - courier_capacity_19)
                
                if refill_12 > 0 or refill_19 > 0:
                    courier_info["refill_needed"] = {
                        "bottles_12": refill_12,
                        "bottles_19": refill_19,
                        "total": refill_12 + refill_19
                    }
                    
                    # Оптимизируем порядок заказов для доукомплектования
                    route_orders, refill_in_start, refill_point = optimize_route_for_refill(
                        route_orders, 
                        vehicle_id, 
                        True, 
                        orders, 
                        couriers, 
                        common_depot
                    )
                    courier_info["orders"] = route_orders
                    
                    # Используем информацию о точке доукомплектования из функции оптимизации
                    if refill_point:
                        courier_info["refill_point"] = refill_point
                        if refill_point["after_order_id"]:
                            print(f"  📍 Доукомплектование после заказа {refill_point['after_order_id']}, перед заказом {refill_point['before_order_id']}", file=sys.stderr)
                        else:
                            print(f"  📍 Доукомплектование в начале маршрута, перед заказом {refill_point['before_order_id']}", file=sys.stderr)
                
                if not can_handle_with_refill:
                    courier_info["bottles_shortage"] = {
                        "bottles_12": max(0, total_bottles_12 - max_capacity_12),
                        "bottles_19": max(0, total_bottles_19 - max_capacity_19)
                    }
            else:
                # У курьера общая вместимость - показываем сколько взять
                courier_info["courier_total_capacity"] = courier_total_capacity
                courier_info["courier_should_take"] = {
                    "bottles_12": bottles_12_needed,
                    "bottles_19": bottles_19_needed,
                    "total": bottles_12_needed + bottles_19_needed
                }
            
            routes.append(courier_info)
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
        utilization = route["capacity_utilization"]["percent"]
        
        print(f"  {courier_id}:", file=sys.stderr)
        print(f"    Требуется: 12л={required['bottles_12']}, 19л={required['bottles_19']}", file=sys.stderr)
        
        if "courier_bottles" in route:
            # У курьера есть конкретные типы бутылок
            courier_bottles = route["courier_bottles"]
            print(f"    У курьера есть: 12л={courier_bottles['bottles_12']}, 19л={courier_bottles['bottles_19']}", file=sys.stderr)
            
            if route["bottles_sufficient"]:
                print(f"    ✅ Бутылок достаточно", file=sys.stderr)
            else:
                print(f"    ❌ Недостаточно бутылок!", file=sys.stderr)
                if "bottles_shortage" in route:
                    shortage = route["bottles_shortage"]
                    if shortage["bottles_12"] > 0:
                        print(f"       Не хватает 12л: {shortage['bottles_12']}", file=sys.stderr)
                    if shortage["bottles_19"] > 0:
                        print(f"       Не хватает 19л: {shortage['bottles_19']}", file=sys.stderr)
        else:
            # У курьера общая вместимость
            should_take = route["courier_should_take"]
            print(f"    Курьер должен взять: 12л={should_take['bottles_12']}, 19л={should_take['bottles_19']}", file=sys.stderr)
            print(f"    Общая вместимость: {route['courier_total_capacity']} бутылок", file=sys.stderr)
        
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