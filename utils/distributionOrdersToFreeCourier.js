import CourierAggregator from "../Models/CourierAggregator.js";
import Order from "../Models/Order.js";
import AquaMarket from "../Models/AquaMarket.js";
import { pushNotification } from "../pushNotification.js";
import getLocationsLogicQueue from "./getLocationsLogicQueue.js";

function calculateHypotenuseDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Радиус Земли в метрах
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = Math.floor(R * c)
    return distance
}

// Функция для расчета полного пути через все точки
function calculatePathDistance(points) {
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
        totalDistance += calculateHypotenuseDistance(
            points[i].lat,
            points[i].lon,
            points[i + 1].lat,
            points[i + 1].lon
        );
    }
    return totalDistance;
}

const bestAqua = (start, end, aquaMarkets) => {
    let bestDistance = Infinity;
    let best = null;

    // Шаг 1: Находим аквамаркет с минимальной дистанцией без учета dispensedBottlesKol
    aquaMarkets.forEach((aquaMarket) => {
        const distance =
            calculateHypotenuseDistance(start.lat, start.lon, aquaMarket.point.lat, aquaMarket.point.lon) +
            calculateHypotenuseDistance(end.lat, end.lon, aquaMarket.point.lat, aquaMarket.point.lon);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = aquaMarket;
        }
    });

    // Шаг 2: Проверяем dispensedBottlesKol у лучшего аквамаркета
    if (best && best.dispensedBottlesKol < 50) {
        return { bestDistance, best }; // Если условие выполнено, возвращаем его
    }

    // Шаг 3: Если dispensedBottlesKol > 50, ищем подходящие альтернативы
    let alternativeDistance = Infinity;
    let alternativeBest = null;
    let alternativeDispensedBootlesKol = Infinity

    aquaMarkets.forEach((aquaMarket) => {
        const distance =
            calculateHypotenuseDistance(start.lat, start.lon, aquaMarket.point.lat, aquaMarket.point.lon) +
            calculateHypotenuseDistance(end.lat, end.lon, aquaMarket.point.lat, aquaMarket.point.lon);
        if (distance < alternativeDistance && 
            distance <= bestDistance * 2 && 
            aquaMarket.dispensedBottlesKol < alternativeDispensedBootlesKol && 
            best._id !== aquaMarket._id
        ) {
            alternativeDistance = distance;
            alternativeBest = aquaMarket;
            alternativeDispensedBootlesKol = aquaMarket.dispensedBottlesKol
        }
    });

    // Шаг 4: Возвращаем лучший альтернативный аквамаркет или null, если ничего не найдено
    if (alternativeBest) {
        return { bestDistance: alternativeDistance, best: alternativeBest };
    }

    // Если нет подходящих альтернатив, возвращаем null
    return { bestDistance, best };
};

