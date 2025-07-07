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
    
    # Строим маршрут через заказы
    for order_id in route['orders']:
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
    
    # ОТКРЫТЫЕ МАРШРУТЫ: Убираем возврат к депо
    # Курьер заканчивает маршрут в последнем заказе

# Настройка осей и заголовка
plt.xlabel('Долгота', fontsize=12)
plt.ylabel('Широта', fontsize=12)
plt.title('VRP Решение: Открытые маршруты курьеров (без возврата в депо)\n' + 
          f'Общее расстояние: {sum(route["distance_km"] for route in routes):.2f} км, ' + 
          f'Обслужено: {sum(route["orders_count"] for route in routes)}/{len(orders)} заказов', fontsize=14)
plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
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