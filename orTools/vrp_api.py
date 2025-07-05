#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flask API для решения задачи VRP
"""

from flask import Flask, request, jsonify
import json
import logging
from vrp_solver import VRPSolver

app = Flask(__name__)

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.route('/solve_vrp', methods=['POST'])
def solve_vrp():
    """
    Endpoint для решения VRP
    
    Ожидает JSON с полями:
    - couriers: массив курьеров с координатами
    - orders: массив заказов с координатами
    
    Возвращает:
    - routes: оптимальные маршруты для каждого курьера
    """
    try:
        # Получаем данные из запроса
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Нет данных в запросе"}), 400
        
        # Проверяем наличие необходимых полей
        if 'couriers' not in data or 'orders' not in data:
            return jsonify({"error": "Необходимы поля 'couriers' и 'orders'"}), 400
        
        # Логируем входные данные
        logger.info(f"Получен запрос: {len(data['couriers'])} курьеров, {len(data['orders'])} заказов")
        
        # Создаем решатель и решаем задачу
        solver = VRPSolver(data)
        result = solver.solve()
        
        # Логируем результат
        if result.get('success'):
            logger.info(f"Решение найдено: {result['num_couriers_used']} курьеров, {result['total_distance_km']} км")
        else:
            logger.warning(f"Не удалось найти решение: {result.get('error', 'Неизвестная ошибка')}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Ошибка при решении VRP: {str(e)}")
        return jsonify({"error": f"Внутренняя ошибка сервера: {str(e)}"}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """
    Проверка работоспособности API
    """
    return jsonify({"status": "OK", "service": "VRP Solver API"})


@app.route('/test', methods=['GET'])
def test_endpoint():
    """
    Тестовый endpoint с примером данных
    """
    test_data = {
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
            },
            {
                "id": "order_3",
                "address": "ул. Толе би, 285",
                "lat": 43.2502,
                "lon": 76.9286,
                "priority": 1
            }
        ]
    }
    
    solver = VRPSolver(test_data)
    result = solver.solve()
    
    return jsonify({
        "test_data": test_data,
        "result": result
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 