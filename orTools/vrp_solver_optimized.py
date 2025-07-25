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

# Специальные ограничения для конкретных курьеров
# Формат: "имя_курьера": {"max_bottles_12": число, "max_bottles_19": число, "reason": "причина"}
COURIER_SPECIAL_RESTRICTIONS = {
    # "Бекет": {
    #     "max_bottles_12": 0,  # Запрещаем бутылки 12л
    #     "max_bottles_19": 100,  # Разрешаем бутылки 19л
    #     "reason": "Курьер не может перевозить бутылки 12л"
    # },
    # Можно добавить других курьеров:
    # "Василий": {
    #     "max_bottles_12": 5,  # Ограничиваем до 5 бутылок 12л
    #     "max_bottles_19": 100,
    #     "reason": "Ограниченная вместимость для 12л бутылок"
    # }
}

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
valid_orders = []
active_order_ids = set()

# Собираем ID активных заказов из структуры курьеров (не из списка заказов)
for courier in valid_couriers:
    if courier.get("order") and courier["order"].get("status") == "onTheWay":
        active_order_ids.add(courier["order"]["orderId"])

# Создаем виртуальные записи для активных заказов, чтобы алгоритм мог их учесть
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
        valid_orders.append(order)
        status_info = " (АКТИВНЫЙ)" if order['id'] in active_order_ids else ""
        print(f"✅ Заказ {order['id']}: ({order['lat']}, {order['lon']}){status_info}", file=sys.stderr)
    else:
        print(f"❌ Заказ {order['id']}: отсутствуют координаты", file=sys.stderr)

# Добавляем активные заказы в список для обработки алгоритмом
for active_order_id, active_order_data in active_orders_data.items():
    valid_orders.append(active_order_data)
    print(f"✅ Активный заказ {active_order_id}: ({active_order_data['lat']}, {active_order_data['lon']}) (АКТИВНЫЙ)", file=sys.stderr)

# Обновляем списки валидными данными
couriers = valid_couriers
orders = valid_orders

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
    bottles_12 = order.get("bottles_12") or 0
    bottles_19 = order.get("bottles_19") or 0
    total_bottles = bottles_12 + bottles_19
    status_info = " (АКТИВНЫЙ)" if order['id'] in active_order_ids else ""
    print(f"Заказ {order['id']}: {bottles_12} x 12л + {bottles_19} x 19л = {total_bottles} бутылок{status_info}", file=sys.stderr)

print("Ограничения на курьеров:", file=sys.stderr)
for order_id, allowed_courier_ids in courier_restrictions.items():
    if not allowed_courier_ids:
        print(f"  {order_id}: исключен из обслуживания", file=sys.stderr)
    else:
        # Преобразуем ID курьеров в их имена для отладки
        courier_names = []
        for courier_id in allowed_courier_ids:
            # Ищем курьера по ID (может быть ObjectId или имя)
            found_courier = None
            for courier in couriers:
                if str(courier.get('id', '')) == str(courier_id):
                    found_courier = courier
                    break
            
            if found_courier:
                courier_names.append(found_courier['id'])
            else:
                # Если не найден по ID, возможно это уже имя курьера
                courier_names.append(str(courier_id))
        
        print(f"  {order_id}: только {', '.join(courier_names)}", file=sys.stderr)

# Проверяем совместимость активных заказов с ограничениями
print("\n=== ПРОВЕРКА СОВМЕСТИМОСТИ АКТИВНЫХ ЗАКАЗОВ С ОГРАНИЧЕНИЯМИ ===", file=sys.stderr)
for courier in couriers:
    if courier.get("order") and courier["order"].get("status") == "onTheWay":
        active_order_id = courier["order"]["orderId"]
        courier_id = courier["id"]
        
        # Проверяем, есть ли ограничения для этого активного заказа
        if active_order_id in courier_restrictions:
            allowed_courier_ids = courier_restrictions[active_order_id]
            
            # Проверяем, разрешен ли этот курьер для активного заказа
            courier_allowed = False
            for allowed_id in allowed_courier_ids:
                if str(courier_id) == str(allowed_id):
                    courier_allowed = True
                    break
            
            if not courier_allowed:
                print(f"🚫 КОНФЛИКТ: Курьер {courier_id} должен выполнить активный заказ {active_order_id}, но исключен из ограничений!", file=sys.stderr)
                print(f"   Разрешенные курьеры: {allowed_courier_ids}", file=sys.stderr)
                print(f"   ИСПРАВЛЕНИЕ: Добавляем курьера {courier_id} в разрешенные для заказа {active_order_id}", file=sys.stderr)
                
                # Автоматически разрешаем курьеру выполнить его активный заказ
                courier_restrictions[active_order_id].append(courier_id)
            else:
                print(f"✅ Курьер {courier_id} разрешен для активного заказа {active_order_id}", file=sys.stderr)
        else:
            print(f"✅ Активный заказ {active_order_id} курьера {courier_id} не имеет ограничений", file=sys.stderr)

