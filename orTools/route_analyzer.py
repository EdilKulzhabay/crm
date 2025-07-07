#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Анализ и сравнение маршрутов курьеров
"""

import math
import json

def haversine(lat1, lon1, lat2, lon2):
    """Вычисляет расстояние между двумя точками в км"""
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

def calculate_route_distance(courier_pos, order_positions):
    """Вычисляет общее расстояние маршрута"""
    if not order_positions:
        return 0
    
    total_distance = 0
    current_pos = courier_pos
    
    for order_pos in order_positions:
        distance = haversine(current_pos['lat'], current_pos['lon'], 
                           order_pos['lat'], order_pos['lon'])
        total_distance += distance
        current_pos = order_pos
    
    return total_distance

# Данные курьеров
couriers = {
    'courier_2': {'lat': 43.2044094, 'lon': 76.893334},
    'courier_3': {'lat': 43.215678, 'lon': 76.912345}
}

# Данные заказов
orders = {
    'order_1': {'lat': 43.292268, 'lon': 76.931119},
    'order_2': {'lat': 43.261362, 'lon': 76.929122},
    'order_4': {'lat': 43.228644, 'lon': 76.866358},
    'order_6': {'lat': 43.254082, 'lon': 76.918261},
    'order_8': {'lat': 43.237369, 'lon': 76.938627},
    'order_9': {'lat': 43.252214, 'lon': 76.90054},
    'order_14': {'lat': 43.234567, 'lon': 76.912345},
    'order_15': {'lat': 43.212045, 'lon': 76.872848},
    'order_17': {'lat': 43.264191, 'lon': 76.932518},
    'order_18': {'lat': 43.245678, 'lon': 76.887654},
    'order_20': {'lat': 43.242453, 'lon': 76.9409},
    'order_21': {'lat': 43.234567, 'lon': 76.923456}
}

print("=== АНАЛИЗ МАРШРУТОВ ===")
print()

# Текущее распределение (из OR-Tools)
print("1. ТЕКУЩЕЕ РАСПРЕДЕЛЕНИЕ (OR-Tools):")
current_courier2_orders = ['order_15', 'order_4', 'order_14', 'order_21', 'order_8', 'order_20']
current_courier3_orders = ['order_18', 'order_9', 'order_6', 'order_2', 'order_17', 'order_1']

courier2_positions = [orders[order_id] for order_id in current_courier2_orders]
courier3_positions = [orders[order_id] for order_id in current_courier3_orders]

current_courier2_distance = calculate_route_distance(couriers['courier_2'], courier2_positions)
current_courier3_distance = calculate_route_distance(couriers['courier_3'], courier3_positions)

print(f"Courier_2: {current_courier2_orders}")
print(f"  Расстояние: {current_courier2_distance:.2f} км")
print(f"Courier_3: {current_courier3_orders}")
print(f"  Расстояние: {current_courier3_distance:.2f} км")
print(f"  Общее расстояние: {current_courier2_distance + current_courier3_distance:.2f} км")
print()

# Предложенное распределение
print("2. ПРЕДЛОЖЕННОЕ РАСПРЕДЕЛЕНИЕ:")
proposed_courier2_orders = ['order_15', 'order_4', 'order_18', 'order_9', 'order_6']  # Убрал дублирующий order_6
proposed_courier3_orders = ['order_14', 'order_21', 'order_8', 'order_20', 'order_17', 'order_1', 'order_2']  # Добавил order_2

courier2_positions_new = [orders[order_id] for order_id in proposed_courier2_orders]
courier3_positions_new = [orders[order_id] for order_id in proposed_courier3_orders]

proposed_courier2_distance = calculate_route_distance(couriers['courier_2'], courier2_positions_new)
proposed_courier3_distance = calculate_route_distance(couriers['courier_3'], courier3_positions_new)

print(f"Courier_2: {proposed_courier2_orders}")
print(f"  Расстояние: {proposed_courier2_distance:.2f} км")
print(f"Courier_3: {proposed_courier3_orders}")
print(f"  Расстояние: {proposed_courier3_distance:.2f} км")
print(f"  Общее расстояние: {proposed_courier2_distance + proposed_courier3_distance:.2f} км")
print()

# Сравнение
print("3. СРАВНЕНИЕ:")
current_total = current_courier2_distance + current_courier3_distance
proposed_total = proposed_courier2_distance + proposed_courier3_distance
difference = proposed_total - current_total

print(f"Текущее решение:     {current_total:.2f} км")
print(f"Предложенное решение: {proposed_total:.2f} км")
print(f"Разница:             {difference:+.2f} км")

if difference < 0:
    print(f"✅ Предложенное решение ЛУЧШЕ на {abs(difference):.2f} км!")
elif difference > 0:
    print(f"❌ Предложенное решение ХУЖЕ на {difference:.2f} км")
else:
    print("🤔 Решения одинаковы по расстоянию")

print()

# Анализ балансировки
print("4. АНАЛИЗ БАЛАНСИРОВКИ:")
print(f"Текущее:     Courier_2: {len(current_courier2_orders)} заказов, Courier_3: {len(current_courier3_orders)} заказов")
print(f"Предложенное: Courier_2: {len(proposed_courier2_orders)} заказов, Courier_3: {len(proposed_courier3_orders)} заказов")

current_balance = abs(len(current_courier2_orders) - len(current_courier3_orders))
proposed_balance = abs(len(proposed_courier2_orders) - len(proposed_courier3_orders))

print(f"Дисбаланс - Текущий: {current_balance}, Предложенный: {proposed_balance}")

if proposed_balance < current_balance:
    print("✅ Предложенное решение лучше сбалансировано!")
elif proposed_balance > current_balance:
    print("❌ Предложенное решение хуже сбалансировано")
else:
    print("🤔 Балансировка одинаковая")

print()

# Детальный анализ расстояний между точками
print("5. ДЕТАЛЬНЫЙ АНАЛИЗ ПЕРЕХОДОВ:")
print()

def analyze_route_details(courier_name, courier_pos, order_ids):
    print(f"{courier_name}:")
    print(f"  Старт: ({courier_pos['lat']:.3f}, {courier_pos['lon']:.3f})")
    
    current_pos = courier_pos
    total_distance = 0
    
    for i, order_id in enumerate(order_ids):
        order_pos = orders[order_id]
        distance = haversine(current_pos['lat'], current_pos['lon'], 
                           order_pos['lat'], order_pos['lon'])
        total_distance += distance
        
        print(f"  {i+1}. {order_id}: ({order_pos['lat']:.3f}, {order_pos['lon']:.3f}) - {distance:.2f} км")
        current_pos = order_pos
    
    print(f"  Общее расстояние: {total_distance:.2f} км")
    print()

print("ТЕКУЩИЕ МАРШРУТЫ:")
analyze_route_details("Courier_2", couriers['courier_2'], current_courier2_orders)
analyze_route_details("Courier_3", couriers['courier_3'], current_courier3_orders)

print("ПРЕДЛОЖЕННЫЕ МАРШРУТЫ:")
analyze_route_details("Courier_2", couriers['courier_2'], proposed_courier2_orders)
analyze_route_details("Courier_3", couriers['courier_3'], proposed_courier3_orders) 