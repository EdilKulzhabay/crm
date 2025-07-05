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

# Удаляем старый файл визуализации, если он существует
if os.path.exists('vrp_routes_visualization.png'):
    os.remove('vrp_routes_visualization.png')
    print("Старый файл визуализации удален")

# Общая точка возврата для всех курьеров
common_depot = {"id": "depot", "lat": 43.16857, "lon": 76.89642}

# Курьеры в разных районах города
couriers = [
    {"id": "courier1", "lat": 43.207262, "lon": 76.893349},  # Центр
    {"id": "courier2", "lat": 43.22000, "lon": 76.85000},  # Запад
    {"id": "courier3", "lat": 43.28000, "lon": 76.95000},  # Север-Восток
]

# Реальные заказы из базы данных
orders = [
    {"id": "order1", "lat": 43.212409, "lon": 76.842149},
    {"id": "order2", "lat": 43.249392, "lon": 76.887507},
    {"id": "order3", "lat": 43.245447, "lon": 76.903766},
    {"id": "order4", "lat": 43.230026, "lon": 76.94556},
    {"id": "order5", "lat": 43.228736, "lon": 76.839826},
    {"id": "order6", "lat": 43.292268, "lon": 76.931119},
    {"id": "order7", "lat": 43.261362, "lon": 76.929122},
    {"id": "order8", "lat": 43.236701, "lon": 76.845539},
    {"id": "order9", "lat": 43.257476, "lon": 76.905942},
    {"id": "order10", "lat": 43.236031, "lon": 76.837653},
]

# Результаты решения VRP (из последнего запуска)
routes = [{'courier_id': 'courier1',
  'distance_km': 9.12,
  'distance_meters': 9124,
  'orders': ['order3', 'order4'],
  'orders_count': 2},
 {'courier_id': 'courier2',
  'distance_km': 6.19,
  'distance_meters': 6189,
  'orders': ['order8', 'order10', 'order5', 'order1'],
  'orders_count': 4},
 {'courier_id': 'courier3',
  'distance_km': 10.16,
  'distance_meters': 10156,
  'orders': ['order6', 'order7', 'order9', 'order2'],
  'orders_count': 4}]

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
    
    # Линия возврата к общему депо
    if route['orders']:  # Если есть заказы
        plt.plot([current_lon, common_depot['lon']], [current_lat, common_depot['lat']], 
                color=color, linewidth=2, alpha=0.7, linestyle='--', zorder=3)
        
        # Стрелка возврата к депо
        plt.annotate('', xy=(common_depot['lon'], common_depot['lat']), 
                    xytext=(current_lon, current_lat),
                    arrowprops=dict(arrowstyle='->', color=color, lw=1.5, alpha=0.7),
                    zorder=4)

# Настройка осей и заголовка
plt.xlabel('Долгота', fontsize=12)
plt.ylabel('Широта', fontsize=12)
plt.title('VRP Решение: Маршруты курьеров с общим депо\n' + 
          f'Общее расстояние: 28.01 км, Обслужено: 12/13 заказов', fontsize=14)
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
print("\nАнализ оптимальности маршрутов:")
print("=" * 50)

for route in routes:
    courier = couriers_dict[route['courier_id']]
    print(f"\n{route['courier_id']}:")
    print(f"  Старт: ({courier['lat']:.3f}, {courier['lon']:.3f})")
    print(f"  Заказы: {', '.join(route['orders'])}")
    print(f"  Расстояние: {route['distance_km']} км")
    print(f"  Возврат в депо: ({common_depot['lat']:.3f}, {common_depot['lon']:.3f})")

unserved = [order['id'] for order in orders if order['id'] not in served_orders]
if unserved:
    print(f"\nНеобслуженные заказы: {', '.join(unserved)}")
    for order_id in unserved:
        order = orders_dict[order_id]
        print(f"  {order_id}: ({order['lat']:.3f}, {order['lon']:.3f})")

print(f"\nИтого:")
print(f"  Общее расстояние: 28.01 км")
print(f"  Используется курьеров: {len(routes)}/3")
print(f"  Обслужено заказов: {sum(route['orders_count'] for route in routes)}/13") 