# Проверяем достаточность бутылок для активных заказов
print("\n=== ПРОВЕРКА ДОСТАТОЧНОСТИ БУТЫЛОК ДЛЯ АКТИВНЫХ ЗАКАЗОВ ===", file=sys.stderr)
for courier in couriers:
    if courier.get("order") and courier["order"].get("status") == "onTheWay":
        active_order_id = courier["order"]["orderId"]
        courier_id = courier["id"]
        
        # Находим активный заказ в списке заказов
        active_order = next((o for o in orders if o["id"] == active_order_id), None)
        if active_order:
            required_12 = active_order.get("bottles_12", 0)
            required_19 = active_order.get("bottles_19", 0)
            available_12 = courier.get("capacity_12", 0)
            available_19 = courier.get("capacity_19", 0)
            
            print(f"Курьер {courier_id} - активный заказ {active_order_id}:", file=sys.stderr)
            print(f"  Требуется: 12л={required_12}, 19л={required_19}", file=sys.stderr)
            print(f"  Доступно: 12л={available_12}, 19л={available_19}", file=sys.stderr)
            
            if available_12 < required_12 or available_19 < required_19:
                print(f"  ⚠️  НЕДОСТАТОЧНО БУТЫЛОК! Курьер не может выполнить активный заказ", file=sys.stderr)
                print(f"  💡 РЕШЕНИЕ: Курьер должен доехать до базы и взять недостающие бутылки", file=sys.stderr)
                
                # АВТОМАТИЧЕСКОЕ РЕШЕНИЕ: Обнуляем бутылки у курьера, чтобы он стал "пустым"
                # и мог взять все необходимые бутылки с базы
                print(f"  🔄 АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Помечаем курьера {courier_id} как 'empty' для пополнения запасов", file=sys.stderr)
                courier["capacity_12"] = 0
                courier["capacity_19"] = 0
                print(f"  ✅ Курьер {courier_id} теперь может взять все необходимые бутылки с базы", file=sys.stderr)
            else:
                print(f"  ✅ Достаточно бутылок для выполнения заказа", file=sys.stderr)

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

# Функция расчета расстояний для открытых маршрутов с учетом активных заказов
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
        
        # Базовое расстояние между точками
        return distance_matrix[from_node][to_node]
    except Exception as e:
        print(f"Ошибка в distance_callback: {e}", file=sys.stderr)
        return 999999

transit_callback_index = routing.RegisterTransitCallback(distance_callback)
routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

# Добавляем ограничения для заказов
for order_idx in range(num_couriers + 1, num_locations):
    routing.AddDisjunction([manager.NodeToIndex(order_idx)], 10000)

# Предварительное определение типов курьеров для использования в ограничениях
courier_capacities = []
courier_types = []  # Отслеживаем тип курьера: 'empty' или 'loaded'

for courier in couriers:
    capacity_12 = courier.get("capacity_12", 0)
    capacity_19 = courier.get("capacity_19", 0)
    
    # Проверяем, есть ли активный заказ
    has_active_order = (courier.get("order") and courier["order"].get("status") == "onTheWay")
    
    # ИСПРАВЛЕННАЯ ЛОГИКА: Курьер пустой только если у него 0 и 12л, и 19л
    if capacity_12 == 0 and capacity_19 == 0:
        # Курьер полностью пустой - нужно назначить заказы и показать сколько взять
        courier_type = 'empty'
        total_capacity = courier.get("capacity", 100)  # Максимальная вместимость для пустого курьера
        print(f"Курьер {courier['id']}: ПУСТОЙ (0 бутылок 12л и 19л), можно назначить любые заказы", file=sys.stderr)
    else:
        # Курьер загружен - имеет бутылки хотя бы одного типа
        courier_type = 'loaded'
        total_capacity = capacity_12 + capacity_19
        
        # Выводим детальную информацию о загруженности
        bottles_info = []
        if capacity_12 > 0:
            bottles_info.append(f"12л={capacity_12}")
        if capacity_19 > 0:
            bottles_info.append(f"19л={capacity_19}")
        
        print(f"Курьер {courier['id']}: ЗАГРУЖЕННЫЙ ({', '.join(bottles_info)})", file=sys.stderr)
        
        # Проверяем ограничения по типам бутылок
        if capacity_12 == 0:
            print(f"  ⚠️  НЕ МОЖЕТ брать заказы с 12л бутылками (нет 12л бутылок)", file=sys.stderr)
        if capacity_19 == 0:
            print(f"  ⚠️  НЕ МОЖЕТ брать заказы с 19л бутылками (нет 19л бутылок)", file=sys.stderr)
        
        if has_active_order:
            active_order_id = courier["order"]["orderId"]
            active_order = next((o for o in orders if o["id"] == active_order_id), None)
            if active_order:
                required_12 = active_order.get("bottles_12", 0)
                required_19 = active_order.get("bottles_19", 0)
                
                if capacity_12 >= required_12 and capacity_19 >= required_19:
                    print(f"  ✅ Достаточно бутылок для активного заказа", file=sys.stderr)
                else:
                    print(f"  ⚠️  Недостаточно бутылок для активного заказа (требуется 12л={required_12}, 19л={required_19})", file=sys.stderr)
    
    courier_capacities.append(total_capacity)
    courier_types.append(courier_type)
    
    print(f"Курьер {courier['id']}: тип={courier_type}, вместимость={total_capacity} бутылок (12л={capacity_12}, 19л={capacity_19})", file=sys.stderr)

