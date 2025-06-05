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
        const courierAggregatorOrders = await Order.find({ _id: { $in: orderIds } }).sort({ createdAt: 1 });
        const aggregatorOrders = await Order.find({
            forAggregator: true,
            courierAggregator: null,
            status: "awaitingOrder"
        }).sort({ createdAt: 1 });
        
        const orders = [...courierAggregatorOrders, ...aggregatorOrders].sort((a, b) => 
            new Date(a.createdAt) - new Date(b.createdAt)
        );

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
            await pushNotification("location", "location", [freeCourier.notificationPushToken], "location");
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
        const nearestCourier = await findShortestPath(freeCourier, orders[0]);

        const sendOrder = {
            orderId: order[0]._id,
            status: order[0].status,
            products: order[0].products,
            sum: order[0].sum,
            opForm: order[0].opForm,
            comment: order[0].comment,
            clientReview: order[0].clientReview,
            date: order[0].date,
            clientPoints: { lat: order[0].address.point.lat, lon: order[0].address.point.lon },
            clientAddress: order[0].address.actual,
            clientAddressLink: order[0].address.link,
            aquaMarketPoints: { lat: nearestCourier.aquaMarket.point.lat, lon: nearestCourier.aquaMarket.point.lon },
            aquaMarketAddress: nearestCourier.aquaMarket.address,
            aquaMarketAddressLink: nearestCourier.aquaMarket.link,
            step: "toAquaMarket",
            income: order[0].sum
        }

        await pushNotification(
            "newOrder",
            `${order?.products?.b19} бутылей. Забрать из аквамаркета: ${nearestCourier.aquaMarket.address}`,
            [nearestCourier.notificationPushToken],
            "newOrder",
            sendOrder
        );

        await new Promise(resolve => setTimeout(resolve, 20000));

        const order = await Order.findById(orders[0]._id)

        if (order.status !== "onTheWay") {
            console.log("Курьер не принял заказ");
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
        }

        await CourierAggregator.updateMany(
            { "orders.orderId": { $in: orderIds } }, // Находим курьеров, у которых есть эти заказы
            { $pull: { orders: { orderId: { $in: orderIds } } } } // Удаляем заказы из массива
        );

        

        // for (const order of orders) {
        //     await getLocationsLogicQueue(order._id);
        // }

    } catch (error) {
        
    }
}

export default distributionOrdersToFreeCourier