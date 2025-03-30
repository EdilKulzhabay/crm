import CourierAggregator from "../Models/CourierAggregator.js";
import Order from "../Models/Order.js";
import AquaMarket from "../Models/AquaMarket.js";
import { pushNotification } from "../pushNotification.js";

// const locationQueue = [];
// let isProcessing = false;

// async function processQueue() {
//     if (isProcessing || locationQueue.length === 0) return;

//     isProcessing = true;
//     const { orderId, resolve, reject } = locationQueue.shift(); // Берем первую задачу из очереди

//     try {
//         const result = await getLocationsLogicInternal(orderId);
//         resolve(result);
//     } catch (error) {
//         reject(error);
//     } finally {
//         isProcessing = false;
//         processQueue(); // Обрабатываем следующую задачу в очереди
//     }
// }

// function getLocationsLogicQueue(orderId) {
//     return new Promise((resolve, reject) => {
//         locationQueue.push({ orderId, resolve, reject });
//         processQueue();
//     });
// }

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

    // Точки из текущих заказов курьера
    const orderPoints = courier.orders.map((o, index) =>
        {
            if (index === 0 && o.step === "toClient") {
                return [
                    { lat: o.clientPoints.lat, lon: o.clientPoints.lon, type: "client", orderId: o.orderId }
                ]
            }
            return [
                { lat: o.aquaMarketPoints.lat, lon: o.aquaMarketPoints.lon, type: "aquaMarket", orderId: o.orderId },
                { lat: o.clientPoints.lat, lon: o.clientPoints.lon, type: "client", orderId: o.orderId }
            ]
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
        minDistance = bestDistance
        selectedAquaMarket = best
        const point = {...best.point, type: "aquaMarket", orderId: order?._id}
        shortestPath = [startPoint, point, endPoint]
    } else {
        const {bestDistance, best} = bestAqua(orderPoints[orderPoints.length - 1], endPoint, validAquaMarkets)
        if (!best) return null;
        const distance = calculatePathDistance([startPoint, ...orderPoints]);
        minDistance = distance + bestDistance
        selectedAquaMarket = best
        const point = {...best.point, type: "aquaMarket", orderId: order?._id}
        shortestPath = [startPoint, ...orderPoints, point, endPoint]
    }

    console.log("minDistance = ", minDistance);
    console.log("shortestPath = ", shortestPath);
    console.log("selectedAquaMarket = ", selectedAquaMarket);
    

    return { path: shortestPath, distance: minDistance, aquaMarket: selectedAquaMarket };
}

