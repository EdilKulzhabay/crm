import Courier from "./Models/CourierAggregator.js"
import Order from "./Models/Order.js"
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
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
        const python = spawn(pythonPath, ["./orTools/vrp_solver2.py"]);

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
            if (code === 0) {
                try {
                    const parsed = JSON.parse(output);
                    resolve(parsed);
                } catch (e) {
                    reject("Ошибка парсинга вывода Python: " + e.message + "\nСырые данные:\n" + output);
                }
                // resolve(output);
            } else {
                reject(`Python script exited with code ${code}\n${error}`);
            }
        });

        python.stdin.write(JSON.stringify(input));
        python.stdin.end();
    });
}

export function runPythonVisualize(couriers, orders, routes) {
    return new Promise((resolve, reject) => {
        // Используем Python из виртуального окружения
        const python = spawn(pythonPath, ["./orTools/visualize_routes2.py"]);

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
        {"id": "courier1", "lat": 43.207262, "lon": 76.893349},
        {"id": "courier2", "lat": 43.22000, "lon": 76.85000},  
        {"id": "courier3", "lat": 43.28000, "lon": 76.95000},
    ];
  
    const orders = [
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
    
    const courier_restrictions = {
        "order1": [1, 2],
        "order2": [1, 2],
        "order7": [2],
    }
    
    const result = await runPythonVRP(couriers, orders, courier_restrictions);
    console.log("Готовые маршруты:", result);

    const visualizeResult = await runPythonVisualize(couriers, orders, result);

    // Можно использовать дальше:
    for (const route of result) {
        console.log(`Курьер: ${route.courier_id}, заказов: ${route.orders_count}, путь: ${route.distance_km} км`);
    }
}

orTools();



// export default async function orTools(cancelled = false, orderId = null, courierId = null) {

//     const resetResult = await Order.updateMany(
//         { 
//             "date.d": today,
//             forAggregator: true,
//             status: { $nin: ["onTheWay", "delivered", "cancelled"] } // Исключаем начатые, доставленные и отмененные
//         },
//         { 
//             $unset: { courierAggregator: "" }
//         }
//     );
    
//     console.log(`📊 Сброшено назначений: ${resetResult.modifiedCount} заказов`);

//     const couriersToUpdate = await CourierAggregator.find({ 
//         onTheLine: true, 
//         status: "active" 
//     });
    
//     for (const courier of couriersToUpdate) {
//         // Оставляем только заказы, которые уже начаты (в статусе "onTheWay")
//         const activeOrders = courier.orders.filter(order => {
//             // Проверяем, что заказ в статусе "onTheWay" (уже начат курьером)
//             return order.status && order.status === "onTheWay";
//         });
        
//         await CourierAggregator.updateOne(
//             { _id: courier._id },
//             { $set: { orders: activeOrders } }
//         );
//     }
    
//     console.log("✅ Старые назначения сброшены (начатые заказы сохранены)\n");


//     const activeCouriers = await Courier.find({status: "active", onTheLine: true})

//     // Пример вызова:
//     const couriers = activeCouriers.map(courier => ({
//         id: courier._id,
//         lat: courier.point.lat,
//         lon: courier.point.lon
//     }));

//     const today = new Date();
//     const year = today.getFullYear();
//     const month = today.getMonth();
//     const day = today.getDate();
//     const todayString = `${year}-${month}-${day}`;

//     const activeOrders = await Order.find({"date.d": todayString, forAggregator: true, status: { $nin: ["onTheWay", "delivered", "cancelled"] }})
  
//     const orders = activeOrders.map(order => ({
//         id: order._id,
//         lat: order.address.point.lat,
//         lon: order.address.point.lon
//     }));

//     if (cancelled) {
//         const courier_restrictions = {
//             [orderId]: [courierId]
//         }
//         runPythonVRP(couriers, orders, courier_restrictions)
//             .then((result) => console.log("Результат Python скрипта:\n", result))
//             .catch((err) => console.error("Ошибка:", err));
//     } else {
//         runPythonVRP(couriers, orders, {})
//             .then((result) => console.log("Результат Python скрипта:\n", result))
//             .catch((err) => console.error("Ошибка:", err));
//     }
// }