// Функция для поиска кратчайшего пути
async function findShortestPath(courier, order) {
    const startPoint = { lat: courier.point.lat, lon: courier.point.lon, type: "courier" };
    const endPoint = { lat: order.address.point.lat, lon: order.address.point.lon, type: "client" };

    console.log("startPoint = ", startPoint);
    console.log("endPoint = ", endPoint);
    

    // Точки из текущих заказов курьера
    const orderPoints = courier.orders.map((o, index) =>
        {
            return [
                { lat: o.clientPoints.lat, lon: o.clientPoints.lon, type: "client", orderId: o.orderId }
            ]
            // if (index === 0 && o.step === "toClient") {
            //     return [
            //         { lat: o.clientPoints.lat, lon: o.clientPoints.lon, type: "client", orderId: o.orderId }
            //     ]
            // }
            // return [
            //     { lat: o.aquaMarketPoints.lat, lon: o.aquaMarketPoints.lon, type: "aquaMarket", orderId: o.orderId },
            //     { lat: o.clientPoints.lat, lon: o.clientPoints.lon, type: "client", orderId: o.orderId }
            // ]
        }
    ).flat();

    // Точки аквамаркетов с dispensedBottlesKol <= 50 и достаточным количеством бутылок
    let validAquaMarkets = await AquaMarket.find({
        // dispensedBottlesKol: { $lte: 50 }, 
        "full.b12": { $gte: order.products.b12 },
        "full.b191": { $gte: order.products.b19 }
    })

    if (validAquaMarkets.length === 0) return null;

    let shortestPath = null;
    let minDistance = Infinity
    let selectedAquaMarket = null;

    if (orderPoints.length === 0) {
        const {bestDistance, best} = bestAqua(startPoint, endPoint, validAquaMarkets)
        if (!best) return null;
        minDistance = calculateHypotenuseDistance(startPoint.lat, startPoint.lon, endPoint.lat, endPoint.lon)
        selectedAquaMarket = best
        const point = {...best.point, type: "aquaMarket", orderId: order?._id}
        shortestPath = [startPoint, endPoint]
    } else {
        const {bestDistance, best} = bestAqua(orderPoints[orderPoints.length - 1], endPoint, validAquaMarkets)
        if (!best) return null;
        const distance = calculatePathDistance([startPoint, ...orderPoints]);
        minDistance = distance + calculateHypotenuseDistance(orderPoints[orderPoints.length - 1].lat, orderPoints[orderPoints.length - 1].lon, endPoint.lat, endPoint.lon)
        selectedAquaMarket = best
        const point = {...best.point, type: "aquaMarket", orderId: order?._id}
        shortestPath = [startPoint, ...orderPoints, endPoint]
    }

    console.log("minDistance = ", minDistance);
    console.log("shortestPath = ", shortestPath);
    console.log("selectedAquaMarket = ", selectedAquaMarket);
    

    return { path: shortestPath, distance: minDistance, aquaMarket: selectedAquaMarket };
}