async function getLocationsLogic (orderId) {
    try {
        console.log("we in getLocationsLogic");
        
        if (!orderId) {
            console.log("orderId обязателен");
            return
            
            // return res.status(400).json({
            //     success: false,
            //     message: "orderId обязателен",
            // });
        }

        let order = await Order.findById(orderId);
        if (!order) {
            console.log("Заказ не найден");
            return
            
            // return res.status(404).json({
            //     success: false,
            //     message: "Заказ не найден",
            // });
        }

        console.log("order in getLocationLogin = ", order);
        

        const couriers = await CourierAggregator.find({ onTheLine: true });
        if (couriers.length === 0) {
            console.log("Нет активных курьеров для отправки уведомлений");
            return
            
            // return res.status(404).json({
            //     success: false,
            //     message: "Нет активных курьеров для отправки уведомлений",
            // });
        }

        const tokens = couriers.flatMap(item => item.notificationPushTokens || []);
        if (tokens.length === 0) {
            console.log("Нет токенов для отправки уведомлений");
            return
            
            // return res.status(404).json({
            //     success: false,
            //     message: "Нет токенов для отправки уведомлений",
            // });
        }

        const rejectedCourierIds = new Set();

        while (order?.status !== "onTheWay") {
            try {
                try {
                    await pushNotification("location", "location", tokens, "location");
                } catch (pushErr) {
                    console.error("Ошибка при отправке уведомления:", pushErr);
                }
                await new Promise(resolve => setTimeout(resolve, 10000));

                const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
                const updatedCouriers = await CourierAggregator.find({///////НУЖНО ИСКАТЬ ТОЛЬКО ТЕХ У КОГО ONTTHELINE TRUE
                    "point.timestamp": { $gte: twoMinutesAgo },
                    _id: { $nin: Array.from(rejectedCourierIds) }
                });

                console.log("updatedCouriers = ", updatedCouriers);

                if (updatedCouriers.length === 0) {
                    console.log("Нет доступных курьеров с актуальными координатами");
                    break;
                }

                for (const courier of updatedCouriers) {
                    if (courier.soldBootles && courier.soldBootles.date) {
                        const today = new Date()
                        const soldDate = new Date(courier.soldBootles.date || today);
                        today.setHours(0, 0, 0, 0)
                        soldDate.setHours(0, 0, 0, 0); // Устанавливаем начало дня для soldBootles.date

                        if (soldDate.getTime() !== today.getTime()) {
                            courier.soldBootles.kol = 0;
                            courier.soldBootles.date = today
                            await courier.save(); // Сохраняем изменения в базе
                            console.log(`Обнулено soldBootles.kol для курьера ${courier.fullName}`);
                        }
                    }
                }

                // Находим кратчайший путь для каждого курьера
                const couriersWithPath = await Promise.all(
                    updatedCouriers.map(async courier => {
                        const courierLat = courier.point.lat;
                        const courierLon = courier.point.lon;

                        if (!courierLat || !courierLon) {
                            return { ...courier.toObject(), totalDistance: Infinity };
                        }

                        const pathInfo = await findShortestPath(courier, order);
                        if (!pathInfo) {
                            return { ...courier.toObject(), totalDistance: Infinity };
                        }

                        return {
                            ...courier.toObject(),
                            totalDistance: pathInfo.distance,
                            path: pathInfo.path,
                            aquaMarket: pathInfo.aquaMarket
                        };
                    })
                );

                couriersWithPath.sort((a, b) => {
                    const distanceDiff = a.totalDistance - b.totalDistance;
                
                    // Если разница в расстоянии ≤ 300 метров
                    if (Math.abs(distanceDiff) <= 300) {
                        if (a.raiting !== b.raiting) {
                            return b.raiting - a.raiting;
                        }
                
                        return a.soldBootles.kol - b.soldBootles.kol; 
                    }
                    return distanceDiff; 
                });
                console.log("Отсортированные курьеры по кратчайшему пути:", couriersWithPath);

                if (couriersWithPath.length > 0 && couriersWithPath[0].totalDistance !== Infinity) {
                    const nearestCourier = couriersWithPath[0];
                    await pushNotification(
                        "Новый заказ",
                        `${order?.products?.b19} бутылей. Забрать из аквамаркета: ${nearestCourier.aquaMarket.address}`,
                        nearestCourier.notificationPushTokens,
                        "new Order",
                        order?._id
                    );

                    if (nearestCourier.orders.length > 0) {
                        await CourierAggregator.updateOne(
                            { _id: nearestCourier._id },
                            {
                                $push: {
                                    orders: {
                                        orderId: order._id,
                                        clientPoints: { lat: order.address.point.lat, lon: order.address.point.lon },
                                        aquaMarketPoints: { lat: nearestCourier.aquaMarket.point.lat, lon: nearestCourier.aquaMarket.point.lon },
                                        aquaMarketAddress: nearestCourier.aquaMarket.address,
                                        step: "toAquaMarket"
                                    }
                                }
                            }
                        );
                        console.log(`Курьеру ${nearestCourier.fullName} был добавлен в список заказов`);
                        break
                    }

                    await new Promise(resolve => setTimeout(resolve, 60000));
                    order = await Order.findById(orderId);

                    if (order?.status === "onTheWay") {
                        await CourierAggregator.updateOne(
                            { _id: nearestCourier._id },
                            {
                                $push: {
                                    orders: {
                                        orderId: order._id,
                                        clientPoints: { lat: order.address.point.lat, lon: order.address.point.lon },
                                        aquaMarketPoints: { lat: nearestCourier.aquaMarket.point.lat, lon: nearestCourier.aquaMarket.point.lon },
                                        aquaMarketAddress: nearestCourier.aquaMarket.address,
                                        step: "toAquaMarket"
                                    }
                                }
                            }
                        );
                        console.log(`Курьер ${nearestCourier.fullName} принял заказ`);
                        break;
                    } else {
                        rejectedCourierIds.add(nearestCourier._id.toString());
                        console.log(`Курьер ${nearestCourier.fullName} отклонил заказ`);
                    }
                } else {
                    console.log("Нет доступных путей через аквамаркеты");
                    break;
                }
            } catch (loopError) {
                console.error("Ошибка внутри цикла:", loopError);
            }
        }

        if (order?.status === "onTheWay") {
            console.log("Заказ назначен курьеру");
            return 
            // return res.status(200).json({
            //     success: true,
            //     message: "Заказ назначен курьеру",
            //     order,
            // });
        } else {
            console.log("Нет доступных курьеров или путей через аквамаркеты");
            return 
            // return res.status(404).json({
            //     success: false,
            //     message: "Нет доступных курьеров или путей через аквамаркеты",
            // });
        }
    } catch (error) {
        console.error("Ошибка при получении локаций:", error);
        throw error
        // return res.status(500).json({
        //     success: false,
        //     message: "Ошибка сервера",
        //     error: error.message,
        // });
    }
};

export default getLocationsLogic;