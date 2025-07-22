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
        // const python = spawn(pythonPath, ["./orTools/vrp_solver_optimized.py"]);
        // const python = spawn(pythonPath, ["./orTools/vrp_solver_with_time_windows_modified.py"]);
        // const python = spawn(pythonPath, ["./orTools/vrp_solver2.py"]);
        // const python = spawn(pythonPath, ["./orTools/vrp_solver_with_time_windows.py"]);
        const python = spawn(pythonPath, ["./orTools/test.py"]);
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
        
        // ПРОВЕРКА НА ДУБЛИКАТЫ: Убеждаемся что активный заказ не дублируется
        let ordersToSet = [];
        if (activeOrder) {
            // Проверяем, нет ли уже этого заказа в массиве orders
            const existingOrder = courier.orders.find(order => 
                order.orderId.toString() === activeOrder.orderId.toString()
            );
            
            if (!existingOrder) {
                ordersToSet = [activeOrder];
                console.log(`✅ Активный заказ ${activeOrder.orderId} добавлен курьеру ${courier.fullName}`);
            } else {
                ordersToSet = [existingOrder];
                console.log(`✅ Активный заказ ${activeOrder.orderId} уже есть у курьера ${courier.fullName}`);
            }
        }
        
        await CourierAggregator.updateOne(
            { _id: courier._id },
            { $set: { orders: ordersToSet, completeFirstOrder} }
        );
    }
    
    console.log("✅ Старые назначения сброшены (начатые заказы сохранены)\n");
}

// Глобальный объект для отслеживания отправленных уведомлений в текущей сессии
const sentNotifications = new Set();
// Ограничение частоты отправки уведомлений (минимальный интервал в миллисекундах)
const NOTIFICATION_COOLDOWN = 60000; // 1 минута
const lastNotificationTime = new Map(); // Время последнего уведомления для каждого курьера