# ДОБАВЛЯЕМ СТРОГУЮ ПРОВЕРКУ СОВМЕСТИМОСТИ ЗАКАЗОВ С ТИПАМИ БУТЫЛОК КУРЬЕРОВ
print("\n=== ПРОВЕРКА СОВМЕСТИМОСТИ ЗАКАЗОВ С ТИПАМИ БУТЫЛОК КУРЬЕРОВ ===", file=sys.stderr)

# Заменяем старые ограничения на новые, учитывающие совместимость по типам бутылок
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
            
            # Проверяем совместимость со специальными ограничениями
            if order_bottles_12 <= max_bottles_12 and order_bottles_19 <= max_bottles_19:
                compatible_courier_indices.append(courier_idx)
                print(f"  ✅ Заказ {order['id']} совместим с курьером {courier_name} (специальные ограничения)", file=sys.stderr)
            else:
                print(f"  🚫 Заказ {order['id']} НЕ совместим с курьером {courier_name} (специальные ограничения: требуется 12л={order_bottles_12}, 19л={order_bottles_19})", file=sys.stderr)
        
        elif courier_type == 'empty':
            # Пустой курьер может взять любой заказ
            compatible_courier_indices.append(courier_idx)
            print(f"  ✅ Заказ {order['id']} совместим с ПУСТЫМ курьером {courier_name}", file=sys.stderr)
        
        else:
            # СТРОГАЯ ПРОВЕРКА для загруженных курьеров
            can_handle_12 = (order_bottles_12 == 0) or (courier_capacity_12 > 0 and courier_capacity_12 >= order_bottles_12)
            can_handle_19 = (order_bottles_19 == 0) or (courier_capacity_19 > 0 and courier_capacity_19 >= order_bottles_19)
            
            if can_handle_12 and can_handle_19:
                compatible_courier_indices.append(courier_idx)
                print(f"  ✅ Заказ {order['id']} совместим с ЗАГРУЖЕННЫМ курьером {courier_name} (есть 12л={courier_capacity_12}, 19л={courier_capacity_19})", file=sys.stderr)
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
        # Если ни один курьер не может выполнить заказ - исключаем его
        routing.AddDisjunction([order_routing_index], 100000)
        print(f"  ❌ ЗАКАЗ {order['id']} ИСКЛЮЧЕН: ни один курьер не может его выполнить", file=sys.stderr)
    else:
        # Если есть ограничения из courier_restrictions, учитываем их
        if order['id'] in courier_restrictions:
            allowed_courier_ids = courier_restrictions[order['id']]
            if allowed_courier_ids:
                # Преобразуем ID в индексы
                restricted_courier_indices = []
                for courier_id in allowed_courier_ids:
                    for j, courier in enumerate(couriers):
                        if str(courier['id']) == str(courier_id):
                            restricted_courier_indices.append(j)
                            break
                
                # Пересечение: курьеры, которые и совместимы по бутылкам, и разрешены ограничениями
                final_allowed_indices = list(set(compatible_courier_indices) & set(restricted_courier_indices))
                
                if final_allowed_indices:
                    routing.SetAllowedVehiclesForIndex(final_allowed_indices, order_routing_index)
                    print(f"  ✅ Заказ {order['id']}: разрешен для курьеров с индексами {final_allowed_indices} (совместимость + ограничения)", file=sys.stderr)
                else:
                    routing.AddDisjunction([order_routing_index], 100000)
                    print(f"  ❌ ЗАКАЗ {order['id']} ИСКЛЮЧЕН: нет курьеров, совместимых по бутылкам И разрешенных ограничениями", file=sys.stderr)
            else:
                # Заказ полностью исключен ограничениями
                routing.AddDisjunction([order_routing_index], 100000)
                print(f"  ❌ ЗАКАЗ {order['id']} ИСКЛЮЧЕН: полностью исключен ограничениями", file=sys.stderr)
        else:
            # Нет ограничений - разрешаем всем совместимым курьерам
            routing.SetAllowedVehiclesForIndex(compatible_courier_indices, order_routing_index)
            print(f"  ✅ Заказ {order['id']}: разрешен для совместимых курьеров с индексами {compatible_courier_indices}", file=sys.stderr)

# Добавляем жесткие ограничения для активных заказов
print("\n=== НАСТРОЙКА ОГРАНИЧЕНИЙ ДЛЯ АКТИВНЫХ ЗАКАЗОВ ===", file=sys.stderr)
for vehicle_id, courier in enumerate(couriers):
    if courier.get("order") and courier["order"].get("status") == "onTheWay":
        active_order_id = courier["order"]["orderId"]
        
        # Находим индекс активного заказа
        active_order_index = None
        for i, order in enumerate(orders):
            if order["id"] == active_order_id:
                active_order_index = num_couriers + 1 + i
                break
        
        if active_order_index is not None:
            active_order_routing_index = manager.NodeToIndex(active_order_index)
            
            # Принудительно назначаем активный заказ этому курьеру
            routing.SetAllowedVehiclesForIndex([vehicle_id], active_order_routing_index)
            
            # Добавляем высокий приоритет для активных заказов
            routing.AddDisjunction([active_order_routing_index], 100000)  # Высокий штраф за пропуск
            
            # Проверяем тип курьера
            courier_type = courier_types[vehicle_id]
            
            # Жесткое ограничение: курьер должен сначала ехать к активному заказу
            routing.solver().Add(
                routing.NextVar(routing.Start(vehicle_id)) == active_order_routing_index
            )
            
            print(f"✅ Курьер {courier['id']} (тип: {courier_type}) должен СНАЧАЛА доехать до активного заказа {active_order_id}", file=sys.stderr)
            
            # Мягкое предпочтение для активных заказов
            print(f"✅ Курьер {courier['id']} должен выполнить активный заказ {active_order_id}", file=sys.stderr)

