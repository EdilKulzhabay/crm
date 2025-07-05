#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VRP Solver API - принимает данные из JSON файла и возвращает результат
"""

import sys
import json
import math
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp


def calculate_distance(lat1, lon1, lat2, lon2):
    """Вычисляет расстояние между двумя точками в километрах"""
    R = 6371  # Радиус Земли в километрах
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


def create_distance_matrix(couriers, orders, common_depot):
    """Создает матрицу расстояний"""
    # Все точки: депо + курьеры + заказы
    all_points = [common_depot] + couriers + orders
    
    matrix = []
    for i, point1 in enumerate(all_points):
        row = []
        for j, point2 in enumerate(all_points):
            if i == j:
                row.append(0)
            else:
                distance = calculate_distance(
                    point1['lat'], point1['lon'],
                    point2['lat'], point2['lon']
                )
                # Переводим в метры и округляем
                row.append(int(distance * 1000))
        matrix.append(row)
    
    return matrix


def solve_vrp(couriers, orders, courier_restrictions, common_depot):
    """Решает VRP с ограничениями"""
    
    # Создаем матрицу расстояний
    distance_matrix = create_distance_matrix(couriers, orders, common_depot)
    
    # Индексы: 0 - депо, 1..len(couriers) - курьеры, остальные - заказы
    depot_index = 0
    courier_start_indices = list(range(1, len(couriers) + 1))
    order_start_index = len(couriers) + 1
    
    # Создаем менеджер маршрутизации
    manager = pywrapcp.RoutingIndexManager(
        len(distance_matrix),
        len(couriers),
        courier_start_indices,  # Стартовые точки курьеров
        [depot_index] * len(couriers)  # Все возвращаются в депо
    )
    
    # Создаем модель маршрутизации
    routing = pywrapcp.RoutingModel(manager)
    
    # Функция расчета расстояния
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]
    
    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    
    # Добавляем ограничения курьеров
    for order_id, allowed_couriers in courier_restrictions.items():
        # Находим индекс заказа
        order_index = None
        for i, order in enumerate(orders):
            if order['id'] == order_id:
                order_index = order_start_index + i
                break
        
        if order_index is not None:
            # Создаем список разрешенных курьеров (индексы транспортных средств)
            if not allowed_couriers:
                # Если пустой список - заказ нельзя обслужить
                routing.solver().Add(routing.VehicleVar(order_index) == -1)
            else:
                # Преобразуем индексы курьеров (1-based) в индексы транспортных средств (0-based)
                allowed_vehicles = [idx - 1 for idx in allowed_couriers if 0 <= idx - 1 < len(couriers)]
                if allowed_vehicles:
                    # Создаем ограничение: заказ может быть обслужен только указанными курьерами
                    constraint = routing.solver().IntVar(allowed_vehicles, f'courier_for_{order_id}')
                    routing.solver().Add(routing.VehicleVar(order_index) == constraint)
    
    # Настройки поиска
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.seconds = 30
    
    # Решаем задачу
    solution = routing.SolveWithParameters(search_parameters)
    
    if solution:
        return format_solution(manager, routing, solution, couriers, orders, distance_matrix)
    else:
        return {"error": "Не удалось найти решение"}


def format_solution(manager, routing, solution, couriers, orders, distance_matrix):
    """Форматирует решение в удобный вид"""
    routes = []
    total_distance = 0
    total_orders = 0
    
    order_start_index = len(couriers) + 1
    
    for vehicle_id in range(len(couriers)):
        route_distance = 0
        route_orders = []
        
        index = routing.Start(vehicle_id)
        
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            next_index = solution.Value(routing.NextVar(index))
            next_node = manager.IndexToNode(next_index)
            
            # Если следующий узел - заказ
            if order_start_index <= next_node < order_start_index + len(orders):
                order_idx = next_node - order_start_index
                route_orders.append(orders[order_idx]['id'])
            
            route_distance += distance_matrix[node][next_node]
            index = next_index
        
        if route_orders:  # Только если есть заказы
            routes.append({
                'courier_id': couriers[vehicle_id]['id'],
                'orders': route_orders,
                'orders_count': len(route_orders),
                'distance_meters': route_distance,
                'distance_km': round(route_distance / 1000, 2)
            })
            total_distance += route_distance
            total_orders += len(route_orders)
    
    return {
        'routes': routes,
        'total_distance_km': round(total_distance / 1000, 2),
        'total_distance_meters': total_distance,
        'total_orders_served': total_orders,
        'couriers_used': len(routes),
        'total_couriers': len(couriers)
    }


def main():
    """Основная функция"""
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Использование: python vrp_solver_api.py <input_file.json>"}))
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    try:
        # Читаем входные данные
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        couriers = data.get('couriers', [])
        orders = data.get('orders', [])
        courier_restrictions = data.get('courier_restrictions', {})
        common_depot = data.get('common_depot', {"id": "depot", "lat": 43.16857, "lon": 76.89642})
        
        # Проверяем данные
        if not couriers:
            print(json.dumps({"error": "Не указаны курьеры"}))
            sys.exit(1)
        
        if not orders:
            print(json.dumps({"error": "Не указаны заказы"}))
            sys.exit(1)
        
        # Решаем VRP
        result = solve_vrp(couriers, orders, courier_restrictions, common_depot)
        
        # Выводим результат
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except FileNotFoundError:
        print(json.dumps({"error": f"Файл {input_file} не найден"}))
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Ошибка парсинга JSON: {e}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Неожиданная ошибка: {e}"}))
        sys.exit(1)


if __name__ == "__main__":
    main() 