const sendOrderPushNotification = async () => {
    const couriers = await CourierAggregator.find({status: "active", onTheLine: true})
    let needOrTools = false
    
    for (const courier of couriers) {
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
        
        // ПРОВЕРКА ЧАСТОТЫ: Не отправляем уведомления слишком часто
        const lastNotification = lastNotificationTime.get(courier._id.toString());
        const now = Date.now();
        
        if (lastNotification && (now - lastNotification) < NOTIFICATION_COOLDOWN) {
            const remainingTime = Math.ceil((NOTIFICATION_COOLDOWN - (now - lastNotification)) / 1000);
            console.log(`⏳ Курьер ${courier.fullName} получил уведомление недавно, ждем еще ${remainingTime} секунд`);
            continue;
        }
        
        // ПРОВЕРКА НА ДУБЛИКАТЫ: Создаем уникальный ключ для уведомления
        const notificationKey = `${courier._id}_${order.orderId}`;
        
        // Проверяем, не было ли уже отправлено уведомление для этого заказа в текущей сессии
        if (sentNotifications.has(notificationKey)) {
            console.log(`⚠️  Уведомление для заказа ${order.orderId} курьера ${courier.fullName} уже отправлено в этой сессии, пропускаем`);
            continue;
        }
        
        // Проверяем в базе данных, не было ли уже отправлено уведомление
        const existingRestriction = await CourierRestrictions.findOne({
            orderId: order.orderId,
            courierId: courier._id
        });
        
        if (existingRestriction) {
            console.log(`⚠️  Уведомление для заказа ${order.orderId} курьера ${courier.fullName} уже было отправлено ранее, пропускаем`);
            continue;
        }
        
        let messageBody = "Заказ на ";
        if (order.products.b12 > 0) {
            messageBody += `${order.products.b12} бутылок 12.5л `
        }
        if (order.products.b19 > 0) {
            messageBody += `${order.products.b19} бутылок 19.8л`
        }
        
        try {
            await pushNotification(
                "newOrder",
                messageBody,
                [courier.notificationPushToken],
                "newOrder",
                order
            );
            
            // Отмечаем уведомление как отправленное
            sentNotifications.add(notificationKey);
            lastNotificationTime.set(courier._id.toString(), now);
            console.log(`✅ Уведомление отправлено курьеру ${courier.fullName} для заказа ${order.orderId}`);
            
        } catch (error) {
            console.error(`❌ Ошибка отправки уведомления курьеру ${courier.fullName}:`, error);
            continue;
        }

        // Ждем 40 секунд для решения курьера
        await new Promise(resolve => setTimeout(resolve, 40000));
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

    // УБИРАЕМ РЕКУРСИВНЫЙ ВЫЗОВ: Вместо этого возвращаем флаг
    if (needOrTools) {
        console.log("🔄 Требуется перезапуск orTools после отклонения заказов курьерами");
        return true; // Возвращаем флаг вместо вызова orTools()
    }
    
    return false; // Нет необходимости в перезапуске
}

// Функция для очистки дубликатов заказов
const cleanupDuplicateOrders = async () => {
    console.log("🧹 ОЧИСТКА ДУБЛИКАТОВ ЗАКАЗОВ");
    
    try {
        // Получаем всех курьеров с заказами
        const couriers = await CourierAggregator.find({
            onTheLine: true,
            status: "active",
            orders: { $exists: true, $not: { $size: 0 } }
        });
        
        let totalDuplicatesRemoved = 0;
        
        for (const courier of couriers) {
            const orderIds = courier.orders.map(order => order.orderId.toString());
            const uniqueOrderIds = [...new Set(orderIds)];
            
            if (orderIds.length !== uniqueOrderIds.length) {
                console.log(`⚠️  Курьер ${courier.fullName} имеет дубликаты заказов:`);
                console.log(`   Всего заказов: ${orderIds.length}`);
                console.log(`   Уникальных: ${uniqueOrderIds.length}`);
                console.log(`   Дубликатов: ${orderIds.length - uniqueOrderIds.length}`);
                
                // Создаем уникальный массив заказов
                const uniqueOrders = [];
                const seenOrderIds = new Set();
                
                for (const order of courier.orders) {
                    const orderIdStr = order.orderId.toString();
                    if (!seenOrderIds.has(orderIdStr)) {
                        uniqueOrders.push(order);
                        seenOrderIds.add(orderIdStr);
                    }
                }
                
                // Обновляем курьера с уникальными заказами
                await CourierAggregator.updateOne(
                    { _id: courier._id },
                    { $set: { orders: uniqueOrders } }
                );
                
                const duplicatesRemoved = orderIds.length - uniqueOrderIds.length;
                totalDuplicatesRemoved += duplicatesRemoved;
                
                console.log(`✅ Удалено ${duplicatesRemoved} дубликатов у курьера ${courier.fullName}`);
            }
        }
        
        // Проверяем заказы, которые могут быть назначены нескольким курьерам
        const allOrderIds = await CourierAggregator.distinct("orders.orderId");
        
        for (const orderId of allOrderIds) {
            const couriersWithOrder = await CourierAggregator.find({
                "orders.orderId": orderId
            });
            
            if (couriersWithOrder.length > 1) {
                console.log(`⚠️  КОНФЛИКТ: Заказ ${orderId} найден у ${couriersWithOrder.length} курьеров:`);
                couriersWithOrder.forEach(courier => {
                    console.log(`   - ${courier.fullName}`);
                });
                
                // Проверяем, какому курьеру действительно назначен заказ в базе
                const order = await Order.findById(orderId);
                if (order && order.courierAggregator) {
                    const correctCourier = couriersWithOrder.find(c => 
                        c._id.toString() === order.courierAggregator.toString()
                    );
                    
                    if (correctCourier) {
                        console.log(`✅ Заказ должен быть у курьера ${correctCourier.fullName}`);
                        
                        // Удаляем заказ у всех остальных курьеров
                        await CourierAggregator.updateMany(
                            { 
                                _id: { $ne: correctCourier._id },
                                "orders.orderId": orderId 
                            },
                            { 
                                $pull: { 
                                    orders: { orderId: orderId } 
                                } 
                            }
                        );
                        
                        totalDuplicatesRemoved += couriersWithOrder.length - 1;
                        console.log(`🔄 Заказ ${orderId} удален у ${couriersWithOrder.length - 1} курьеров`);
                    }
                } else {
                    console.log(`⚠️  Заказ ${orderId} не имеет назначенного курьера в базе, удаляем у всех`);
                    
                    await CourierAggregator.updateMany(
                        { "orders.orderId": orderId },
                        { $pull: { orders: { orderId: orderId } } }
                    );
                    
                    totalDuplicatesRemoved += couriersWithOrder.length;
                }
            }
        }
        
        console.log(`✅ Очистка завершена. Удалено дубликатов: ${totalDuplicatesRemoved}`);
        
    } catch (error) {
        console.error("❌ Ошибка при очистке дубликатов:", error);
    }
};

export default async function orTools() {

    const couriers = [
        {
            id: 'courier_1',
            lat: 43.282268, lon: 76.921119,
            capacity_12: 0,
            capacity_19: 30,
            order: null,
        },
        {
            id: 'courier_2', 
            lat: 43.24,
            lon: 76.91,
            capacity_12: 10,
            capacity_19: 30,
            order: null,
        },
        {
            id: 'courier_3',
            lat: 43.168277314921774,
            lon: 76.89654142009347,
            capacity_12: 0,
            capacity_19: 40,
            order: null,
        },
        {
            id: 'courier_4',
            lat: 43.16,
            lon: 76.87,
            capacity_12: 6,
            capacity_19: 10,
            order: null,
        }
    ]
  
    const allOrders = [
        { id: 'order_1', lat: 43.292268, lon: 76.931119, bottles_12: 5, bottles_19: 0, status: "awaitingOrder", priority: 1, isUrgent: false },
        { id: 'order_2', lat: 43.261362, lon: 76.929122, bottles_12: 3, bottles_19: 0, status: "awaitingOrder", priority: 2, isUrgent: false },
        { id: 'order_3', 'lat': 43.151319, 'lon': 76.901267, 'bottles_12': 0, 'bottles_19': 3, 'status': "awaitingOrder", 'date.time': "11:00 - 13:00", 'priority': 1, 'isUrgent': true},
        { id: 'order_4', 'lat': 43.228644, 'lon': 76.866358, 'bottles_12': 0, 'bottles_19': 3, 'status': "awaitingOrder", 'date.time': "11:35 - 11:40", 'priority': 1, 'isUrgent': true},
        { id: 'order_5', 'lat': 43.187654, 'lon': 76.898765, 'bottles_12': 0, 'bottles_19': 2, 'status': "awaitingOrder", 'priority': 2, 'isUrgent': false},
        { id: 'order_6', 'lat': 43.254082, 'lon': 76.918261, 'bottles_12': 0, 'bottles_19': 5, 'status': "awaitingOrder", 'date.time': "16:30 - 18:00", 'priority': 1, 'isUrgent': false},
        { id: 'order_7', lat: 43.198765, lon: 76.923456, bottles_12: 0, bottles_19: 4, status: "awaitingOrder", priority: 2, isUrgent: false },
        { id: 'order_8', lat: 43.237369, lon: 76.938627, bottles_12: 0, bottles_19: 6, status: "awaitingOrder", priority: 1, isUrgent: false },
        { id: 'order_9', lat: 43.252214, lon: 76.90054, bottles_12: 0, bottles_19: 2, status: "awaitingOrder", priority: 3, isUrgent: false },
        { id: 'order_10', lat: 43.187654, lon: 76.912345, bottles_12: 0, bottles_19: 2, status: "awaitingOrder", priority: 2, isUrgent: false },
        { id: 'order_11', lat: 43.194514, lon: 76.896529, bottles_12: 4, bottles_19: 0, status: "awaitingOrder", priority: 3, isUrgent: false },
        { id: 'order_12', lat: 43.168765, lon: 76.873977, bottles_12: 0, bottles_19: 2, status: "awaitingOrder", priority: 2, isUrgent: false },
        { id: 'order_13', lat: 43.175432, lon: 76.923456, bottles_12: 0, bottles_19: 4, status: "awaitingOrder", priority: 1, isUrgent: false },
        { id: 'order_14', lat: 43.234567, lon: 76.912345, bottles_12: 4, bottles_19: 0, status: "awaitingOrder", priority: 3, isUrgent: false },
        { id: 'order_15', lat: 43.212045, lon: 76.872848, bottles_12: 0, bottles_19: 15, status: "awaitingOrder", priority: 3, isUrgent: false },
        { id: 'order_16', lat: 43.223456, lon: 76.934567, bottles_12: 0, bottles_19: 10, status: "awaitingOrder", priority: 2, isUrgent: false },
        { id: 'order_17', lat: 43.264191, lon: 76.932518, bottles_12: 0, bottles_19: 20, status: "awaitingOrder", priority: 1, isUrgent: false },
        { id: 'order_18', lat: 43.245678, lon: 76.887654, bottles_12: 0, bottles_19: 3, status: "awaitingOrder", priority: 3, isUrgent: false },
        { id: 'order_19', lat: 43.212345, lon: 76.945678, bottles_12: 0, bottles_19: 4, status: "awaitingOrder", priority: 2, isUrgent: false },
        { id: 'order_20', lat: 43.242453, lon: 76.9409, bottles_12: 0, bottles_19: 2, status: "awaitingOrder", priority: 1, isUrgent: false },
        { id: 'order_21', lat: 43.234567, lon: 76.923456, bottles_12: 0, bottles_19: 2, status: "awaitingOrder", priority: 2, isUrgent: false },
        { id: 'order_22', lat: 43.198765, lon: 76.934567, bottles_12: 10, bottles_19: 0, status: "awaitingOrder", priority: 1, isUrgent: false }
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

    // return

    

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

    for (const courier of couriers) {
        const activeOrder = courier.order;
        if (activeOrder && activeOrder.orderId) {
            const alreadyIncluded = orders.find(o => o.id === activeOrder.orderId);
            if (!alreadyIncluded) {
                const fullOrder = allOrders.find(o => o.id === activeOrder.orderId);
                if (fullOrder) {
                    orders.push(fullOrder);
                }
            }
        }
    }

    try {
        const visualizeResult = await runPythonVisualize(couriers, allOrders, result);
        console.log("Результат визуализации:", visualizeResult);
    } catch (error) {
        console.error("Ошибка визуализации:", error);
        console.log("Пропускаем отправку уведомлений из-за ошибки визуализации");
        return;
    }


    for (const route of result) {
        // Пропускаем маршруты без заказов
        if (!route.orders || !Array.isArray(route.orders)) {
            console.log(`⚠️  Курьер ${route.courier_id}: маршрут без заказов`);
            continue;
        }
        
        const courier = couriers.find(c => c.id === route.courier_id)
        const hasActiveOrder = courier.order && courier.order.status === "onTheWay"
        const isEmptyCourier = courier.capacity_12 === 0 && courier.capacity_19 === 0
        
        console.log(`✅ Курьер ${route.courier_id} получил ${route.orders.length} заказов`);
        console.log(`   Тип курьера: ${route.courier_type || (isEmptyCourier ? 'ПУСТОЙ' : 'ЗАГРУЖЕННЫЙ')}`);
        console.log(`   Требуется бутылок: 12л=${route.required_bottles?.bottles_12 || 0}, 19л=${route.required_bottles?.bottles_19 || 0}, всего=${route.required_bottles?.total || 0}`);
        console.log(`   Курьер должен взять: 12л=${route.courier_should_take?.bottles_12 || 0}, 19л=${route.courier_should_take?.bottles_19 || 0}, всего=${route.courier_should_take?.total || 0}`);
        console.log(`   Использование вместимости: ${route.capacity_utilization?.percent || 0}%`);
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