# БАЛАНСИРОВКА НАГРУЗКИ (только для новых заказов)
new_orders_count = len([order for order in orders if order['id'] not in active_order_ids])
ideal_orders_per_courier = new_orders_count // num_couriers
remainder = new_orders_count % num_couriers

# Убираем жесткие ограничения на количество заказов
# Теперь распределяем гибко в зависимости от вместимости бутылок
min_orders_per_courier = 0  # Минимум 0 заказов - курьер может не получить заказы если не подходит
max_orders_per_courier = new_orders_count  # Максимум - все заказы (если у курьера достаточно вместимости)

print(f"\nНовых заказов для распределения: {new_orders_count}", file=sys.stderr)
print(f"Гибкое распределение: минимум {min_orders_per_courier}, максимум {max_orders_per_courier} заказов на курьера", file=sys.stderr)
print(f"Распределение основано на вместимости бутылок, а не на равном количестве заказов", file=sys.stderr)

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
            bottles_12 = order.get("bottles_12") or 0
            bottles_19 = order.get("bottles_19") or 0
            return bottles_12 + bottles_19
        return 0
    except Exception as e:
        print(f"Ошибка в total_bottles_callback: {e}", file=sys.stderr)
        return 0

total_bottles_callback_index = routing.RegisterTransitCallback(total_bottles_callback)

# Функция для подсчета бутылок 12л в заказе
def bottles_12_callback(from_index, to_index):
    try:
        if from_index < 0 or to_index < 0:
            return 0
        
        to_node = manager.IndexToNode(to_index)
        # Если переходим к заказу, возвращаем количество бутылок 12л
        if to_node >= num_couriers + 1 and to_node < num_locations:
            order = orders[to_node - num_couriers - 1]
            return order.get("bottles_12") or 0
        return 0
    except Exception as e:
        print(f"Ошибка в bottles_12_callback: {e}", file=sys.stderr)
        return 0

# Функция для подсчета бутылок 19л в заказе
def bottles_19_callback(from_index, to_index):
    try:
        if from_index < 0 or to_index < 0:
            return 0
        
        to_node = manager.IndexToNode(to_index)
        # Если переходим к заказу, возвращаем количество бутылок 19л
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
    
    # Проверяем специальные ограничения для курьера
    if courier_name in COURIER_SPECIAL_RESTRICTIONS:
        special_restrictions = COURIER_SPECIAL_RESTRICTIONS[courier_name]
        max_bottles_12 = special_restrictions["max_bottles_12"]
        max_bottles_19 = special_restrictions["max_bottles_19"]
        reason = special_restrictions["reason"]
        
        print(f"🚫 СПЕЦИАЛЬНОЕ ОГРАНИЧЕНИЕ для курьера {courier_name}: {reason}", file=sys.stderr)
        print(f"   Принудительные лимиты: 12л≤{max_bottles_12}, 19л≤{max_bottles_19}", file=sys.stderr)
        
        # Применяем специальные ограничения независимо от типа курьера
        courier_capacities_12.append(max_bottles_12)
        courier_capacities_19.append(max_bottles_19)
        
        print(f"Курьер {courier_name}: СПЕЦИАЛЬНЫЕ ОГРАНИЧЕНИЯ применены", file=sys.stderr)
        
    elif courier_type == 'empty':
        # Пустой курьер - может взять любые бутылки в пределах общей вместимости
        total_capacity = courier.get("capacity", 100)
        courier_capacities_12.append(total_capacity)
        courier_capacities_19.append(total_capacity)
        print(f"Курьер {courier_name}: пустой, может взять любые бутылки до {total_capacity}", file=sys.stderr)
    else:
        # ИСПРАВЛЕННАЯ ЛОГИКА: Загруженный курьер - строгие ограничения по типам бутылок
        # Если у курьера 0 бутылок определенного типа - он НЕ может брать заказы этого типа
        if capacity_12 == 0:
            # Курьер НЕ может брать заказы с 12л бутылками
            courier_capacities_12.append(0)
            print(f"Курьер {courier_name}: НЕ МОЖЕТ брать заказы с 12л (нет 12л бутылок)", file=sys.stderr)
        else:
            # Курьер может использовать имеющиеся 12л бутылки
            courier_capacities_12.append(capacity_12)
            print(f"Курьер {courier_name}: может использовать 12л бутылки (есть {capacity_12})", file=sys.stderr)
        
        if capacity_19 == 0:
            # Курьер НЕ может брать заказы с 19л бутылками
            courier_capacities_19.append(0)
            print(f"Курьер {courier_name}: НЕ МОЖЕТ брать заказы с 19л (нет 19л бутылок)", file=sys.stderr)
        else:
            # Курьер может использовать имеющиеся 19л бутылки
            courier_capacities_19.append(capacity_19)
            print(f"Курьер {courier_name}: может использовать 19л бутылки (есть {capacity_19})", file=sys.stderr)
    
    print(f"Курьер {courier_name}: ИТОГО макс. 12л={courier_capacities_12[-1]}, макс. 19л={courier_capacities_19[-1]}", file=sys.stderr)

