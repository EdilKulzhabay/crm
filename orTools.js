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

const zeroing = async () => {
    const todayString = getDateAlmaty();

    const orders = await Order.find({
        "date.d": todayString,
        $or: [
            { "address.point": { $exists: false } },
            { "address.point.lat": { $eq: null } },
            { "address.point.lon": { $eq: null } }
        ]
    })

    for (const order of orders) {
        const client = await Client.findById(order.client)
        const clientAddresses = client.addresses;

        // Функция для получения ID 2GIS по адресу
        const fetchAddressId = async (item) => {
            try {
                const response = await axios.get('https://catalog.api.2gis.com/3.0/items/geocode', {
                    params: {
                        fields: "items.point",
                        key: "f5af220d-c60a-4cf6-a350-4a953c324a3d",
                        q: `Алматы, ${item.street}`,
                    },
                });
                console.log("response.data.result", response.data.result);
                
                return response.data.result.items[0] || null; // Возвращаем ID или null
            } catch (error) {
                console.log(`Невозможно найти адрес: ${item.street}`);
                return null;
            }
        };

        // Получаем IDs для всех адресов
        const res2Gis = await Promise.allSettled(clientAddresses.map(fetchAddressId));
        res2Gis.forEach((result, index) => {
            console.log("result: ", result);
            
            if (result.status === "fulfilled") {
                clientAddresses[index].id2Gis = result?.value?.id
                clientAddresses[index].point = result?.value?.point
            } else {
                clientAddresses[index].id2Gis = null
                clientAddresses[index].point = {lat: null, lon: null}
            }
        });

        await Client.findByIdAndUpdate(client._id, { $set: { addresses: clientAddresses } })

        const orderAddress = clientAddresses.find(address => order.address.actual.includes(address.street))
        if (orderAddress) {
            await Order.findByIdAndUpdate(order._id, { $set: { address: orderAddress } })
        }
    }

    await Order.updateMany(
        { 
            "date.d": todayString,
            franchisee: { 
                $in: [
                    new mongoose.Types.ObjectId('66f15c557a27c92d447a16a0'), 
                    new mongoose.Types.ObjectId('66fc0cc6953c2dbbc86c2132'), 
                    new mongoose.Types.ObjectId('66fc0d01953c2dbbc86c2135'), 
                    new mongoose.Types.ObjectId('66fc0d3e953c2dbbc86c2138'),
                    new mongoose.Types.ObjectId('67010493e6648af4cb0213b7')
                ]
            },
            status: { $nin: ["onTheWay", "delivered", "cancelled"] }
        },
        { $set: { forAggregator: true } }
    )

    const resetResult = await Order.updateMany(
        { 
            "date.d": todayString,
            forAggregator: true,
            status: { $nin: ["onTheWay", "delivered", "cancelled"] } // Исключаем начатые, доставленные и отмененные
        },
        { 
            $unset: { courierAggregator: "" }
        }
    );
    
    console.log(`📊 Сброшено назначений: ${resetResult.modifiedCount} заказов`);

    const couriersToUpdate = await CourierAggregator.find({ 
        onTheLine: true, 
        status: "active" 
    });
    
    for (const courier of couriersToUpdate) {
        // Оставляем только заказы, которые уже начаты (в статусе "onTheWay")
        const activeOrders = courier.orders.filter(order => {
            // Проверяем, что заказ в статусе "onTheWay" (уже начат курьером)
            return order.status && order.status === "onTheWay";
        });
        
        await CourierAggregator.updateOne(
            { _id: courier._id },
            { $set: { orders: activeOrders } }
        );
    }
    
    console.log("✅ Старые назначения сброшены (начатые заказы сохранены)\n");
}


const sendOrderPushNotification = async () => {
    const couriers = await CourierAggregator.find({status: "active", onTheLine: true})
    let needOrTools = false
    for (const courier of couriers) {

        if (courier.orders.length === 0 || courier.orders.length === undefined || courier.orders.length === null) {
            continue;
        }

        if (courier.order) {
            continue;
        }

        const orders = courier.orders
        for (const order of orders) {
            let messageBody = "Заказ на ";
            if (order.products.b12 > 0) {
                messageBody += `${order.products.b12} бутылок 12.5л `
            }
            if (order.products.b19 > 0) {
                messageBody += `${order.products.b19} бутылок 19.8л`
            }
            
            await pushNotification(
                "newOrder",
                messageBody,
                [courier.notificationPushToken],
                "newOrder",
                order
            );

            // Ждем 20 секунд для решения курьера
            await new Promise(resolve => setTimeout(resolve, 20000));
            console.log(`⏳ Ожидание решения курьера по заказу ${order.orderId} завершено`);

            const checkOrder = await Order.findById(order.orderId)
            if (checkOrder.status !== "onTheWay") {
                needOrTools = true
                await CourierRestrictions.create({
                    orderId: order.orderId,
                    courierId: courier._id
                })
                await Order.findByIdAndUpdate(order.orderId, { $set: { courierAggregator: null } })
                await CourierAggregator.updateOne(
                    { _id: courier._id },
                    { $pull: { orders: { orderId: order.orderId } } }
                );
            } else {
                break;
            }
        }
    }

    if (needOrTools) {
        await orTools();
    }
}


