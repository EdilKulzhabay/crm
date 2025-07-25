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
        const python = spawn(pythonPath, ["./orTools/vrp_solver_with_time_windows.py"]);

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
        const python = spawn(pythonPath, ["./orTools/testViz.py"]);

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

    if (needOrTools) {
        // Вызываем orTools напрямую, чтобы избежать циклической зависимости
        // Это внутренний вызов, который должен выполниться сразу
        console.log("🔄 Перезапуск orTools после отклонения заказов курьерами");
        await orTools();
        console.log("🔄 Требуется перезапуск orTools после отклонения заказов курьерами");
        return true; // Возвращаем флаг вместо вызова orTools()
    }
    
    return false;
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

    return

    await ensureMongoConnection();

    // ОЧИСТКА ДУБЛИКАТОВ ПЕРЕД НАЧАЛОМ РАБОТЫ
    await cleanupDuplicateOrders();

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
            let courierOrder = null;
            if (courier.order && courier.order.orderId && courier.order.clientPoints) {
                courierOrder = {
                    orderId: courier.order.orderId,
                    status: courier.order.status,
                    lat: courier.order.clientPoints.lat,
                    lon: courier.order.clientPoints.lon,
                    bottles_12: courier.order.products ? courier.order.products.b12 : 0,
                    bottles_19: courier.order.products ? courier.order.products.b19 : 0,
                    orderName: courier.order.clientTitle || courier.order.orderId // Используем clientTitle если есть, иначе orderId
                };
            }
            
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

    const activeOrders = await Order.find({"date.d": todayString, forAggregator: true, status: "awaitingOrder"}).populate("client")
    
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
            orderId: order._id,
            lat: order.address.point.lat,
            lon: order.address.point.lon,
            bottles_12: order.products.b12,
            bottles_19: order.products.b19,
            status: order.status,
            orderName: order.client.fullName,
            isUrgent: order.isUrgent,
            "date.time": order.date.time
        }));

    const courier_restrictions = {}

    console.log("Начало распределения в orTools.js");
    
    console.log("количество курьеров = ", couriers.length)
    console.log("количество заказов = ", orders.length)
    console.log("ограничения на заказы = ", courier_restrictions)

    console.log("couriers = ", couriers)
    console.log("orders = ", orders)
    
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
        
        // ПРОВЕРКА НА ДУБЛИКАТЫ: Получаем текущие заказы курьера
        const existingOrderIds = courier.orders.map(order => order.orderId.toString());
        console.log(`📋 Курьер ${courier.fullName} уже имеет заказы: ${existingOrderIds.join(', ')}`);
        
        for (const orderId of route.orders) {
            // ПРОВЕРКА 1: Проверяем, нет ли уже этого заказа у курьера
            if (existingOrderIds.includes(orderId.toString())) {
                console.log(`⚠️  ДУБЛИКАТ НАЙДЕН: Заказ ${orderId} уже есть у курьера ${courier.fullName}, пропускаем`);
                continue;
            }
            
            // ПРОВЕРКА 2: Проверяем, не назначен ли заказ другому курьеру
            const existingAssignment = await Order.findById(orderId);
            if (existingAssignment && existingAssignment.courierAggregator && 
                existingAssignment.courierAggregator.toString() !== courier._id.toString()) {
                console.log(`⚠️  КОНФЛИКТ: Заказ ${orderId} уже назначен другому курьеру, пропускаем`);
                continue;
            }
            
            // ПРОВЕРКА 3: Убеждаемся, что заказ не находится у других курьеров
            const otherCouriersWithOrder = await CourierAggregator.find({
                _id: { $ne: courier._id },
                "orders.orderId": orderId
            });
            
            if (otherCouriersWithOrder.length > 0) {
                console.log(`⚠️  НАЙДЕН У ДРУГИХ: Заказ ${orderId} найден у курьеров: ${otherCouriersWithOrder.map(c => c.fullName).join(', ')}`);
                // Удаляем заказ у других курьеров
                await CourierAggregator.updateMany(
                    { 
                        _id: { $ne: courier._id },
                        "orders.orderId": orderId 
                    },
                    { 
                        $pull: { 
                            orders: { orderId: orderId } 
                        } 
                    }
                );
                console.log(`🔄 Заказ ${orderId} удален у других курьеров`);
            }
            
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
        
            // БЕЗОПАСНОЕ ДОБАВЛЕНИЕ: Используем $addToSet вместо $push для предотвращения дубликатов
            await CourierAggregator.updateOne(
                { _id: courier._id },
                { $addToSet: { orders: orderData } }
            );
            
            console.log(`✅ Заказ ${orderId} успешно добавлен курьеру ${courier.fullName}`);
        }
        
        console.log(`✅ Курьер ${courier.fullName} получил ${route.orders.length} заказов`);
        console.log(`   Требуется бутылок: 12л=${route.required_bottles.bottles_12}, 19л=${route.required_bottles.bottles_19}, всего=${route.required_bottles.total}`);
        console.log(`   Курьер должен взять: 12л=${route.courier_should_take.bottles_12}, 19л=${route.courier_should_take.bottles_19}, всего=${route.courier_should_take.total}`);
        console.log(`   Использование вместимости: ${route.capacity_utilization.percent}%`);
    }

    console.log("✅ Маршруты назначены");

    console.log("Отправляем push уведомления");
    
    const needOrTools = await sendOrderPushNotification();

    if (needOrTools) {
        console.log("🔄 Перезапуск orTools после отклонения заказов курьерами");
        await orTools();
    }

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