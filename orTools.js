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

const zeroing = async () => {
    const todayString = getDateAlmaty();

    // const orders = await Order.find({
    //     "date.d": todayString,
    //     status: "delivered",
    //     forAggregator: true,
    //     $or: [
    //         { "address.point": { $exists: false } },
    //         { "address.point.lat": { $eq: null } },
    //         { "address.point.lon": { $eq: null } }
    //     ]
    // })

    // for (const order of orders) {
    //     const client = await Client.findById(order.client)
    //     const clientAddresses = client.addresses;

    //     // Функция для получения ID 2GIS по адресу
    //     const fetchAddressId = async (item) => {
    //         try {
    //             const response = await axios.get('https://catalog.api.2gis.com/3.0/items/geocode', {
    //                 params: {
    //                     fields: "items.point",
    //                     key: "f5af220d-c60a-4cf6-a350-4a953c324a3d",
    //                     q: `Алматы, ${item.street}`,
    //                 },
    //             });
    //             console.log("response.data.result", response.data.result);
                
    //             return response.data.result.items[0] || null; // Возвращаем ID или null
    //         } catch (error) {
    //             console.log(`Невозможно найти адрес: ${item.street}`);
    //             return null;
    //         }
    //     };

    //     // Получаем IDs для всех адресов
    //     const res2Gis = await Promise.allSettled(clientAddresses.map(fetchAddressId));
    //     res2Gis.forEach((result, index) => {
    //         console.log("result: ", result);
            
    //         if (result.status === "fulfilled") {
    //             clientAddresses[index].id2Gis = result?.value?.id
    //             clientAddresses[index].point = result?.value?.point
    //         } else {
    //             clientAddresses[index].id2Gis = null
    //             clientAddresses[index].point = {lat: null, lon: null}
    //         }
    //     });

    //     await Client.findByIdAndUpdate(client._id, { $set: { addresses: clientAddresses } })

    //     const orderAddress = clientAddresses.find(address => order.address.actual.includes(address.street))
    //     if (orderAddress) {
    //         await Order.findByIdAndUpdate(order._id, { $set: { address: orderAddress } })
    //     }
    // }

    // await Order.updateMany(
    //     { 
    //         "date.d": todayString,
    //         franchisee: { 
    //             $in: [
    //                 new mongoose.Types.ObjectId('66f15c557a27c92d447a16a0'), 
    //                 new mongoose.Types.ObjectId('66fc0cc6953c2dbbc86c2132'), 
    //                 new mongoose.Types.ObjectId('66fc0d01953c2dbbc86c2135'), 
    //                 new mongoose.Types.ObjectId('66fc0d3e953c2dbbc86c2138'),
    //                 new mongoose.Types.ObjectId('67010493e6648af4cb0213b7')
    //             ]
    //         },
    //         status: { $nin: ["onTheWay", "delivered", "cancelled"] }
    //     },
    //     { $set: { forAggregator: true } }
    // )

    const resetResult = await Order.updateMany(
        { 
            "date.d": todayString,
            forAggregator: true,
            status: "awaitingOrder"
        },
        { 
            $set: { courierAggregator: null }
        }
    );
    
    console.log(`📊 Сброшено назначений: ${resetResult.modifiedCount} заказов`);

    const couriersToUpdate = await CourierAggregator.find({ 
        onTheLine: true, 
        status: "active" 
    });
    
    for (const courier of couriersToUpdate) {

        const activeOrder = courier.order && courier.order.orderId ? courier.order : null

        const completeFirstOrder = courier.capacity12 > 0 || courier.capacity19 > 0 ? true : false
        
        await CourierAggregator.updateOne(
            { _id: courier._id },
            { $set: { orders: activeOrder ? [activeOrder] : [], completeFirstOrder} }
        );
    }
    
    console.log("✅ Старые назначения сброшены (начатые заказы сохранены)\n");
}