# Добавляем раздельные размерности для бутылок 12л и 19л
bottles_12_dimension = routing.AddDimensionWithVehicleCapacity(
    bottles_12_callback_index,
    0,  # no slack
    courier_capacities_12,  # вместимость 12л для каждого курьера
    True,
    "Bottles12"
)

bottles_19_dimension = routing.AddDimensionWithVehicleCapacity(
    bottles_19_callback_index,
    0,  # no slack
    courier_capacities_19,  # вместимость 19л для каждого курьера
    True,
    "Bottles19"
)

# Получаем размерности для установки мягких ограничений
bottles_12_dimension_obj = routing.GetDimensionOrDie("Bottles12")
bottles_19_dimension_obj = routing.GetDimensionOrDie("Bottles19")

# Устанавливаем мягкие ограничения для загруженных курьеров
print("\n=== НАСТРОЙКА ЖЕСТКИХ ОГРАНИЧЕНИЙ НА ТИПЫ БУТЫЛОК ===", file=sys.stderr)
for vehicle_id in range(num_couriers):
    courier = couriers[vehicle_id]
    courier_type = courier_types[vehicle_id]
    courier_name = courier.get("id", "")
    capacity_12 = courier.get("capacity_12", 0)
    capacity_19 = courier.get("capacity_19", 0)
    
    # Проверяем специальные ограничения
    if courier_name in COURIER_SPECIAL_RESTRICTIONS:
        special_restrictions = COURIER_SPECIAL_RESTRICTIONS[courier_name]
        max_bottles_12 = special_restrictions["max_bottles_12"]
        max_bottles_19 = special_restrictions["max_bottles_19"]
        
        # Для курьеров со специальными ограничениями устанавливаем жесткие лимиты
        bottles_12_dimension_obj.SetCumulVarSoftUpperBound(
            routing.End(vehicle_id),
            max_bottles_12,
            10000  # Высокий штраф за превышение специальных ограничений
        )
        
        bottles_19_dimension_obj.SetCumulVarSoftUpperBound(
            routing.End(vehicle_id),
            max_bottles_19,
            10000  # Высокий штраф за превышение специальных ограничений
        )
        
        print(f"Курьер {courier_name}: СПЕЦИАЛЬНЫЕ ограничения 12л≤{max_bottles_12}, 19л≤{max_bottles_19} (жесткие)", file=sys.stderr)
        
    elif courier_type == 'empty':
        # Пустой курьер - без жестких ограничений на типы бутылок
        print(f"Курьер {courier_name} (пустой): без ограничений на типы бутылок", file=sys.stderr)
        
    else:
        # ИСПРАВЛЕННАЯ ЛОГИКА: Загруженный курьер - жесткие ограничения по типам бутылок
        # Если у курьера 0 бутылок определенного типа - жесткий запрет на заказы этого типа
        
        if capacity_12 == 0:
            # ЖЕСТКИЙ ЗАПРЕТ на заказы с 12л бутылками
            bottles_12_dimension_obj.SetCumulVarSoftUpperBound(
                routing.End(vehicle_id),
                0,
                100000  # Очень высокий штраф = практически запрет
            )
            print(f"Курьер {courier_name}: ЖЕСТКИЙ ЗАПРЕТ на заказы с 12л (нет 12л бутылок)", file=sys.stderr)
        else:
            # Мягкое ограничение по имеющимся 12л бутылкам
            bottles_12_dimension_obj.SetCumulVarSoftUpperBound(
                routing.End(vehicle_id),
                capacity_12,
                1000  # Мягкий штраф за превышение
            )
            print(f"Курьер {courier_name}: мягкое ограничение 12л≤{capacity_12}", file=sys.stderr)
        
        if capacity_19 == 0:
            # ЖЕСТКИЙ ЗАПРЕТ на заказы с 19л бутылками
            bottles_19_dimension_obj.SetCumulVarSoftUpperBound(
                routing.End(vehicle_id),
                0,
                100000  # Очень высокий штраф = практически запрет
            )
            print(f"Курьер {courier_name}: ЖЕСТКИЙ ЗАПРЕТ на заказы с 19л (нет 19л бутылок)", file=sys.stderr)
        else:
            # Мягкое ограничение по имеющимся 19л бутылкам
            bottles_19_dimension_obj.SetCumulVarSoftUpperBound(
                routing.End(vehicle_id),
                capacity_19,
                1000  # Мягкий штраф за превышение
            )
            print(f"Курьер {courier_name}: мягкое ограничение 19л≤{capacity_19}", file=sys.stderr)

# Добавляем размерность для общей вместимости курьеров
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
    max_orders_per_courier + 1,  # максимум заказов на курьера + активный заказ
    True,  # start cumul to zero
    "OrderCount"
)

# Получаем размерность для установки ограничений
order_count_dimension = routing.GetDimensionOrDie("OrderCount")

