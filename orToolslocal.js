import CourierAggregator from "./Models/CourierAggregator.js"
import Order from "./Models/Order.js"
import Client from "./Models/Client.js"
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import CourierRestrictions from "./Models/CourierRestrictions.js";
import AquaMarket from "./Models/AquaMarket.js";
import { pushNotification } from "./pushNotification.js";
import { getDateAlmaty } from "./utils/dateUtils.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Вычисляем __dirname в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к интерпретатору внутри venv
const pythonPath = process.platform === "win32"
  ? path.join(__dirname, "venv", "Scripts", "python.exe")
  : path.join(__dirname, "venv", "bin", "python");

export function runPythonVRP(couriers, orders, courier_restrictions) {
    return new Promise((resolve, reject) => {
        // Используем Python из виртуального окружения
        const python = spawn(pythonPath, ["./orTools/vrp_solver_optimized.py"]);
        // const python = spawn(pythonPath, ["./orTools/vrp_solver2.py"]);

        const input = {
            common_depot: {
                id: "depot",
                lat: 43.16857,
                lon: 76.89642,
            },
            couriers,
            orders,
            courier_restrictions,
        };

        let output = "";
        let error = "";

        python.stdout.on("data", (data) => {
            output += data.toString();
        });

        python.stderr.on("data", (data) => {
            error += data.toString();
        });

        python.on("close", (code) => {
            // Выводим stderr для отладки
            if (error.trim()) {
                console.log("Python stderr:", error);
            }
            
            if (code === 0) {
                try {
                    const parsed = JSON.parse(output);
                    resolve(parsed);
                } catch (e) {
                    reject("Ошибка парсинга вывода Python: " + e.message + "\nСырые данные:\n" + output);
                }
                // resolve(output);
            } else {
                reject(`Python script exited with code ${code}\nSTDERR:\n${error}\nSTDOUT:\n${output}`);
            }
        });

        python.stdin.write(JSON.stringify(input));
        python.stdin.end();
    });
}

export function runPythonVisualize(couriers, orders, routes) {
    return new Promise((resolve, reject) => {
        // Используем Python из виртуального окружения
        // const python = spawn(pythonPath, ["./orTools/visualize_routes2.py"]);
        const python = spawn(pythonPath, ["./orTools/visualize_routes_optimized.py"]);

        const input = {
            common_depot: {
                id: "depot",
                lat: 43.16857,
                lon: 76.89642,
            },
            couriers,
            orders,
            routes,
        };

        let output = "";
        let error = "";

        python.stdout.on("data", (data) => {
            output += data.toString();
        });

        python.stderr.on("data", (data) => {
            error += data.toString();
        });

        python.on("close", (code) => {
            if (code === 0) {
                let result;
                try {
                    result = JSON.parse(output);
                } catch (e) {
                    // Возвращаем как обычный текст, если это не JSON
                    result = {
                        success: true,
                        message: output.trim()
                    };
                }
                resolve(result);
            } else {
                reject(`Python script exited with code ${code}\n${error}`);
            }
        });

        python.stdin.write(JSON.stringify(input));
        python.stdin.end();
    });
}



