#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Визуализация маршрутов курьеров на карте с учетом активных заказов
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.lines import Line2D
import numpy as np
from matplotlib.patches import FancyBboxPatch
import matplotlib.patches as mpatches
import os
import sys
import json

input_data = json.load(sys.stdin)

# Удаляем старый файл визуализации, если он существует
if os.path.exists('vrp_routes_visualization.png'):
    os.remove('vrp_routes_visualization.png')
    print("Старый файл визуализации удален")

# Общая точка возврата для всех курьеров
common_depot = {"id": "depot", "lat": 43.16857, "lon": 76.89642}

couriers = input_data["couriers"]
orders = input_data["orders"]
routes = input_data["routes"]

# Собираем информацию об активных заказах из структуры курьеров
active_orders = set()
courier_active_orders = {}
active_orders_data = {}

for courier in couriers:
    if courier.get("order") and courier["order"].get("status") == "onTheWay":
        active_order_id = courier["order"]["id"]  # Используем "id" вместо "orderId"
        active_orders.add(active_order_id)
        courier_active_orders[courier['id']] = active_order_id
        
        # Создаем данные для активного заказа
        active_order = courier["order"]
        active_orders_data[active_order_id] = {
            "id": active_order_id,
            "lat": active_order["lat"],
            "lon": active_order["lon"],
            "bottles_12": active_order.get("bottles_12", 0),
            "bottles_19": active_order.get("bottles_19", 0)
        }

# Объединяем переданные заказы с активными заказами для визуализации
all_orders_for_viz = list(orders)
for active_order_data in active_orders_data.values():
    all_orders_for_viz.append(active_order_data)

# Создаем словари для быстрого поиска (включая активные заказы)
orders_dict = {order['id']: order for order in all_orders_for_viz}
couriers_dict = {courier['id']: courier for courier in couriers}

# Настройка графика
plt.figure(figsize=(20, 16))
# Цвета для курьеров (расширенный набор)
colors = ['red', 'blue', 'green', 'orange', 'purple', 'brown', 'pink', 'gray', 'olive', 'cyan', 'magenta', 'yellow', 'black', 'navy', 'teal', 'maroon']

# Отображаем общий депо
plt.scatter(common_depot['lon'], common_depot['lat'], 
           c='black', s=200, marker='s', 
           label=f'Общий депо ({common_depot["lat"]:.3f}, {common_depot["lon"]:.3f})', 
           zorder=10)

# Отображаем стартовые позиции курьеров
for i, courier in enumerate(couriers):
    # Проверяем, есть ли активный заказ
    has_active_order = courier['id'] in courier_active_orders
    marker_style = '^' if not has_active_order else 'D'  # Ромб для курьеров с активными заказами
    
    active_info = f" (активный: {courier_active_orders[courier['id']]})" if has_active_order else ""
    
    plt.scatter(courier['lon'], courier['lat'], 
               c=colors[i], s=150, marker=marker_style, 
               label=f'{courier["id"]} старт ({courier["lat"]:.3f}, {courier["lon"]:.3f}){active_info}', 
               zorder=9)

# Отображаем заказы с разделением на активные и новые
served_orders = set()
for route in routes:
    if 'orders' in route and route['orders']:
        served_orders.update(route['orders'])

for order in all_orders_for_viz:
    if order['id'] in served_orders:
        # Используем orderName если доступно, иначе id
        order_display_name = order.get('orderName', order['id'])
        
        if order['id'] in active_orders:
            # Активные заказы - красный круг с толстой границей
            plt.scatter(order['lon'], order['lat'], 
                       c='red', s=120, marker='o', 
                       edgecolors='darkred', linewidth=3,
                       alpha=0.8, zorder=6)
            plt.annotate(f"{order_display_name} [АКТИВНЫЙ]", (order['lon'], order['lat']), 
                        xytext=(5, 5), textcoords='offset points', fontsize=8, 
                        bbox=dict(boxstyle="round,pad=0.3", facecolor="red", alpha=0.7))
        else:
            # Новые заказы - зеленый круг
            plt.scatter(order['lon'], order['lat'], 
                       c='lightgreen', s=80, marker='o', 
                       alpha=0.7, zorder=5)
            plt.annotate(f"{order_display_name} [НОВЫЙ]", (order['lon'], order['lat']), 
                        xytext=(5, 5), textcoords='offset points', fontsize=8)
    else:
        # Необслуженные заказы
        order_display_name = order.get('orderName', order['id'])
        plt.scatter(order['lon'], order['lat'], 
                   c='lightcoral', s=80, marker='x', 
                   alpha=0.7, zorder=5)
        plt.annotate(f"{order_display_name} (не обслужен)", (order['lon'], order['lat']), 
                    xytext=(5, 5), textcoords='offset points', fontsize=8)