# Устанавливаем ограничения на количество заказов для каждого курьера
for vehicle_id in range(num_couriers):
    # Учитываем активный заказ при расчете ограничений
    has_active_order = (couriers[vehicle_id].get("order") and 
                       couriers[vehicle_id]["order"].get("status") == "onTheWay")
    
    # Убираем жесткие ограничения - теперь курьер может получить от 0 до всех заказов
    # в зависимости от вместимости бутылок
    min_orders = 0  # Минимум 0 - курьер может не получить заказы
    max_orders = new_orders_count + (1 if has_active_order else 0)  # Максимум - все заказы
    
    # Делаем ограничения очень мягкими (практически убираем)
    order_count_dimension.SetCumulVarSoftLowerBound(
        routing.End(vehicle_id), 
        min_orders, 
        100  # Очень маленький штраф
    )
    
    order_count_dimension.SetCumulVarSoftUpperBound(
        routing.End(vehicle_id), 
        max_orders, 
        100  # Очень маленький штраф
    )
    
    print(f"Курьер {vehicle_id}: гибкие ограничения {min_orders}-{max_orders} заказов (приоритет - вместимость бутылок)", file=sys.stderr)

# Убираем штраф за использование курьера - используем всех доступных курьеров
for vehicle_id in range(num_couriers):
    routing.SetFixedCostOfVehicle(0, vehicle_id)  # Никакого штрафа за использование курьера