async function distributionOrdersToFreeCourier(courierId) {
    try {
        const result = await CourierAggregator.aggregate([
            {
                $unwind: {
                    path: "$orders",
                    includeArrayIndex: "arrayIndex" // Добавляем поле с индексом элемента
                }
            },
            // Фильтруем только элементы с индексом > 1
            {
                $match: {
                    "arrayIndex": { $gt: 1 } // Индекс больше 1 (т.е. третий элемент и далее)
                }
            },
            // Проецируем нужные поля
            {
                $project: {
                    orderId: "$orders.orderId"
                }
            }
        ]);

        // Если нужно получить сами заказы из коллекции Order
        const orderIds = result.map(item => item.orderId);
        const courierAggregatorOrders = await Order.find({ _id: { $in: orderIds } }).sort({ createdAt: 1 }).populate("client", "fullName phone");
        const aggregatorOrders = await Order.find({
            forAggregator: true,
            courierAggregator: null,
        }).sort({ createdAt: 1 });
        
        const orders = [...courierAggregatorOrders, ...aggregatorOrders].sort((a, b) => 
            new Date(a.createdAt) - new Date(b.createdAt)
        );

        await CourierAggregator.updateMany(
            {},
            {
                $pull: {
                    orders: {
                        orderId: { $in: orderIds }
                    }
                }
            }
        );

        // Отправляем заказы на переназначение через getLocationsLogicQueue

        if (!orders || orders?.length === 0) {
            console.log("нет активных заказов");
            return false;
        }

        let freeCourier = await CourierAggregator.findOne({ 
            _id: courierId,
            onTheLine: true 
        });
        
        if (!freeCourier) {
            console.log("Курьер не активен");
            return false;
        }

        // if (freeCourier.soldBootles && freeCourier.soldBootles.date) {
        //     const today = new Date()
        //     const soldDate = new Date(freeCourier.soldBootles.date || today);
        //     today.setHours(0, 0, 0, 0)
        //     soldDate.setHours(0, 0, 0, 0); // Устанавливаем начало дня для soldBootles.date

        //     if (soldDate.getTime() !== today.getTime()) {
        //         freeCourier.soldBootles.kol = 0;
        //         freeCourier.soldBootles.date = today
        //         await freeCourier.save(); // Сохраняем изменения в базе
        //         console.log(`Обнулено soldBootles.kol для курьера ${freeCourier.fullName}`);
        //     }
        // }

        try {
            await pushNotification("getLocation", "getLocation", [freeCourier.notificationPushToken], "getLocation");
        } catch (pushErr) {
            console.error("Ошибка при отправке уведомления:", pushErr);
        }
        await new Promise(resolve => setTimeout(resolve, 10000));

        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        freeCourier = await CourierAggregator.find({_id: courierId, "point.timestamp": { $gte: twoMinutesAgo }})

        if (!freeCourier || freeCourier.length === 0) {
            console.log("не знаем где находится курьер");
            return
        } else {
            freeCourier = freeCourier[0]
        }

        const freeCourierLat = freeCourier.point.lat 
        const freeCourierLon = freeCourier.point.lon
        if (!freeCourierLat || !freeCourierLon) {
            console.log("не знаем где находится курьер 2222");
            return
        }

        const pathInfo = await findShortestPath(freeCourier, orders[0]);

        const nearestCourier = {
            ...freeCourier.toObject(), 
            totalDistance: pathInfo.distance,
            path: pathInfo.path,
            aquaMarket: pathInfo.aquaMarket
        }

        const sendOrderData = await Order.findById(orders[0]._id).populate("client", "fullName phone")

        const sendOrder = {
            orderId: sendOrderData._id,
            status: sendOrderData.status,
            products: sendOrderData.products,
            clientTitle: sendOrderData.client.fullName,
            clientPhone: sendOrderData.client.phone,
            sum: sendOrderData.sum,
            opForm: sendOrderData.opForm,
            comment: sendOrderData.comment,
            clientReview: sendOrderData.clientReview,
            date: sendOrderData.date,
            clientPoints: { lat: sendOrderData.address.point.lat, lon: sendOrderData.address.point.lon },
            clientAddress: sendOrderData.address.actual,
            clientAddressLink: sendOrderData.address.link,
            aquaMarketPoints: { lat: nearestCourier.aquaMarket.point.lat, lon: nearestCourier.aquaMarket.point.lon },
            aquaMarketAddress: nearestCourier.aquaMarket.address,
            aquaMarketAddressLink: nearestCourier.aquaMarket.link,
            step: "toAquaMarket",
            income: sendOrderData.sum
        }

        let message = ""

        if (sendOrderData?.products?.b19 > 0) {
            message += `${sendOrderData?.products?.b19} 19.8 бутылей.`
        }

        if (sendOrderData?.products?.b12 > 0) {
            message += `${sendOrderData?.products?.b12} 12.5 бутылей.`
        }

        message += `Забрать из аквамаркета: ${nearestCourier.aquaMarket.address}`

        await pushNotification(
            "newOrder",
            message,
            [nearestCourier.notificationPushToken],
            "newOrder",
            sendOrder
        );

        await new Promise(resolve => setTimeout(resolve, 30000));

        const order = await Order.findById(orders[0]._id)

        if (order.status !== "onTheWay") {
            console.log("Курьер не принял заказ");
            await Order.updateOne({_id: orders[0]._id}, { $set: { courierAggregator: null } })
            for (const orderId of orderIds) {
                await getLocationsLogicQueue(orderId);
            }
            return
        }

        // Удаляем заказ из списка заказов других курьеров
        if (order.status === "onTheWay") {
            await CourierAggregator.updateMany(
                { 
                    _id: { $ne: freeCourier._id }, // Исключаем текущего курьера
                    "orders.orderId": orders[0]._id 
                },
                { 
                    $pull: { 
                        orders: { 
                            orderId: orders[0]._id 
                        } 
                    } 
                }
            );
            await Order.updateOne({_id: orders[0]._id}, { $set: { courierAggregator: freeCourier._id } })
            for (const orderId of orderIds) {
                if (orderId !== orders[0]._id) {
                    await getLocationsLogicQueue(orderId);
                }
            }
        }

        // for (const order of orders) {
        //     await getLocationsLogicQueue(order._id);
        // }

    } catch (error) {
        
    }
}

export default distributionOrdersToFreeCourier