#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Визуализация маршрутов курьеров на карте
"""

import matplotlib.pyplot as plt
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
# Создаем словари для быстрого поиска
orders_dict = {order['id']: order for order in orders}
couriers_dict = {courier['id']: courier for courier in couriers}

# Настройка графика
plt.figure(figsize=(15, 12))
colors = ['red', 'blue', 'green', 'orange', 'purple', 'brown']

# Отображаем общий депо
plt.scatter(common_depot['lon'], common_depot['lat'], 
           c='black', s=200, marker='s', 
           label=f'Общий депо ({common_depot["lat"]:.3f}, {common_depot["lon"]:.3f})', 
           zorder=10)

# Отображаем стартовые позиции курьеров
for i, courier in enumerate(couriers):
    plt.scatter(courier['lon'], courier['lat'], 
               c=colors[i], s=150, marker='^', 
               label=f'{courier["id"]} старт ({courier["lat"]:.3f}, {courier["lon"]:.3f})', 
               zorder=9)

# Отображаем заказы
served_orders = set()
for route in routes:
    served_orders.update(route['orders'])

for order in orders:
    if order['id'] in served_orders:
        plt.scatter(order['lon'], order['lat'], 
                   c='lightgreen', s=80, marker='o', 
                   alpha=0.7, zorder=5)
        plt.annotate(order['id'], (order['lon'], order['lat']), 
                    xytext=(5, 5), textcoords='offset points', fontsize=8)
    else:
        plt.scatter(order['lon'], order['lat'], 
                   c='lightcoral', s=80, marker='x', 
                   alpha=0.7, zorder=5)
        plt.annotate(f"{order['id']} (не обслужен)", (order['lon'], order['lat']), 
                    xytext=(5, 5), textcoords='offset points', fontsize=8)

# Отображаем маршруты
for i, route in enumerate(routes):
    courier = couriers_dict[route['courier_id']]
    color = colors[i]
    
    # Начинаем маршрут от стартовой позиции курьера
    current_lat, current_lon = courier['lat'], courier['lon']
    
    # Проверяем, есть ли точка доукомплектования
    refill_point = route.get('refill_point')
    refill_after_index = refill_point['after_order_index'] if refill_point else None
    
    # Если доукомплектование в начале маршрута
    if refill_point and refill_after_index is None:
        # Рисуем маршрут от старта к депо (пунктирная линия)
        plt.plot([courier['lon'], common_depot['lon']], [courier['lat'], common_depot['lat']], 
                color=color, linewidth=2, linestyle='--', alpha=0.8, zorder=3)
        
        # Стрелка к депо
        plt.annotate('', xy=(common_depot['lon'], common_depot['lat']), 
                    xytext=(courier['lon'], courier['lat']),
                    arrowprops=dict(arrowstyle='->', color=color, lw=1.5, alpha=0.8, linestyle='dashed'),
                    zorder=4)
        
        # Добавляем подпись "ДОУКОМПЛЕКТОВАНИЕ"
        mid_lon = (courier['lon'] + common_depot['lon']) / 2
        mid_lat = (courier['lat'] + common_depot['lat']) / 2
        plt.annotate('ДОУКОМПЛЕКТОВАНИЕ', (mid_lon, mid_lat), 
                    xytext=(0, 10), textcoords='offset points', 
                    fontsize=8, color=color, weight='bold',
                    bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.8),
                    ha='center', zorder=6)
        
        # Обновляем текущую позицию на депо
        current_lat, current_lon = common_depot['lat'], common_depot['lon']
    
    # Строим маршрут через заказы
    for order_index, order_id in enumerate(route['orders']):
        order = orders_dict[order_id]
        
        # Линия от текущей позиции к заказу
        plt.plot([current_lon, order['lon']], [current_lat, order['lat']], 
                color=color, linewidth=2, alpha=0.7, zorder=3)
        
        # Стрелка направления
        plt.annotate('', xy=(order['lon'], order['lat']), 
                    xytext=(current_lon, current_lat),
                    arrowprops=dict(arrowstyle='->', color=color, lw=1.5, alpha=0.7),
                    zorder=4)
        
        current_lat, current_lon = order['lat'], order['lon']
        
        # Проверяем, нужно ли доукомплектование после этого заказа
        if refill_after_index is not None and order_index == refill_after_index:
            # Рисуем маршрут к депо (пунктирная линия)
            plt.plot([current_lon, common_depot['lon']], [current_lat, common_depot['lat']], 
                    color=color, linewidth=2, linestyle='--', alpha=0.8, zorder=3)
            
            # Стрелка к депо
            plt.annotate('', xy=(common_depot['lon'], common_depot['lat']), 
                        xytext=(current_lon, current_lat),
                        arrowprops=dict(arrowstyle='->', color=color, lw=1.5, alpha=0.8, linestyle='dashed'),
                        zorder=4)
            
            # Добавляем подпись "ДОУКОМПЛЕКТОВАНИЕ"
            mid_lon = (current_lon + common_depot['lon']) / 2
            mid_lat = (current_lat + common_depot['lat']) / 2
            plt.annotate('ДОУКОМПЛЕКТОВАНИЕ', (mid_lon, mid_lat), 
                        xytext=(0, 10), textcoords='offset points', 
                        fontsize=8, color=color, weight='bold',
                        bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.8),
                        ha='center', zorder=6)
            
            # Обновляем текущую позицию на депо
            current_lat, current_lon = common_depot['lat'], common_depot['lon']
    
    # ОТКРЫТЫЕ МАРШРУТЫ: Убираем возврат к депо в конце
    # Курьер заканчивает маршрут в последнем заказе или в депо (если было доукомплектование)

# Настройка осей и заголовка
plt.xlabel('Долгота', fontsize=12)
plt.ylabel('Широта', fontsize=12)
plt.title('VRP Решение: Открытые маршруты курьеров (без возврата в депо)\n' + 
          f'Общее расстояние: {sum(route["distance_km"] for route in routes):.2f} км, ' + 
          f'Обслужено: {sum(route["orders_count"] for route in routes)}/{len(orders)} заказов', fontsize=14)

# Добавляем дополнительные элементы легенды
refill_line = plt.Line2D([0], [0], color='gray', linewidth=2, linestyle='--', alpha=0.8, label='Маршрут доукомплектования')
plt.legend(handles=plt.gca().get_legend_handles_labels()[0] + [refill_line], 
          bbox_to_anchor=(1.05, 1), loc='upper left')

plt.grid(True, alpha=0.3)

# Добавляем информацию о маршрутах
info_text = "Детали маршрутов:\n"
for route in routes:
    info_text += f"• {route['courier_id']}: {route['orders_count']} заказов, {route['distance_km']} км\n"

plt.figtext(0.02, 0.02, info_text, fontsize=10, 
           bbox=dict(boxstyle="round,pad=0.3", facecolor="lightgray", alpha=0.8))

plt.tight_layout()
plt.savefig('vrp_routes_visualization.png', dpi=300, bbox_inches='tight')
# plt.show()  # Убираем показ окна, чтобы программа не блокировалась

print("Визуализация сохранена в файл: vrp_routes_visualization.png")

# Анализ оптимальности
print("\nАнализ оптимальности открытых маршрутов:")
print("=" * 50)

for route in routes:
    courier = couriers_dict[route['courier_id']]
    print(f"\n{route['courier_id']}:")
    print(f"  Старт: ({courier['lat']:.3f}, {courier['lon']:.3f})")
    print(f"  Заказы: {', '.join(route['orders'])}")
    print(f"  Расстояние: {route['distance_km']} км")
    
    # Информация о доукомплектовании
    if route.get('refill_needed'):
        refill = route['refill_needed']
        print(f"  🔄 Доукомплектование: 12л={refill['bottles_12']}, 19л={refill['bottles_19']}, всего={refill['total']}")
        
        if route.get('refill_point'):
            refill_point = route['refill_point']
            if refill_point['after_order_id']:
                print(f"  📍 Точка доукомплектования: после заказа {refill_point['after_order_id']}, перед заказом {refill_point['before_order_id']}")
            else:
                print(f"  📍 Точка доукомплектования: в начале маршрута, перед заказом {refill_point['before_order_id']}")
    
    if route['orders']:
        last_order = orders_dict[route['orders'][-1]]
        print(f"  Завершение: ({last_order['lat']:.3f}, {last_order['lon']:.3f}) - последний заказ")
    else:
        print(f"  Завершение: стартовая позиция (нет заказов)")

unserved = [order['id'] for order in orders if order['id'] not in served_orders]
if unserved:
    print(f"\nНеобслуженные заказы: {', '.join(unserved)}")
    for order_id in unserved:
        order = orders_dict[order_id]
        print(f"  {order_id}: ({order['lat']:.3f}, {order['lon']:.3f})")

print(f"\nИтого:")
print(f"  Общее расстояние: {sum(route['distance_km'] for route in routes):.2f} км")
print(f"  Используется курьеров: {len(routes)}/{len(couriers)}")
print(f"  Обслужено заказов: {sum(route['orders_count'] for route in routes)}/{len(orders)}") 