# Добавляем мягкое ограничение на максимальное количество заказов на курьера
# для более равномерного распределения
ideal_orders_per_courier = max(1, new_orders_count // num_couriers)
max_orders_per_courier_soft = ideal_orders_per_courier + 2  # Мягкий лимит

print(f"Идеальное количество заказов на курьера: {ideal_orders_per_courier}", file=sys.stderr)
print(f"Мягкий лимит заказов на курьера: {max_orders_per_courier_soft}", file=sys.stderr)

# Устанавливаем более строгие мягкие ограничения для лучшего распределения
for vehicle_id in range(num_couriers):
    # Учитываем активный заказ при расчете ограничений
    has_active_order = (couriers[vehicle_id].get("order") and 
                       couriers[vehicle_id]["order"].get("status") == "onTheWay")
    
    # Улучшенная логика распределения: учитываем вместимость курьера
    courier_capacity = courier_capacities[vehicle_id]
    courier_type = courier_types[vehicle_id]
    
    # Рассчитываем оптимальное количество заказов на основе вместимости
    if courier_type == 'empty':
        # Пустой курьер может взять больше заказов
        optimal_orders = min(new_orders_count, courier_capacity // 2)  # Примерно половина вместимости
    else:
        # Загруженный курьер - ограничиваем количеством заказов, которые поместятся в оставшуюся вместимость
        current_bottles = couriers[vehicle_id].get("capacity_12", 0) + couriers[vehicle_id].get("capacity_19", 0)
        remaining_capacity = courier_capacity - current_bottles
        optimal_orders = max(1, remaining_capacity // 3)  # Примерно 3 бутылки на заказ
    
    # Мягкое ограничение сверху - поощряем равномерное распределение
    max_orders_with_active = optimal_orders + (1 if has_active_order else 0)
    
    order_count_dimension.SetCumulVarSoftUpperBound(
        routing.End(vehicle_id), 
        max_orders_with_active, 
        1000  # Увеличиваем штраф за превышение для лучшего распределения
    )
    
    # Мягкое ограничение снизу - поощряем использование каждого курьера
    min_orders = 1 if not has_active_order else 0  # Минимум 1 заказ для курьеров без активных заказов
    
    if not has_active_order:
        # ЖЕСТКОЕ ОГРАНИЧЕНИЕ: каждый курьер без активного заказа ДОЛЖЕН получить минимум 1 заказ
        order_count_dimension.SetCumulVarSoftLowerBound(
            routing.End(vehicle_id), 
            min_orders, 
            500000  # Уменьшаем штраф, но все еще высокий
        )
        print(f"Курьер {vehicle_id}: ПРИНУДИТЕЛЬНОЕ требование минимум {min_orders} заказов (штраф: 500000)", file=sys.stderr)
    else:
        order_count_dimension.SetCumulVarSoftLowerBound(
            routing.End(vehicle_id), 
            min_orders, 
            5000  # Уменьшаем штраф за неиспользование курьера
        )
        print(f"Курьер {vehicle_id}: мягкое ограничение минимум {min_orders} заказов (штраф: 5000)", file=sys.stderr)
    
    print(f"Курьер {vehicle_id}: оптимальное количество заказов: {optimal_orders} (вместимость: {courier_capacity}, тип: {courier_type})", file=sys.stderr)

# Ограничения по максимальному расстоянию для каждого курьера (в метрах)
MAX_DISTANCE_PER_COURIER = 25000  # Увеличиваем до 25 км для лучшей эффективности

print("\n=== ПРОВЕРКА ОГРАНИЧЕНИЙ ПО РАССТОЯНИЮ ===", file=sys.stderr)

# Дополнительная проверка расстояний для каждого заказа
for i, order in enumerate(orders):
    order_node_index = num_couriers + 1 + i
    order_routing_index = manager.NodeToIndex(order_node_index)
    
    # Проверяем расстояние от каждого курьера до заказа
    distance_restricted_couriers = []
    
    for courier_idx, courier in enumerate(couriers):
        # Рассчитываем расстояние от курьера до заказа
        courier_lat = courier["lat"]
        courier_lon = courier["lon"]
        order_lat = order["lat"]
        order_lon = order["lon"]
        
        distance_meters = int(haversine(courier_lat, courier_lon, order_lat, order_lon) * 1000)
        
        if distance_meters > MAX_DISTANCE_PER_COURIER:
            print(f"  🚫 Заказ {order['id']} слишком далеко от курьера {courier['id']}: {distance_meters}m > {MAX_DISTANCE_PER_COURIER}m", file=sys.stderr)
            distance_restricted_couriers.append(courier_idx)
        else:
            print(f"  ✅ Заказ {order['id']} в пределах досягаемости курьера {courier['id']}: {distance_meters}m", file=sys.stderr)
    
    # Если есть курьеры, которые слишком далеко, исключаем их из разрешенных
    if distance_restricted_couriers:
        # Получаем текущие разрешенные курьеры для этого заказа
        current_allowed_vehicles = []
        for vehicle_id in range(num_couriers):
            if routing.IsVehicleAllowedForIndex(vehicle_id, order_routing_index):
                current_allowed_vehicles.append(vehicle_id)
        
        # Удаляем курьеров, которые слишком далеко
        new_allowed_vehicles = [v for v in current_allowed_vehicles if v not in distance_restricted_couriers]
        
        if new_allowed_vehicles:
            routing.SetAllowedVehiclesForIndex(new_allowed_vehicles, order_routing_index)
            print(f"  🔄 Заказ {order['id']}: удалены курьеры {distance_restricted_couriers} из-за расстояния, остались {new_allowed_vehicles}", file=sys.stderr)
        else:
            # Если все курьеры слишком далеко, исключаем заказ
            routing.AddDisjunction([order_routing_index], 100000)
            print(f"  ❌ ЗАКАЗ {order['id']} ИСКЛЮЧЕН: все курьеры слишком далеко", file=sys.stderr)

# Улучшаем параметры поиска для лучшей эффективности
search_params = pywrapcp.DefaultRoutingSearchParameters()
search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC  # Лучшая стратегия для VRP
search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH  # Более эффективный поиск
search_params.time_limit.seconds = 60  # Увеличиваем время для лучшего решения
search_params.solution_limit = 100  # Увеличиваем лимит решений
search_params.log_search = True  # Включаем логирование для отладки

# Добавляем параметры для лучшего распределения
search_params.use_cp_sat = False  # Используем CP-SAT для лучших решений
search_params.use_unfiltered_first_solution_strategy = True  # Позволяем нефильтрованные решения

print("Начинаем решение с открытыми маршрутами и учетом активных заказов...", file=sys.stderr)
print("Параметры поиска:", file=sys.stderr)
print(f"  Стратегия первого решения: PATH_CHEAPEST_ARC", file=sys.stderr)
print(f"  Метод локального поиска: GUIDED_LOCAL_SEARCH", file=sys.stderr)
print(f"  Лимит времени: 60 секунд", file=sys.stderr)
print(f"  Лимит решений: 100", file=sys.stderr)
print(f"  Максимальное расстояние на курьера: {MAX_DISTANCE_PER_COURIER/1000:.1f} км", file=sys.stderr)

solution = routing.SolveWithParameters(search_params)

# Добавляем дополнительную отладочную информацию
print(f"Решение найдено: {solution is not None}", file=sys.stderr)
if solution:
    print(f"Статус решения: {routing.status()}", file=sys.stderr)

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
        
        # Проверяем, есть ли активный заказ
        has_active_order = (couriers[vehicle_id].get("order") and 
                           couriers[vehicle_id]["order"].get("status") == "onTheWay")
        
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            
            if node_index == 0:
                print(f"  -> Депо: ({common_depot['lat']}, {common_depot['lon']})", file=sys.stderr)
            elif node_index >= num_couriers + 1 and node_index < num_locations:
                order = orders[node_index - num_couriers - 1]
                route_orders.append(order["id"])
                
                # Отмечаем активные заказы
                if has_active_order and order["id"] == couriers[vehicle_id]["order"]["orderId"]:
                    print(f"  -> Заказ {order['id']}: ({order['lat']}, {order['lon']}) [АКТИВНЫЙ]", file=sys.stderr)
                else:
                    print(f"  -> Заказ {order['id']}: ({order['lat']}, {order['lon']}) [НОВЫЙ]", file=sys.stderr)
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
            
            # Проверяем специальные ограничения
            has_special_restrictions = courier_name in COURIER_SPECIAL_RESTRICTIONS
            if has_special_restrictions:
                special_restrictions = COURIER_SPECIAL_RESTRICTIONS[courier_name]
                max_bottles_12 = special_restrictions["max_bottles_12"]
                max_bottles_19 = special_restrictions["max_bottles_19"]
                reason = special_restrictions["reason"]
                
                print(f"  Тип курьера: СПЕЦИАЛЬНЫЕ ОГРАНИЧЕНИЯ", file=sys.stderr)
                print(f"  Ограничения: {reason}", file=sys.stderr)
                print(f"  Лимиты: 12л≤{max_bottles_12}, 19л≤{max_bottles_19}", file=sys.stderr)
                
                # Проверяем соблюдение специальных ограничений
                if total_bottles_12 > max_bottles_12:
                    print(f"  🚫 НАРУШЕНИЕ: Требуется 12л={total_bottles_12}, но лимит {max_bottles_12}", file=sys.stderr)
                if total_bottles_19 > max_bottles_19:
                    print(f"  🚫 НАРУШЕНИЕ: Требуется 19л={total_bottles_19}, но лимит {max_bottles_19}", file=sys.stderr)
                
                # Для курьеров со специальными ограничениями показываем что нужно взять в пределах лимитов
                if courier_type == 'empty':
                    courier_should_take = {
                        "bottles_12": min(total_bottles_12, max_bottles_12),
                        "bottles_19": min(total_bottles_19, max_bottles_19),
                        "total": min(total_bottles_12, max_bottles_12) + min(total_bottles_19, max_bottles_19)
                    }
                    courier_total_capacity = courier.get("capacity", 100)
                else:
                    # Загруженный курьер со специальными ограничениями
                    courier_should_take = {
                        "bottles_12": 0,  # Не нужно брать - уже есть
                        "bottles_19": 0,  # Не нужно брать - уже есть
                        "total": 0
                    }
                    courier_total_capacity = courier_capacity_12 + courier_capacity_19
                
            # Логика расчета в зависимости от типа курьера
            elif courier_type == 'empty':
                # Пустой курьер - должен взять именно то, что требуется для заказов
                bottles_12_needed = total_bottles_12
                bottles_19_needed = total_bottles_19
                courier_total_capacity = courier.get("capacity", 100)
                
                print(f"  Тип курьера: ПУСТОЙ", file=sys.stderr)
                print(f"  Курьер должен взять: 12л={bottles_12_needed}, 19л={bottles_19_needed}", file=sys.stderr)
                
                # Для пустых курьеров показываем что нужно взять
                courier_should_take = {
                    "bottles_12": bottles_12_needed,
                    "bottles_19": bottles_19_needed,
                    "total": bottles_12_needed + bottles_19_needed
                }
                
            else:
                # Загруженный курьер - используем имеющиеся бутылки, НЕ показываем "сколько взять"
                courier_total_capacity = courier_capacity_12 + courier_capacity_19
                
                print(f"  Тип курьера: ЗАГРУЖЕННЫЙ", file=sys.stderr)
                print(f"  Имеющиеся бутылки: 12л={courier_capacity_12}, 19л={courier_capacity_19}", file=sys.stderr)
                
                # Проверяем достаточность бутылок
                if total_bottles_12 > courier_capacity_12:
                    print(f"  ⚠️  ВНИМАНИЕ: Требуется 12л={total_bottles_12}, но у курьера только {courier_capacity_12}", file=sys.stderr)
                if total_bottles_19 > courier_capacity_19:
                    print(f"  ⚠️  ВНИМАНИЕ: Требуется 19л={total_bottles_19}, но у курьера только {courier_capacity_19}", file=sys.stderr)
                
                # Для загруженных курьеров НЕ показываем "сколько взять" - они уже загружены
                courier_should_take = {
                    "bottles_12": 0,  # Не нужно брать - уже есть
                    "bottles_19": 0,  # Не нужно брать - уже есть
                    "total": 0
                }
            
            # Проверяем общую вместимость
            if total_bottles > courier_total_capacity:
                print(f"  ❌ ОШИБКА: Требуется {total_bottles} бутылок, но общая вместимость {courier_total_capacity}", file=sys.stderr)
            
            print(f"  Количество заказов: {len(route_orders)}", file=sys.stderr)
            print(f"  Требуется бутылок: 12л={total_bottles_12}, 19л={total_bottles_19}, всего={total_bottles}", file=sys.stderr)
            print(f"  Использование вместимости: {100*total_bottles/max(courier_total_capacity,1):.1f}%", file=sys.stderr)
            
            total_distance += route_distance
            active_couriers += 1
            
            route_info = {
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
                "courier_should_take": courier_should_take,
                "capacity_utilization": {
                    "percent": round(100 * total_bottles / max(courier_total_capacity, 1), 1)
                },
                "has_active_order": has_active_order,
                "courier_type": courier_type
            }
            
            # Добавляем информацию о специальных ограничениях
            if has_special_restrictions:
                route_info["special_restrictions"] = {
                    "max_bottles_12": max_bottles_12,
                    "max_bottles_19": max_bottles_19,
                    "reason": reason,
                    "violations": {
                        "bottles_12": max(0, total_bottles_12 - max_bottles_12),
                        "bottles_19": max(0, total_bottles_19 - max_bottles_19)
                    }
                }
            
            routes.append(route_info)
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
    print(f"Активных заказов: {len(active_order_ids)}", file=sys.stderr)
    print(f"Балансировка нагрузки: {balance_score} (0 = идеальная балансировка)", file=sys.stderr)
    print(f"Распределение заказов: {orders_counts}", file=sys.stderr)
    
    # Статистика по бутылкам
    print(f"\n=== СТАТИСТИКА ПО БУТЫЛКАМ ===", file=sys.stderr)
    for route in routes:
        courier_id = route["courier_id"]
        required = route["required_bottles"]
        should_take = route["courier_should_take"]
        utilization = route["capacity_utilization"]["percent"]
        active_status = " (с активным заказом)" if route["has_active_order"] else ""
        
        print(f"  {courier_id}{active_status}:", file=sys.stderr)
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