import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем __dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Вызывает Python скрипт VRP solver с переданными данными
 * @param {Array} couriers - Массив курьеров с координатами
 * @param {Array} orders - Массив заказов с координатами
 * @param {Object} courierRestrictions - Ограничения на курьеров для заказов
 * @param {Object} commonDepot - Общий депо для возврата
 * @returns {Promise} Результат решения VRP
 */
export async function solveVRP(couriers, orders, courierRestrictions = {}, commonDepot = null) {
    return new Promise((resolve, reject) => {
        // Подготавливаем данные для передачи в Python
        const inputData = {
            couriers,
            orders,
            courier_restrictions: courierRestrictions,
            common_depot: commonDepot || {"id": "depot", "lat": 43.16857, "lon": 76.89642}
        };

        // Записываем данные во временный файл
        const inputFile = path.join(__dirname, 'temp_vrp_input.json');
        fs.writeFileSync(inputFile, JSON.stringify(inputData, null, 2));

        // Запускаем Python скрипт (используем python3 для macOS)
        const pythonProcess = spawn('python3', ['vrp_solver_api.py', inputFile], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            // Удаляем временный файл
            try {
                fs.unlinkSync(inputFile);
            } catch (err) {
                console.warn('Не удалось удалить временный файл:', err.message);
            }

            if (code === 0) {
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (parseError) {
                    reject(new Error(`Ошибка парсинга результата: ${parseError.message}\nВывод: ${stdout}`));
                }
            } else {
                reject(new Error(`Python скрипт завершился с кодом ${code}. Ошибка: ${stderr}`));
            }
        });

        pythonProcess.on('error', (error) => {
            reject(new Error(`Ошибка запуска Python скрипта: ${error.message}`));
        });
    });
}

/**
 * Создает визуализацию маршрутов
 * @param {Array} couriers - Массив курьеров с координатами
 * @param {Array} orders - Массив заказов с координатами
 * @param {Array} routes - Результаты маршрутизации
 * @param {Object} commonDepot - Общий депо для возврата
 * @returns {Promise} Путь к созданному файлу изображения
 */
export async function visualizeRoutes(couriers, orders, routes, commonDepot = null) {
    return new Promise((resolve, reject) => {
        // Подготавливаем данные для передачи в Python
        const inputData = {
            couriers,
            orders,
            routes,
            common_depot: commonDepot || {"id": "depot", "lat": 43.16857, "lon": 76.89642}
        };

        // Записываем данные во временный файл
        const inputFile = path.join(__dirname, 'temp_viz_input.json');
        fs.writeFileSync(inputFile, JSON.stringify(inputData, null, 2));

        // Запускаем Python скрипт визуализации (используем python3 для macOS)
        const pythonProcess = spawn('python3', ['visualize_routes_api.py', inputFile], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            // Удаляем временный файл
            try {
                fs.unlinkSync(inputFile);
            } catch (err) {
                console.warn('Не удалось удалить временный файл:', err.message);
            }

            if (code === 0) {
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (parseError) {
                    // Если JSON парсинг не удался, возвращаем текстовый вывод
                    resolve({ 
                        success: true, 
                        message: stdout.trim(),
                        image_path: path.join(__dirname, 'vrp_routes_visualization.png')
                    });
                }
            } else {
                reject(new Error(`Python скрипт визуализации завершился с кодом ${code}. Ошибка: ${stderr}`));
            }
        });

        pythonProcess.on('error', (error) => {
            reject(new Error(`Ошибка запуска Python скрипта визуализации: ${error.message}`));
        });
    });
}

/**
 * Полный цикл: решение VRP + визуализация
 * @param {Array} couriers - Массив курьеров с координатами
 * @param {Array} orders - Массив заказов с координатами
 * @param {Object} courierRestrictions - Ограничения на курьеров для заказов
 * @param {Object} commonDepot - Общий депо для возврата
 * @returns {Promise} Результат решения и путь к визуализации
 */
export async function solveAndVisualize(couriers, orders, courierRestrictions = {}, commonDepot = null) {
    try {
        console.log('Решение VRP...');
        const vrpResult = await solveVRP(couriers, orders, courierRestrictions, commonDepot);
        
        console.log('Создание визуализации...');
        const vizResult = await visualizeRoutes(couriers, orders, vrpResult.routes, commonDepot);
        
        return {
            vrp_result: vrpResult,
            visualization: vizResult
        };
    } catch (error) {
        throw new Error(`Ошибка в solveAndVisualize: ${error.message}`);
    }
}

// Пример использования, если файл запущен напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    // Тестовые данные
    const testCouriers = [
        {"id": "courier1", "lat": 43.207262, "lon": 76.893349},
        {"id": "courier2", "lat": 43.22000, "lon": 76.85000},
        {"id": "courier3", "lat": 43.28000, "lon": 76.95000}
    ];

    const testOrders = [
        {"id": "order1", "lat": 43.212409, "lon": 76.842149},
        {"id": "order2", "lat": 43.249392, "lon": 76.887507},
        {"id": "order3", "lat": 43.245447, "lon": 76.903766},
        {"id": "order4", "lat": 43.230026, "lon": 76.94556},
        {"id": "order5", "lat": 43.228736, "lon": 76.839826}
    ];

    const testRestrictions = {
        "order1": [1, 2],  // только courier2 и courier3
        "order2": [1, 2]   // только courier2 и courier3
    };

    // Запуск теста
    solveAndVisualize(testCouriers, testOrders, testRestrictions)
        .then(result => {
            console.log('Успешно завершено!');
            console.log('VRP результат:', JSON.stringify(result.vrp_result, null, 2));
            console.log('Визуализация:', result.visualization);
        })
        .catch(error => {
            console.error('Ошибка:', error.message);
        });
} 