const sendOrderPushNotification = async () => {
    const couriers = await CourierAggregator.find({status: "active", onTheLine: true})
    let needOrTools = false
    for (const courier of couriers) {

        // if (courier.orders.length === 0 || courier.orders.length === undefined || courier.orders.length === null) {
        //     continue;
        // }

        if (courier.order && courier.order.orderId) {
            continue;
        }

        const orders = courier.orders
        const order = orders[0]
        
        // Проверяем, что заказ существует
        if (!order || !order.products) {
            console.log(`⚠️  Курьер ${courier.fullName} не имеет назначенных заказов или заказ некорректен`);
            continue;
        }
        
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
                { $set: { order: null, orders: [] } },
            );
        }

    }

    if (needOrTools) {
        // Вызываем orTools напрямую, чтобы избежать циклической зависимости
        // Это внутренний вызов, который должен выполниться сразу
        console.log("🔄 Перезапуск orTools после отклонения заказов курьерами");
        await orTools();
    }
}


export default async function orTools() {
    await ensureMongoConnection();

    await zeroing();

    const activeCouriers = await CourierAggregator.find({status: "active", onTheLine: true})
    
    console.log(`📊 Найдено активных курьеров: ${activeCouriers.length}`);

    const couriers = activeCouriers
        .filter(courier => {
            const hasValidCoords = courier.point && courier.point.lat && courier.point.lon;
            if (!hasValidCoords) {
                console.log(`❌ Курьер ${courier.fullName} исключен - нет координат`);
            }
            return hasValidCoords;
        })
        .map(courier => {
            // Исправляем обработку активных заказов - координаты в clientPoints
            const courierOrder = courier.order && courier.order.orderId && courier.order.clientPoints ? {
                orderId: courier.order.orderId,
                status: courier.order.status,
                lat: courier.order.clientPoints.lat,
                lon: courier.order.clientPoints.lon,
                bottles_12: courier.order.products ? courier.order.products.b12 : 0,
                bottles_19: courier.order.products ? courier.order.products.b19 : 0
            } : null
            
            if (courier.order && courier.order.orderId && !courier.order.clientPoints) {
                console.log(`⚠️  Курьер ${courier.fullName} имеет активный заказ ${courier.order.orderId} без координат clientPoints`);
            }
            
            // ИСПРАВЛЕННАЯ ЛОГИКА: Определяем правильный тип курьера
            // Курьер пустой только если у него 0 и 12л, и 19л бутылок
            // Курьер загруженный если у него есть бутылки хотя бы одного типа
            const hasActiveOrder = courierOrder !== null;
            const capacity12 = courier.capacity12 || 0;
            const capacity19 = courier.capacity19 || 0;
            const isEmpty = capacity12 === 0 && capacity19 === 0;
            
            console.log(`📋 Курьер ${courier.fullName}:`);
            console.log(`   - Активный заказ: ${hasActiveOrder ? courierOrder.orderId : 'нет'}`);
            console.log(`   - Исходные capacity: 12л=${capacity12}, 19л=${capacity19}, общая=${courier.capacity}`);
            console.log(`   - Будет передан как: ${isEmpty ? 'ПУСТОЙ' : 'ЗАГРУЖЕННЫЙ'}`);
            console.log(`   - Capacity для Python: 12л=${capacity12}, 19л=${capacity19}`);
            
            return {
                id: courier.fullName,
                lat: courier.point.lat,
                lon: courier.point.lon,
                capacity_12: capacity12,  // Передаем реальное количество бутылок
                capacity_19: capacity19,  // Передаем реальное количество бутылок
                capacity: courier.capacity,
                order: courierOrder,
                completeFirstOrder: courier.completeFirstOrder
            }
        })

    const today = new Date();
    const todayString = getDateAlmaty(today);

    const activeOrders = await Order.find({"date.d": todayString, forAggregator: true, status: "awaitingOrder"})
    
    console.log(`📊 Найдено заказов для распределения: ${activeOrders.length}`);
    
    const orders = activeOrders
        .filter(order => {
            const hasValidCoords = order.address && order.address.point && order.address.point.lat && order.address.point.lon;
            if (!hasValidCoords) {
                console.log(`❌ Заказ ${order._id} исключен - нет координат`);
            }
            return hasValidCoords;
        })
        .map(order => ({
            id: order._id,
            lat: order.address.point.lat,
            lon: order.address.point.lon,
            bottles_12: order.products.b12,
            bottles_19: order.products.b19,
            status: order.status
        }));

    const courierRestrictions = await CourierRestrictions.find({})

    const courier_restrictions = courierRestrictions.reduce((acc, restriction) => {
        if (!acc[restriction.orderId]) {
            acc[restriction.orderId] = [];
        }
        acc[restriction.orderId].push(restriction.courierId);
        return acc;
    }, {});

    // return

    // // Пример вызова:
    // const couriers = [
    //     {
    //         id: 'courier_1',
    //         lat: 43.168277314921774,
    //         lon: 76.89654142009347,
    //         capacity_12: 0, // Загруженный курьер
    //         capacity_19: 0, // Загруженный курьер
    //         capacity: 40,
    //         order: null,
    //         completeFirstOrder: false
    //     },
    //     {
    //         id: 'courier_2', 
    //         lat: 43.24,
    //         lon: 76.91,
    //         capacity_12: 10, // Загруженный курьер
    //         capacity_19: 0, // Загруженный курьер
    //         capacity: 40,
    //         order: {
    //             orderId: "order_14",
    //             status: "onTheWay",
    //             lat: 43.234567, lon: 76.912345
    //         },
    //         completeFirstOrder: false
    //     },
    //     {
    //         id: 'courier_3',
    //         lat: 43.168277314921774,
    //         lon: 76.89654142009347,
    //         capacity_12: 0, // Пустой курьер
    //         capacity_19: 0, // Пустой курьер
    //         capacity: 50,
    //         order: null,
    //         completeFirstOrder: false
    //     },
    //     {
    //         id: 'courier_4',
    //         lat: 43.16,
    //         lon: 76.87,
    //         capacity_12: 6, // Пустой курьер
    //         capacity_19: 10, // Пустой курьер
    //         capacity: 16,
    //         order: {
    //             orderId: "order_11",
    //             status: "onTheWay",
    //             lat: 43.194514, lon: 76.896529
    //         },
    //         completeFirstOrder: false
    //     },
    //     // Добавляем пустых курьеров для демонстрации
    //     {
    //         id: 'courier_5',
    //         lat: 43.168277314921774,
    //         lon: 76.89654142009347,
    //         capacity_12: 0, // Пустой курьер
    //         capacity_19: 0, // Пустой курьер
    //         capacity: 50,
    //         order: null,
    //         completeFirstOrder: false
    //     },
    //     {
    //         id: 'courier_6',
    //         lat: 43.168277314921774,
    //         lon: 76.89654142009347,
    //         capacity_12: 0, // Пустой курьер
    //         capacity_19: 0, // Пустой курьер
    //         capacity: 40,
    //         order: null,
    //         completeFirstOrder: false
    //     }
    // ]
  
    // // Фильтруем только заказы со статусом "awaitingOrder" для нового распределения
    // const allOrders = [
    //     { id: 'order_1', lat: 43.292268, lon: 76.931119, bottles_12: 0, bottles_19: 23, status: "delivered" },
    //     { id: 'order_2', lat: 43.261362, lon: 76.929122, bottles_12: 0, bottles_19: 4, status: "awaitingOrder" },
    //     { id: 'order_3', lat: 43.151319, lon: 76.901267, bottles_12: 0, bottles_19: 3, status: "awaitingOrder" },
    //     { id: 'order_4', lat: 43.228644, lon: 76.866358, bottles_12: 2, bottles_19: 3, status: "awaitingOrder" },
    //     { id: 'order_5', lat: 43.187654, lon: 76.898765, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
    //     { id: 'order_6', lat: 43.254082, lon: 76.918261, bottles_12: 0, bottles_19: 5, status: "awaitingOrder" },
    //     { id: 'order_7', lat: 43.198765, lon: 76.923456, bottles_12: 0, bottles_19: 4, status: "awaitingOrder" },
    //     { id: 'order_8', lat: 43.237369, lon: 76.938627, bottles_12: 0, bottles_19: 6, status: "awaitingOrder" },
    //     { id: 'order_9', lat: 43.252214, lon: 76.90054, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
    //     { id: 'order_10', lat: 43.187654, lon: 76.912345, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
    //     { id: 'order_11', lat: 43.194514, lon: 76.896529, bottles_12: 4, bottles_19: 0, status: "onTheWay" },
    //     { id: 'order_12', lat: 43.168765, lon: 76.873977, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
    //     { id: 'order_13', lat: 43.175432, lon: 76.923456, bottles_12: 0, bottles_19: 4, status: "awaitingOrder" },
    //     { id: 'order_14', lat: 43.234567, lon: 76.912345, bottles_12: 4, bottles_19: 0, status: "onTheWay" },
    //     { id: 'order_15', lat: 43.212045, lon: 76.872848, bottles_12: 0, bottles_19: 15, status: "awaitingOrder" },
    //     { id: 'order_16', lat: 43.223456, lon: 76.934567, bottles_12: 0, bottles_19: 10, status: "awaitingOrder" },
    //     { id: 'order_17', lat: 43.264191, lon: 76.932518, bottles_12: 0, bottles_19: 20, status: "onTheWay" },
    //     { id: 'order_18', lat: 43.245678, lon: 76.887654, bottles_12: 0, bottles_19: 3, status: "awaitingOrder" },
    //     { id: 'order_19', lat: 43.212345, lon: 76.945678, bottles_12: 0, bottles_19: 4, status: "awaitingOrder" },
    //     { id: 'order_20', lat: 43.242453, lon: 76.9409, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
    //     { id: 'order_21', lat: 43.234567, lon: 76.923456, bottles_12: 0, bottles_19: 2, status: "awaitingOrder" },
    //     { id: 'order_22', lat: 43.198765, lon: 76.934567, bottles_12: 10, bottles_19: 0, status: "awaitingOrder" }
    // ]
    
    // // Разделяем заказы на активные и новые
    // const activeOrders = allOrders.filter(order => order.status === "onTheWay");
    // const newOrders = allOrders.filter(order => order.status === "awaitingOrder");
    
    // console.log(`📊 Активные заказы (уже назначены): ${activeOrders.length}`);
    // console.log(`📊 Новые заказы для распределения: ${newOrders.length}`);
    
    // // Передаем в Python только новые заказы для распределения
    // // Активные заказы курьеров будут учтены через поле order в структуре курьера
    // const orders = newOrders;
    
    // const courier_restrictions = {}

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


    const aquaMarket = await AquaMarket.findOne({
        "point.lat": { $exists: true, $ne: null },
        "point.lon": { $exists: true, $ne: null }
    });

    for (const route of result) {
        const courier = await CourierAggregator.findOne({fullName: route.courier_id});
        
        for (const orderId of route.orders) {
            await Order.findByIdAndUpdate(orderId, { $set: { courierAggregator: courier._id } });
            const order = await Order.findById(orderId).populate("client");
        
            const orderData = {
                orderId: order._id,
                status: order.status,
                products: order.products,
                sum: order.sum,
                opForm: order.opForm,
                comment: order.comment || "",
                clientReview: order.clientReview || "",
                clientTitle: order.client?.fullName || "",
                clientPhone: order.client?.phone || "",
                date: order.date,
                clientPoints: {
                    lat: order.address.point.lat,
                    lon: order.address.point.lon
                },
                clientAddress: order.address.actual,
                clientAddressLink: order.address.link || "",
                aquaMarketPoints: { lat: aquaMarket.point.lat, lon: aquaMarket.point.lon },
                aquaMarketAddress: aquaMarket.address,
                aquaMarketAddressLink: aquaMarket.link,
                step: "toAquaMarket",
                income: order.sum,
            };
        
            await CourierAggregator.updateOne(
                { _id: courier._id },
                { $push: { orders: orderData } }
            );
        }
        
        console.log(`✅ Курьер ${courier.fullName} получил ${route.orders.length} заказов`);
        console.log(`   Требуется бутылок: 12л=${route.required_bottles.bottles_12}, 19л=${route.required_bottles.bottles_19}, всего=${route.required_bottles.total}`);
        console.log(`   Курьер должен взять: 12л=${route.courier_should_take.bottles_12}, 19л=${route.courier_should_take.bottles_19}, всего=${route.courier_should_take.total}`);
        console.log(`   Использование вместимости: ${route.capacity_utilization.percent}%`);
    }

    console.log("✅ Маршруты назначены");

    console.log("Отправляем push уведомления");
    
    await sendOrderPushNotification();

    console.log("✅ Push уведомления отправлены");
}

// orTools();

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