# Отображаем маршруты с учетом активных заказов
for i, route in enumerate(routes):
    # Пропускаем маршруты без заказов
    if 'orders' not in route or not route['orders']:
        continue
        
    courier = couriers_dict[route['courier_id']]
    color = colors[i]
    
    # Начинаем маршрут от стартовой позиции курьера
    current_lat, current_lon = courier['lat'], courier['lon']
    
    # Строим маршрут через заказы
    for j, order_id in enumerate(route['orders']):
        order = orders_dict[order_id]
        
        # Определяем стиль линии
        if order_id in active_orders:
            # Активные заказы - толстая сплошная линия
            line_style = '-'
            line_width = 3
            alpha = 0.9
        else:
            # Новые заказы - обычная линия
            line_style = '-'
            line_width = 2
            alpha = 0.7
        
        # Линия от текущей позиции к заказу
        plt.plot([current_lon, order['lon']], [current_lat, order['lat']], 
                color=color, linewidth=line_width, alpha=alpha, 
                linestyle=line_style, zorder=3)
        
        # Стрелка направления
        arrow_color = 'darkred' if order_id in active_orders else color
        arrow_width = 2 if order_id in active_orders else 1.5
        
        plt.annotate('', xy=(order['lon'], order['lat']), 
                    xytext=(current_lon, current_lat),
                    arrowprops=dict(arrowstyle='->', color=arrow_color, 
                                  lw=arrow_width, alpha=0.8),
                    zorder=4)
        
        # Добавляем номер последовательности
        mid_lat = (current_lat + order['lat']) / 2
        mid_lon = (current_lon + order['lon']) / 2
        
        sequence_color = 'white' if order_id in active_orders else 'yellow'
        plt.annotate(str(j + 1), (mid_lon, mid_lat), 
                    ha='center', va='center', fontsize=10, fontweight='bold',
                    bbox=dict(boxstyle="circle,pad=0.2", facecolor=sequence_color, 
                             edgecolor='black', alpha=0.8),
                    zorder=7)
        
        current_lat, current_lon = order['lat'], order['lon']

# Создаем легенду для типов заказов
legend_elements = [
    Line2D([0], [0], marker='o', color='w', markerfacecolor='red', 
               markersize=10, markeredgecolor='darkred', markeredgewidth=2,
               label='Активные заказы'),
    Line2D([0], [0], marker='o', color='w', markerfacecolor='lightgreen', 
               markersize=8, label='Новые заказы'),
    Line2D([0], [0], marker='x', color='w', markerfacecolor='lightcoral', 
               markersize=8, label='Необслуженные заказы'),
    Line2D([0], [0], marker='s', color='w', markerfacecolor='black', 
               markersize=10, label='Общий депо'),
    Line2D([0], [0], marker='^', color='w', markerfacecolor='gray', 
               markersize=8, label='Курьеры без активных заказов'),
    Line2D([0], [0], marker='D', color='w', markerfacecolor='gray', 
               markersize=8, label='Курьеры с активными заказами')
]

# Создаем легенду для цветов курьеров
courier_color_elements = []
for i, route in enumerate(routes):
    courier_id = route['courier_id']
    color = colors[i % len(colors)]  # Используем модуль для предотвращения выхода за границы
    courier_color_elements.append(
        Line2D([0], [0], color=color, linewidth=3, 
                   label=f'{courier_id} - {color}')
    )

# Если есть курьеры без маршрутов, добавляем и их
used_courier_ids = {route['courier_id'] for route in routes}
unused_courier_index = len(routes)
for courier in couriers:
    if courier['id'] not in used_courier_ids:
        color = colors[unused_courier_index % len(colors)]
        courier_color_elements.append(
            Line2D([0], [0], color=color, linewidth=3, 
                       label=f'{courier["id"]} - {color} (без заказов)')
        )
        unused_courier_index += 1

# Настройка осей и заголовка
plt.xlabel('Долгота', fontsize=12)
plt.ylabel('Широта', fontsize=12)

# Подсчитываем статистику
total_active_orders = len(active_orders)
total_new_orders = sum(len(route['orders']) for route in routes if 'orders' in route and route['orders']) - total_active_orders
total_distance = sum(route["distance_km"] for route in routes if "distance_km" in route)

plt.title(f'VRP Решение: Маршруты с активными заказами\n' + 
          f'Активных заказов: {total_active_orders}, Новых заказов: {total_new_orders}, ' + 
          f'Общее расстояние: {total_distance:.2f} км', fontsize=14)

# Основная легенда для курьеров (стартовые позиции)
main_legend = plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left', title='Курьеры (стартовые позиции)')