export default async function orTools() {

    // Пример вызова:
    console.log("orTools");
    
    return 

    const couriers = [
        {
            id: 'courier_1',
            lat: 43.28, lon: 76.925,
            capacity_12: 0,
            capacity_19: 30,
            capacity: 40
        },
        {
            id: 'courier_2',
            lat: 43.20, lon: 76.900,
            capacity_12: 0,
            capacity_19: 15,
            capacity: 40
        }
    ]

    const orders = [
        { id: 'order_1', lat: 43.292268, lon: 76.931119, bottles_12: 0, bottles_19: 23 },
        { id: 'order_2', lat: 43.261362, lon: 76.929122, bottles_12: 0, bottles_19: 4 },
        { id: 'order_17', lat: 43.264191, lon: 76.932518, bottles_12: 0, bottles_19: 10 },
        { id: 'order_3', lat: 43.28, lon: 76.895, bottles_12: 0, bottles_19: 4 },
        { id: 'order_4', lat: 43.29, lon: 76.895, bottles_12: 0, bottles_19: 10 }
    ]
    
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

    // Реверсируем порядок заказов в каждом маршруте
    // for (const route of result) {
    //     route.orders.reverse();
    // }

    await runPythonVisualize(couriers, orders, result);


    for (const route of result) {
        console.log(`✅ Курьер ${route.courier_id} получил ${route.orders.length} заказов`);
        console.log(`   Требуется бутылок: 12л=${route.required_bottles.bottles_12}, 19л=${route.required_bottles.bottles_19}, всего=${route.required_bottles.total}`);
        
        // Проверяем, какой тип курьера
        if (route.courier_bottles) {
            // Курьер с конкретными типами бутылок
            console.log(`   У курьера есть: 12л=${route.courier_bottles.bottles_12}, 19л=${route.courier_bottles.bottles_19}, всего=${route.courier_bottles.total}`);
            
            if (route.max_capacity) {
                console.log(`   Максимальная вместимость: 12л=${route.max_capacity.bottles_12}, 19л=${route.max_capacity.bottles_19}, всего=${route.max_capacity.total}`);
            }
            
            if (route.bottles_sufficient) {
                if (route.refill_needed) {
                    console.log(`   🔄 Нужно доукомплектовать: 12л=${route.refill_needed.bottles_12}, 19л=${route.refill_needed.bottles_19}, всего=${route.refill_needed.total}`);
                    
                    if (route.refill_point) {
                        if (route.refill_point.after_order_id) {
                            console.log(`   📍 Точка доукомплектования: после заказа ${route.refill_point.after_order_id}, перед заказом ${route.refill_point.before_order_id}`);
                        } else {
                            console.log(`   📍 Точка доукомплектования: в начале маршрута, перед заказом ${route.refill_point.before_order_id}`);
                        }
                    }
                } else {
                    console.log(`   ✅ Бутылок достаточно`);
                }
            } else {
                console.log(`   ❌ Недостаточно даже с доукомплектованием!`);
                if (route.bottles_shortage) {
                    if (route.bottles_shortage.bottles_12 > 0) {
                        console.log(`      Не хватает 12л: ${route.bottles_shortage.bottles_12}`);
                    }
                    if (route.bottles_shortage.bottles_19 > 0) {
                        console.log(`      Не хватает 19л: ${route.bottles_shortage.bottles_19}`);
                    }
                }
            }
        } else if (route.courier_should_take) {
            // Курьер с общей вместимостью
            console.log(`   Курьер должен взять: 12л=${route.courier_should_take.bottles_12}, 19л=${route.courier_should_take.bottles_19}, всего=${route.courier_should_take.total}`);
            console.log(`   Общая вместимость: ${route.courier_total_capacity} бутылок`);
        }
        
        console.log(`   Использование вместимости: ${route.capacity_utilization.percent}%`);
    }



    return

    
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