export default async function orTools() {

    // Пример вызова:
    const couriers = [
        {
            id: 'courier_1',
            lat: 43.282268, lon: 76.921119,
            capacity_12: 0, // Загруженный курьер
            capacity_19: 30, // Загруженный курьер
            capacity: 40,
            order: null,
            completeFirstOrder: true
        },
        {
            id: 'courier_2', 
            lat: 43.24,
            lon: 76.91,
            capacity_12: 10, // Загруженный курьер
            capacity_19: 0, // Загруженный курьер
            capacity: 40,
            order: {
                orderId: "order_14",
                status: "onTheWay",
                lat: 43.234567, lon: 76.912345
            },
            completeFirstOrder: false
        },
        {
            id: 'courier_3',
            lat: 43.168277314921774,
            lon: 76.89654142009347,
            capacity_12: 0, // Пустой курьер
            capacity_19: 0, // Пустой курьер
            capacity: 50,
            order: null,
            completeFirstOrder: false
        },
        {
            id: 'courier_4',
            lat: 43.16,
            lon: 76.87,
            capacity_12: 6, // Пустой курьер
            capacity_19: 10, // Пустой курьер
            capacity: 16,
            order: {
                orderId: "order_11",
                status: "onTheWay",
                lat: 43.194514, lon: 76.896529
            },
            completeFirstOrder: false
        },
        // Добавляем пустых курьеров для демонстрации
        {
            id: 'courier_5',
            lat: 43.168277314921774,
            lon: 76.89654142009347,
            capacity_12: 0, // Пустой курьер
            capacity_19: 0, // Пустой курьер
            capacity: 50,
            order: null,
            completeFirstOrder: false
        },
        {
            id: 'courier_6',
            lat: 43.168277314921774,
            lon: 76.89654142009347,
            capacity_12: 0, // Пустой курьер
            capacity_19: 0, // Пустой курьер
            capacity: 40,
            order: null,
            completeFirstOrder: false
        }
    ]
  
    // Фильтруем только заказы со статусом "awaitingOrder" для нового распределения
    const allOrders = [
        { id: 'order_1', lat: 43.292268, lon: 76.931119, bottles_12: 5, bottles_19: 0, status: "delivered" },
        { id: 'order_2', lat: 43.261362, lon: 76.929122, bottles_12: 3, bottles_19: 0, status: "awaitingOrder" },
        { id: 'order_3', lat: 43.151319, lon: 76.901267, bottles_12: 0, bottles_19: 3, status: "awaitingOrder" },
        { id: 'order_4', lat: 43.228644, lon: 76.866358, bottles_12: 2, bottles_19: 3, status: "awaitingOrder" },
        { id: 'order_5', lat: 43.187654, lon: 76.898765, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
        { id: 'order_6', lat: 43.254082, lon: 76.918261, bottles_12: 0, bottles_19: 5, status: "awaitingOrder" },
        { id: 'order_7', lat: 43.198765, lon: 76.923456, bottles_12: 0, bottles_19: 4, status: "awaitingOrder" },
        { id: 'order_8', lat: 43.237369, lon: 76.938627, bottles_12: 0, bottles_19: 6, status: "awaitingOrder" },
        { id: 'order_9', lat: 43.252214, lon: 76.90054, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
        { id: 'order_10', lat: 43.187654, lon: 76.912345, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
        { id: 'order_11', lat: 43.194514, lon: 76.896529, bottles_12: 4, bottles_19: 0, status: "onTheWay" },
        { id: 'order_12', lat: 43.168765, lon: 76.873977, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
        { id: 'order_13', lat: 43.175432, lon: 76.923456, bottles_12: 0, bottles_19: 4, status: "awaitingOrder" },
        { id: 'order_14', lat: 43.234567, lon: 76.912345, bottles_12: 4, bottles_19: 0, status: "onTheWay" },
        { id: 'order_15', lat: 43.212045, lon: 76.872848, bottles_12: 0, bottles_19: 15, status: "awaitingOrder" },
        { id: 'order_16', lat: 43.223456, lon: 76.934567, bottles_12: 0, bottles_19: 10, status: "awaitingOrder" },
        { id: 'order_17', lat: 43.264191, lon: 76.932518, bottles_12: 0, bottles_19: 20, status: "onTheWay" },
        { id: 'order_18', lat: 43.245678, lon: 76.887654, bottles_12: 0, bottles_19: 3, status: "awaitingOrder" },
        { id: 'order_19', lat: 43.212345, lon: 76.945678, bottles_12: 0, bottles_19: 4, status: "awaitingOrder" },
        { id: 'order_20', lat: 43.242453, lon: 76.9409, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
        { id: 'order_21', lat: 43.234567, lon: 76.923456, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
        { id: 'order_22', lat: 43.198765, lon: 76.934567, bottles_12: 10, bottles_19: 0, status: "awaitingOrder" }
    ]
    
    // Разделяем заказы на активные и новые
    const activeOrders = allOrders.filter(order => order.status === "onTheWay");
    const newOrders = allOrders.filter(order => order.status === "awaitingOrder");
    
    console.log(`📊 Активные заказы (уже назначены): ${activeOrders.length}`);
    console.log(`📊 Новые заказы для распределения: ${newOrders.length}`);
    
    // Передаем в Python только новые заказы для распределения
    // Активные заказы курьеров будут учтены через поле order в структуре курьера
    const orders = newOrders;
    
    const courier_restrictions = {}

    console.log("Начало распределения в orTools.js");
    
    console.log("количество курьеров = ", couriers.length)
    console.log("количество заказов = ", orders.length)
    console.log("ограничения на заказы = ", courier_restrictions)
    
    // Проверяем, есть ли данные для обработки
    if (couriers.length === 0) {
        console.log("❌ Нет курьеров с корректными координатами");
        return;
    }
    
    if (orders.length === 0) {
        console.log("❌ Нет заказов для распределения");
        return;
    }
    
    const result = await runPythonVRP(couriers, orders, courier_restrictions);
    console.log("Готовые маршруты:", result);

    // Проверяем, найдено ли решение
    if (!result || result.length === 0) {
        console.log("❌ Python скрипт не смог найти решение для текущих условий");
        console.log("📊 Анализ проблемы:");
        console.log(`   - Курьеров: ${couriers.length}`);
        console.log(`   - Заказов: ${orders.length}`);
        console.log(`   - Ограничений: ${Object.keys(courier_restrictions).length}`);
        
        // Подсчитываем общую вместимость курьеров
        const totalCapacity = couriers.reduce((sum, courier) => sum + courier.capacity, 0);
        const totalOrders = orders.reduce((sum, order) => sum + order.bottles_12 + order.bottles_19, 0);
        
        console.log(`   - Общая вместимость курьеров: ${totalCapacity} бутылок`);
        console.log(`   - Общее количество бутылок в заказах: ${totalOrders} бутылок`);
        
        if (totalCapacity < totalOrders) {
            console.log("   ⚠️  ПРОБЛЕМА: Недостаточно вместимости курьеров для всех заказов!");
        }
        
        console.log("   📋 Детали по курьерам:");
        couriers.forEach(courier => {
            console.log(`     - ${courier.id}: вместимость=${courier.capacity}, 12л=${courier.capacity_12}, 19л=${courier.capacity_19}, активный заказ=${courier.order ? courier.order.orderId : 'нет'}`);
        });
        
        console.log("   📋 Детали по ограничениям:");
        Object.entries(courier_restrictions).forEach(([orderId, restrictions]) => {
            console.log(`     - Заказ ${orderId}: запрещен для курьеров ${restrictions.join(', ')}`);
        });
        
        console.log("⚠️  Пропускаем отправку уведомлений из-за отсутствия маршрутов");
        return;
    }

    for (const route of result) {
        const courier = couriers.find(c => c.id === route.courier_id)
        
        // Проверяем, есть ли у курьера активный заказ
        if (!courier.completeFirstOrder && courier.order === null) {
            route.orders.reverse()
        }
    }

    try {
        const visualizeResult = await runPythonVisualize(couriers, orders, result);
        console.log("Результат визуализации:", visualizeResult);
    } catch (error) {
        console.error("Ошибка визуализации:", error);
        console.log("Пропускаем отправку уведомлений из-за ошибки визуализации");
        return;
    }


    for (const route of result) {
        const courier = couriers.find(c => c.id === route.courier_id)
        const hasActiveOrder = courier.order && courier.order.status === "onTheWay"
        const isEmptyCourier = courier.capacity_12 === 0 && courier.capacity_19 === 0
        
        console.log(`✅ Курьер ${route.courier_id} получил ${route.orders.length} заказов`);
        console.log(`   Тип курьера: ${route.courier_type || (isEmptyCourier ? 'ПУСТОЙ' : 'ЗАГРУЖЕННЫЙ')}`);
        console.log(`   Требуется бутылок: 12л=${route.required_bottles.bottles_12}, 19л=${route.required_bottles.bottles_19}, всего=${route.required_bottles.total}`);
        console.log(`   Курьер должен взять: 12л=${route.courier_should_take.bottles_12}, 19л=${route.courier_should_take.bottles_19}, всего=${route.courier_should_take.total}`);
        console.log(`   Использование вместимости: ${route.capacity_utilization.percent}%`);
        console.log(`   Активный заказ: ${hasActiveOrder ? courier.order.orderId : 'нет'}`);
        console.log(`   Завершил первый заказ: ${courier.completeFirstOrder ? 'да' : 'нет'}`);
        
        if (hasActiveOrder) {
            const activeOrderIndex = route.orders.indexOf(courier.order.orderId)
            if (activeOrderIndex === 0) {
                console.log(`   ✅ Активный заказ идет первым в маршруте`);
            } else if (activeOrderIndex > 0) {
                console.log(`   ⚠️  Активный заказ идет ${activeOrderIndex + 1}-м в маршруте (должен быть первым)`);
            } else {
                console.log(`   ❌ Активный заказ не найден в маршруте`);
            }
        }
    }
    console.log("✅ Push уведомления отправлены");
}

orTools();

async function ensureMongoConnection() {
    if (mongoose.connection.readyState === 0) {
        const uri = "mongodb://localhost:27017/crm";
        await mongoose.connect(uri, {
            dbName: "crm",
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("✅ MongoDB connected (orTools.js)");
    }
}
