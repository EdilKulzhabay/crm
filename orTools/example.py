#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Пример использования VRP-решателя
"""

import json
import requests
from vrp_solver import VRPSolver


def example_direct_usage():
    """
    Пример прямого использования VRPSolver
    """
    print("=== Пример прямого использования VRPSolver ===")
    
    # Данные курьеров и заказов
    data = {
        "couriers": [
            {
                "_id": "courier_1",
                "fullName": "Смирнов Алексей Викторович",
                "phone": "+77774567890",
                "carType": "B",
                "point": {
                    "lat": 43.16859,
                    "lon": 76.89639
                }
            },
            {
                "_id": "courier_2", 
                "fullName": "Козлов Дмитрий Андреевич",
                "phone": "+77775678901",
                "carType": "A",
                "point": {
                    "lat": 43.17859,
                    "lon": 76.90639
                }
            },
            {
                "_id": "courier_3",
                "fullName": "Морозов Игорь Сергеевич", 
                "phone": "+77776789012",
                "carType": "B",
                "point": {
                    "lat": 43.15859,
                    "lon": 76.88639
                }
            }
        ],
        "orders": [
            {
                "id": "order_1",
                "address": "ул. Абая, 150",
                "lat": 43.2220,
                "lon": 76.8512,
                "priority": 1
            },
            {
                "id": "order_2", 
                "address": "пр. Достык, 200",
                "lat": 43.2156,
                "lon": 76.9286,
                "priority": 2
            },
            {
                "id": "order_3",
                "address": "ул. Толе би, 285",
                "lat": 43.2502,
                "lon": 76.9286,
                "priority": 1
            },
            {
                "id": "order_4",
                "address": "мкр. Самал-2, 111",
                "lat": 43.2280,
                "lon": 76.9553,
                "priority": 3
            },
            {
                "id": "order_5",
                "address": "ул. Жандосова, 140",
                "lat": 43.2867,
                "lon": 76.9745,
                "priority": 2
            }
        ]
    }
    
    # Создаем решатель и решаем задачу
    solver = VRPSolver(data)
    result = solver.solve()
    
    # Выводим результат
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    # Выводим сводную информацию
    if result.get('success'):
        print(f"\n=== СВОДКА ===")
        print(f"Общее расстояние: {result['total_distance_km']} км")
        print(f"Задействовано курьеров: {result['num_couriers_used']}")
        
        for route_id, route in result['routes'].items():
            courier_name = route['courier_info']['fullName']
            orders_count = len(route['orders'])
            distance = route['total_distance_km']
            estimated_time = route['estimated_time_minutes']
            
            print(f"\n{courier_name}:")
            print(f"  - Заказов: {orders_count}")
            print(f"  - Расстояние: {distance} км")
            print(f"  - Время: ~{estimated_time} мин")
            print(f"  - Маршрут:")
            for i, order in enumerate(route['orders'], 1):
                print(f"    {i}. {order['address']} (приоритет: {order['priority']})")


def example_api_usage():
    """
    Пример использования через API (требует запущенный vrp_api.py)
    """
    print("\n=== Пример использования через API ===")
    
    # Данные для отправки
    api_data = {
        "couriers": [
            {
                "_id": "courier_1",
                "fullName": "Смирнов Алексей Викторович",
                "phone": "+77774567890",
                "carType": "B",
                "point": {
                    "lat": 43.16859,
                    "lon": 76.89639
                }
            },
            {
                "_id": "courier_2", 
                "fullName": "Козлов Дмитрий Андреевич",
                "phone": "+77775678901",
                "carType": "A",
                "point": {
                    "lat": 43.17859,
                    "lon": 76.90639
                }
            }
        ],
        "orders": [
            {
                "id": "order_1",
                "address": "ул. Абая, 150",
                "lat": 43.2220,
                "lon": 76.8512,
                "priority": 1
            },
            {
                "id": "order_2", 
                "address": "пр. Достык, 200",
                "lat": 43.2156,
                "lon": 76.9286,
                "priority": 2
            }
        ]
    }
    
    try:
        # Отправляем запрос к API
        response = requests.post(
            'http://localhost:5000/solve_vrp', 
            json=api_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("Результат от API:")
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print(f"Ошибка API: {response.status_code}")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("Не удалось подключиться к API. Убедитесь, что vrp_api.py запущен.")
    except Exception as e:
        print(f"Ошибка при обращении к API: {e}")


def example_with_file():
    """
    Пример загрузки данных из JSON файла
    """
    print("\n=== Пример загрузки данных из файла ===")
    
    # Создаем пример JSON файла
    sample_data = {
        "couriers": [
            {
                "_id": "courier_1",
                "fullName": "Тестовый курьер 1",
                "phone": "+77771234567",
                "carType": "A",
                "point": {
                    "lat": 43.238949,
                    "lon": 76.889709
                }
            }
        ],
        "orders": [
            {
                "id": "order_1",
                "address": "Тестовый адрес 1",
                "lat": 43.245,
                "lon": 76.895,
                "priority": 1
            }
        ]
    }
    
    # Сохраняем в файл
    with open('sample_data.json', 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, ensure_ascii=False, indent=2)
    
    print("Создан файл sample_data.json")
    
    # Загружаем из файла
    with open('sample_data.json', 'r', encoding='utf-8') as f:
        loaded_data = json.load(f)
    
    # Решаем задачу
    solver = VRPSolver(loaded_data)
    result = solver.solve()
    
    print("Результат:")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    # Выполняем примеры
    example_direct_usage()
    example_api_usage()
    example_with_file()
    
    print("\n=== Инструкции по установке ===")
    print("1. Установите зависимости: pip install -r requirements.txt")
    print("2. Для прямого использования: python vrp_solver.py")
    print("3. Для API: python vrp_api.py")
    print("4. Для тестирования: python example.py") 