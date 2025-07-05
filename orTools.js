import CourierAggregator from "./Models/CourierAggregator.js"
import Order from "./Models/Order.js"
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import CourierRestrictions from "./Models/CourierRestrictions.js";
import AquaMarket from "./Models/AquaMarket.js";
import { pushNotification } from "./pushNotification.js";
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

const zeroing = async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const todayString = `${year}-${month}-${day}`;
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
    const needOrTools = false
    for (const courier of couriers) {

        if (courier.orders.length === 0 || courier.orders.length === undefined || courier.orders.length === null) {
            continue;
        }

        if (courier.order && courier.order.status === "onTheWay") {
            continue;
        }

        const orders = courier.orders
        for (const order of orders) {
            const messageBody = "Заказ на "
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

    // await zeroing();

    // const activeCouriers = await CourierAggregator.find({status: "active", onTheLine: true})

    // // Пример вызова:
    // const couriers = activeCouriers.map(courier => ({
    //     id: courier._id,
    //     lat: courier.point.lat,
    //     lon: courier.point.lon
    // }));

    // const today = new Date();
    // const year = today.getFullYear();
    // const month = today.getMonth();
    // const day = today.getDate();
    // const todayString = `${year}-${month}-${day}`;

    // const activeOrders = await Order.find({"date.d": todayString, forAggregator: true, status: { $nin: ["onTheWay", "delivered", "cancelled"] }})
    
    // const orders = activeOrders.map(order => ({
    //     id: order._id,
    //     lat: order.address.point.lat,
    //     lon: order.address.point.lon
    // }));

    // const courierRestrictions = await CourierRestrictions.find({})

    // const courier_restrictions = courierRestrictions.reduce((acc, restriction) => {
    //     if (!acc[restriction.orderId]) {
    //         acc[restriction.orderId] = [];
    //     }
    //     acc[restriction.orderId].push(restriction.courierId);
    //     return acc;
    // }, {});


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
        {"id": "order6", "lat": 43.292268, "lon": 76.931119}
    ]
    
    const courier_restrictions = {
        "order1": [1, 2],
        "order2": [1, 2],
        "order7": [2],
    }
    
    const result = await runPythonVRP(couriers, orders, courier_restrictions);
    console.log("Готовые маршруты:", result);

    await runPythonVisualize(couriers, orders, result);

    // const aquaMarket = await AquaMarket.findOne({
    //     "point.lat": { $exists: true, $ne: null },
    //     "point.lon": { $exists: true, $ne: null }
    // });

    // for (const route of result) {
    //     const courier = await CourierAggregator.findById(route.courier_id);
    //     const orders = await Order.find({_id: { $in: route.orders }});
    //     for (const orderId of orders) {
    //         await Order.findByIdAndUpdate(orderId, { $set: { courierAggregator: courier._id } });
    //         const order = await Order.findById(orderId).populate("client");
    //         const orderData = {
    //             orderId: order.toString(),
    //             status: "onTheWay",
    //             products: order.products,
    //             sum: order.sum,
    //             opForm: order.opForm,
    //             comment: order.comment || "",
    //             clientReview: order.clientReview || "",
    //             clientTitle: order.client?.fullName || "",
    //             clientPhone: order.client?.phone || "",
    //             date: order.date,
    //             clientPoints: {
    //                 lat: order.address.point.lat,
    //                 lon: order.address.point.lon
    //             },
    //             clientAddress: order.address.actual,
    //             clientAddressLink: order.address.link || "",
    //             aquaMarketPoints: { lat: aquaMarket.point.lat, lon: aquaMarket.point.lon },
    //             aquaMarketAddress: aquaMarket.address,
    //             aquaMarketAddressLink: aquaMarket.link,
    //             step: "toAquaMarket",
    //             income: order.sum,
    //         };

    //         await CourierAggregator.updateOne(
    //             { _id: courier._id },
    //             { $push: { orders: orderData } }
    //         );
    //     }
    // }

    // console.log("✅ Маршруты назначены");

    // console.log("Отправляем push уведомления");
    
    // await sendOrderPushNotification();

    // console.log("✅ Push уведомления отправлены");
}

orTools();

