#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Visualize Routes API - принимает данные из JSON файла и создает визуализацию
"""

import sys
import json
import os
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyBboxPatch
import matplotlib.patches as mpatches


def visualize_routes_from_data(couriers, orders, routes, common_depot):
    """Создает визуализацию маршрутов на основе переданных данных"""
    
    # Удаляем старый файл визуализации, если он существует
    if os.path.exists('vrp_routes_visualization.png'):
        os.remove('vrp_routes_visualization.png')
    
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
                   c=colors[i % len(colors)], s=150, marker='^', 
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
        color = colors[i % len(colors)]
        
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
    
    # Вычисляем статистику
    total_distance = sum(route['distance_km'] for route in routes)
    total_orders_served = sum(route['orders_count'] for route in routes)
    
    # Настройка осей и заголовка
    plt.xlabel('Долгота', fontsize=12)
    plt.ylabel('Широта', fontsize=12)
    plt.title('VRP Решение: Маршруты курьеров с общим депо\n' + 
              f'Общее расстояние: {total_distance:.2f} км, Обслужено: {total_orders_served}/{len(orders)} заказов', 
              fontsize=14)
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
    plt.close()  # Закрываем фигуру, чтобы освободить память
    
    return {
        'success': True,
        'image_path': 'vrp_routes_visualization.png',
        'total_distance_km': total_distance,
        'total_orders_served': total_orders_served,
        'total_orders': len(orders),
        'couriers_used': len(routes)
    }


def main():
    """Основная функция"""
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Использование: python visualize_routes_api.py <input_file.json>"}))
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    try:
        # Читаем входные данные
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        couriers = data.get('couriers', [])
        orders = data.get('orders', [])
        routes = data.get('routes', [])
        common_depot = data.get('common_depot', {"id": "depot", "lat": 43.16857, "lon": 76.89642})
        
        # Проверяем данные
        if not couriers:
            print(json.dumps({"error": "Не указаны курьеры"}))
            sys.exit(1)
        
        if not orders:
            print(json.dumps({"error": "Не указаны заказы"}))
            sys.exit(1)
        
        if not routes:
            print(json.dumps({"error": "Не указаны маршруты"}))
            sys.exit(1)
        
        # Создаем визуализацию
        result = visualize_routes_from_data(couriers, orders, routes, common_depot)
        
        # Выводим результат
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except FileNotFoundError:
        print(json.dumps({"error": f"Файл {input_file} не найден"}))
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Ошибка парсинга JSON: {e}"}))
        sys.exit(1)
    except ImportError as e:
        print(json.dumps({"error": f"Ошибка импорта библиотек: {e}. Убедитесь, что установлен matplotlib"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Неожиданная ошибка: {e}"}))
        sys.exit(1)


if __name__ == "__main__":
    main() 