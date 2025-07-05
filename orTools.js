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

const zeroing = async () => {
    const todayString = getDateAlmaty();
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

    await ensureMongoConnection();

    await zeroing();

    const activeCouriers = await CourierAggregator.find({status: "active", onTheLine: true})

    // Пример вызова:
    const couriers = activeCouriers.map(courier => ({
        id: courier._id,
        lat: courier.point.lat,
        lon: courier.point.lon
    }));

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const todayString = getDateAlmaty(today);

    const activeOrders = await Order.find({"date.d": todayString, forAggregator: true, status: { $nin: ["onTheWay", "delivered", "cancelled"] }})
    
    const orders = activeOrders.map(order => ({
        id: order._id,
        lat: order.address.point.lat,
        lon: order.address.point.lon
    }));

    const courierRestrictions = await CourierRestrictions.find({})

    const courier_restrictions = courierRestrictions.reduce((acc, restriction) => {
        if (!acc[restriction.orderId]) {
            acc[restriction.orderId] = [];
        }
        acc[restriction.orderId].push(restriction.courierId);
        return acc;
    }, {});


    // Пример вызова:
    // const couriers = [
    //     {
    //         id: '683dd48b54ed3e4c0adcc241',
    //         lat: 43.168277314921774,
    //         lon: 76.89654142009347
    //     },
    //     {
    //         id: '68413276b70d315d3b2b732f',
    //         lat: 43.2044094,
    //         lon: 76.893334
    //     }
    // ]
  
    // const orders = [
    //     { id: '68662e7ee6675f4410cea767', lat: 43.292268, lon: 76.931119 },
    //     { id: '68665ce0e6675f4410ceda93', lat: 43.261362, lon: 76.929122 },
    //     { id: '6867e884e6675f4410d04ade', lat: 43.151319, lon: 76.901267 },
    //     { id: '6867e8b0e6675f4410d04b3c', lat: 43.228644, lon: 76.866358 },
    //     { id: '6867e8cde6675f4410d04b50', lat: 43.212045, lon: 76.872848 },
    //     { id: '6867e8ede6675f4410d04b7a', lat: 43.254082, lon: 76.918261 },
    //     { id: '68682a25e6675f4410d058b0', lat: 43.264191, lon: 76.932518 },
    //     { id: '6868b92c8bc69822dd93c6c0', lat: 43.237369, lon: 76.938627 },
    //     { id: '6868b96e8bc69822dd93c7ad', lat: 43.252214, lon: 76.90054 },
    //     { id: '6868b9e68bc69822dd93ca39', lat: 43.242453, lon: 76.9409 },
    //     { id: '6868ba138bc69822dd93cb3b', lat: 43.194514, lon: 76.896529 },
    //     { id: '6868bb778bc69822dd93d2cd', lat: 43.168765, lon: 76.873977 }
    // ]
    
    // const courier_restrictions = {}

    console.log("Начало распределения в orTools.js");
    
    console.log("количество курьеров = ", couriers.length)
    console.log("количество заказов = ", orders.length)
    console.log("ограничения на заказы = ", courier_restrictions)

    console.log("couriers = ", couriers)
    console.log("orders = ", orders)
    console.log("courier_restrictions = ", courier_restrictions)
    
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

    await runPythonVisualize(couriers, orders, result);

    const aquaMarket = await AquaMarket.findOne({
        "point.lat": { $exists: true, $ne: null },
        "point.lon": { $exists: true, $ne: null }
    });

    for (const route of result) {
        const courier = await CourierAggregator.findById(route.courier_id);
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
        
    }

    console.log("✅ Маршруты назначены");

    console.log("Отправляем push уведомления");
    
    await sendOrderPushNotification();

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