# Легенда для цветов курьеров (маршруты)
courier_legend = plt.legend(handles=courier_color_elements, bbox_to_anchor=(1.05, 0.75), 
                           loc='upper left', title='Цвета маршрутов курьеров')

# Дополнительная легенда для типов заказов
types_legend = plt.legend(handles=legend_elements, bbox_to_anchor=(1.05, 0.4), 
                         loc='upper left', title='Типы заказов и объектов')

# Сохраняем все легенды
plt.gca().add_artist(main_legend)
plt.gca().add_artist(courier_legend)

plt.grid(True, alpha=0.3)

# Добавляем детальную информацию о маршрутах
info_text = "Детали маршрутов:\n"
route_details_text = "Детальное описание маршрутов:\n\n"

for i, route in enumerate(routes):
    # Пропускаем маршруты без заказов
    if 'orders' not in route or not route['orders']:
        continue
        
    courier_id = route['courier_id']
    color = colors[i % len(colors)]
    active_count = sum(1 for order_id in route['orders'] if order_id in active_orders)
    new_count = len(route['orders']) - active_count
    
    info_text += f"• {courier_id} ({color}): {route['orders_count']} заказов "
    info_text += f"(активных: {active_count}, новых: {new_count}), "
    info_text += f"{route['distance_km']} км\n"
    
    # Добавляем детальное описание маршрута
    route_details_text += f"Маршрут для курьера {courier_id}:\n"
    
    # Начальная точка
    courier = couriers_dict[courier_id]
    if courier_id in courier_active_orders:
        active_order_id = courier_active_orders[courier_id]
        active_order = active_orders_data[active_order_id]
        route_details_text += f" -> {active_order_id} (активный заказ) (12л: {active_order.get('bottles_12', 0)}, 19л: {active_order.get('bottles_19', 0)}, Время: текущее)\n"
    else:
        route_details_text += f" -> courier_{courier_id}_start (12л: 0, 19л: 0, Время: текущее)\n"
    
    # Последовательность заказов с реальным временем
    arrival_times = route.get('arrival_times', {})
    for j, order_id in enumerate(route['orders']):
        order = orders_dict[order_id]
        
        # Используем реальное время прибытия, если доступно
        if order_id in arrival_times:
            arrival_seconds = arrival_times[order_id]
            # Конвертируем секунды в часы и минуты (секунды от начала дня)
            hours = int(arrival_seconds // 3600)
            minutes = int((arrival_seconds % 3600) // 60)
            time_str = f"{hours:02d}:{minutes:02d}"
        else:
            # Если время не найдено, используем примерное
            current_time_minutes = 0
            for k in range(j + 1):
                travel_time = 8 if k == 0 else 6
                current_time_minutes += travel_time
                service_time = 15  # 15 минут обслуживания
                current_time_minutes += service_time
            
            hours = current_time_minutes // 60
            minutes = current_time_minutes % 60
            time_str = f"{hours:02d}:{minutes:02d}"
        
        # Подсчитываем текущую загрузку
        current_load_12 = sum(orders_dict[prev_order_id].get('bottles_12', 0) for prev_order_id in route['orders'][:j+1])
        current_load_19 = sum(orders_dict[prev_order_id].get('bottles_19', 0) for prev_order_id in route['orders'][:j+1])
        
        route_details_text += f" -> {order_id} (12л: {current_load_12}, 19л: {current_load_19}, Время: {time_str})\n"
    
    route_details_text += "\n"

# Добавляем основную информацию в левый нижний угол
plt.figtext(0.02, 0.02, info_text, fontsize=10, 
           bbox=dict(boxstyle="round,pad=0.3", facecolor="lightgray", alpha=0.8))

# Добавляем детальное описание маршрутов в правую часть
plt.figtext(0.02, 0.35, route_details_text, fontsize=8, 
           bbox=dict(boxstyle="round,pad=0.3", facecolor="lightblue", alpha=0.9),
           verticalalignment='top')

plt.tight_layout()
plt.savefig('vrp_routes_visualization.png', dpi=300, bbox_inches='tight')
# plt.show()  # Убираем показ окна, чтобы программа не блокировалась

print("Визуализация сохранена в файл: vrp_routes_visualization.png")

# Анализ оптимальности с учетом активных заказов
print("\nАнализ маршрутов с активными заказами:")
print("=" * 60)

# Сначала выводим информацию о цветах курьеров
print("\n🎨 Цвета курьеров:")
for i, route in enumerate(routes):
    courier_id = route['courier_id']
    color = colors[i % len(colors)]
    print(f"  {courier_id}: {color}")

# Если есть курьеры без маршрутов, показываем и их цвета
used_courier_ids = {route['courier_id'] for route in routes}
unused_courier_index = len(routes)
unused_couriers = []
for courier in couriers:
    if courier['id'] not in used_courier_ids:
        color = colors[unused_courier_index % len(colors)]
        unused_couriers.append(f"{courier['id']}: {color}")
        unused_courier_index += 1

if unused_couriers:
    print("  Курьеры без заказов:")
    for courier_info in unused_couriers:
        print(f"    {courier_info}")

for i, route in enumerate(routes):
    # Пропускаем маршруты без заказов
    if 'orders' not in route or not route['orders']:
        continue
        
    courier = couriers_dict[route['courier_id']]
    courier_id = route['courier_id']
    color = colors[i % len(colors)]
    
    # Проверяем активные заказы для этого курьера
    active_orders_in_route = [order_id for order_id in route['orders'] if order_id in active_orders]
    new_orders_in_route = [order_id for order_id in route['orders'] if order_id not in active_orders]
    
    print(f"\n{courier_id} ({color}):")
    print(f"  Старт: ({courier['lat']:.3f}, {courier['lon']:.3f})")
    
    if active_orders_in_route:
        active_order_names = [orders_dict[order_id].get('orderName', order_id) for order_id in active_orders_in_route]
        print(f"  🚚 Активные заказы: {', '.join(active_order_names)}")
    if new_orders_in_route:
        new_order_names = [orders_dict[order_id].get('orderName', order_id) for order_id in new_orders_in_route]
        print(f"  📦 Новые заказы: {', '.join(new_order_names)}")
    
    print(f"  📊 Всего заказов: {len(route['orders'])} (активных: {len(active_orders_in_route)}, новых: {len(new_orders_in_route)})")
    print(f"  🛣️  Расстояние: {route['distance_km']} км")
    
    if route['orders']:
        last_order = orders_dict[route['orders'][-1]]
        last_order_name = last_order.get('orderName', last_order['id'])
        print(f"  🏁 Завершение: ({last_order['lat']:.3f}, {last_order['lon']:.3f}) - {last_order_name}")
        
        # Проверяем правильность последовательности (активные заказы должны быть первыми)
        if active_orders_in_route:
            first_order_is_active = route['orders'][0] in active_orders
            if first_order_is_active:
                print(f"  ✅ Правильная последовательность: сначала активный заказ")
            else:
                print(f"  ⚠️  Внимание: активный заказ не первый в маршруте")
    else:
        print(f"  🏁 Завершение: стартовая позиция (нет заказов)")

# Проверяем необслуженные заказы
served_orders = set()
for route in routes:
    if 'orders' in route and route['orders']:
        served_orders.update(route['orders'])

# Считаем необслуженными только новые заказы (не активные)
unserved = [order['id'] for order in orders if order['id'] not in served_orders]
if unserved:
    unserved_names = [orders_dict[order_id].get('orderName', order_id) for order_id in unserved]
    print(f"\n❌ Необслуженные заказы: {', '.join(unserved_names)}")
    for order_id in unserved:
        order = orders_dict[order_id]
        order_name = order.get('orderName', order_id)
        print(f"  {order_name} (НОВЫЙ): ({order['lat']:.3f}, {order['lon']:.3f})")

print(f"\n📈 Итоговая статистика:")
print(f"  Общее расстояние: {sum(route['distance_km'] for route in routes if 'distance_km' in route):.2f} км")
print(f"  Используется курьеров: {len(routes)}/{len(couriers)}")
print(f"  Обслужено заказов: {sum(route['orders_count'] for route in routes if 'orders_count' in route)}/{len(all_orders_for_viz)}")
print(f"  Активных заказов: {len(active_orders)}")
print(f"  Новых заказов для распределения: {len(orders)}")
print(f"  Новых заказов обслужено: {sum(route['orders_count'] for route in routes if 'orders_count' in route) - len(active_orders)}")
print(f"  Новых заказов не обслужено: {len(unserved)}")

# Проверка корректности обработки активных заказов
print(f"\n🔍 Проверка активных заказов:")
for courier_id, active_order_id in courier_active_orders.items():
    # Находим маршрут этого курьера
    courier_route = next((route for route in routes if route['courier_id'] == courier_id), None)
    
    if courier_route:
        if active_order_id in courier_route['orders']:
            order_position = courier_route['orders'].index(active_order_id) + 1
            if order_position == 1:
                print(f"  ✅ {courier_id}: активный заказ {active_order_id} идет первым")
            else:
                print(f"  ⚠️  {courier_id}: активный заказ {active_order_id} идет {order_position}-м (должен быть первым)")
        else:
            print(f"  ❌ {courier_id}: активный заказ {active_order_id} не найден в маршруте")
    else:
        print(f"  ❌ {courier_id}: маршрут не найден") 