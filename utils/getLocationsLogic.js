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

async function getLocationsLogic(orderId) {
    try {
        console.log("Начало обработки заказа:", orderId);
        
        if (!orderId) {
            console.error("Ошибка: orderId обязателен");
            return;
        }

        // Проверка и получение заказа
        let order = await Order.findById(orderId).populate("client", "fullName phone");
        if (!order) {
            console.error("Ошибка: Заказ не найден, orderId:", orderId);
            return;
        }
        console.log("Заказ найден:", order);

        // Проверка и получение активных курьеров
        const tenMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const couriers = await CourierAggregator.find({ onTheLine: true, "point.timestamp": { $lte: tenMinutesAgo }, });
        if (couriers.length > 0) {
            const tokens = couriers
            .filter(courier => courier.notificationPushToken)
            .map(courier => courier.notificationPushToken);
        
            if (tokens.length === 0) {
                console.error("Ошибка: Нет валидных токенов для уведомлений");
                return;
            }
            console.log("Найдено валидных токенов:", tokens.length);

            const rejectedCourierIds = new Set();

            try {
                await pushNotification("getLocation", "getLocation", tokens, "getLocation");
                console.log("Уведомление о местоположении отправлено");
            } catch (pushErr) {
                console.error("Ошибка при отправке уведомления о местоположении:", pushErr);
            }

            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        // Проверка токенов уведомлений
        

        while (order?.status !== "onTheWay") {
            try {

                // Получение актуальных координат курьеров
                const twoMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                const updatedCouriers = await CourierAggregator.find({
                    onTheLine: true,
                    "point.timestamp": { $gte: twoMinutesAgo },
                    _id: { $nin: Array.from(rejectedCourierIds) }
                });

                if (updatedCouriers.length === 0) {
                    console.error("Ошибка: Нет курьеров с актуальными координатами");
                    break;
                }
                console.log("Курьеры с актуальными координатами:", updatedCouriers.length);

                // Обновление статистики продаж
                // for (const courier of updatedCouriers) {
                //     if (courier.soldBootles && courier.soldBootles.date) {
                //         const today = new Date();
                //         const soldDate = new Date(courier.soldBootles.date);
                //         today.setHours(0, 0, 0, 0);
                //         soldDate.setHours(0, 0, 0, 0);

                //         if (soldDate.getTime() !== today.getTime()) {
                //             courier.soldBootles.kol = 0;
                //             courier.soldBootles.date = today;
                //             await courier.save();
                //             console.log(`Обновлена статистика для курьера ${courier.fullName}`);
                //         }
                //     }
                // }

                // Поиск оптимального курьера
                const couriersWithPath = await Promise.all(
                    updatedCouriers.map(async courier => {
                        if (!courier.point?.lat || !courier.point?.lon) {
                            console.error(`Отсутствуют координаты у курьера ${courier.fullName}`);
                            return { ...courier.toObject(), totalDistance: Infinity };
                        }

                        const pathInfo = await findShortestPath(courier, order);
                        if (!pathInfo) {
                            console.error(`Не найден путь для курьера ${courier.fullName}`);
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

                // Сортировка курьеров
                couriersWithPath.sort((a, b) => {
                    const distanceDiff = a.totalDistance - b.totalDistance;
                    if (Math.abs(distanceDiff) <= 300) {
                        if (a.raiting !== b.raiting) {
                            return b.raiting - a.raiting;
                        }
                        return a.soldBootles.kol - b.soldBootles.kol;
                    }
                    return distanceDiff;
                });

                if (couriersWithPath.length > 0 && couriersWithPath[0].totalDistance !== Infinity) {
                    const nearestCourier = couriersWithPath[0];
                    console.log("Выбран ближайший курьер:", nearestCourier.fullName);

                    if (nearestCourier.orders.length === 0) {

                        const sendOrder = {
                            orderId: order._id,
                            status: order.status,
                            products: order.products,
                            sum: order.sum,
                            opForm: order.opForm,
                            comment: order.comment,
                            clientReview: order.clientReview,
                            clientTitle: order.client.fullName,
                            clientPhone: order.client.phone,
                            date: order.date,
                            clientPoints: { lat: order.address.point.lat, lon: order.address.point.lon },
                            clientAddress: order.address.actual,
                            clientAddressLink: order.address.link,
                            aquaMarketPoints: { lat: nearestCourier.aquaMarket.point.lat, lon: nearestCourier.aquaMarket.point.lon },
                            aquaMarketAddress: nearestCourier.aquaMarket.address,
                            aquaMarketAddressLink: nearestCourier.aquaMarket.link,
                            step: "toAquaMarket",
                            income: order.sum
                        }

                        // Отправка уведомления курьеру
                        try {
                            await pushNotification(
                                "newOrder",
                                `${order?.products?.b19} бутылей. Забрать из аквамаркета: ${nearestCourier.aquaMarket.address}`,
                                [nearestCourier.notificationPushToken],
                                "newOrder",
                                sendOrder
                            );
                            console.log("Уведомление о новом заказе отправлено курьеру");
                        } catch (error) {
                            console.error("Ошибка при отправке уведомления о заказе:", error);
                        }
                    }

                    // Обновление списка заказов курьера
                    if (nearestCourier.orders.length > 0) {
                        try {
                            // Сначала удаляем заказ у всех курьеров
                            await CourierAggregator.updateMany(
                                { "orders.orderId": order._id },
                                { $pull: { orders: { orderId: order._id } } }
                            );

                            // Затем добавляем заказ новому курьеру
                            await CourierAggregator.updateOne(
                                { _id: nearestCourier._id },
                                {
                                    $push: {
                                        orders: {
                                            orderId: order._id,
                                            status: order.status,
                                            products: order.products,
                                            sum: order.sum,
                                            opForm: order.opForm,
                                            comment: order.comment,
                                            clientReview: order.clientReview,
                                            clientTitle: order.client.fullName,
                                            clientPhone: order.client.phone,
                                            date: order.date,
                                            clientPoints: { lat: order.address.point.lat, lon: order.address.point.lon },
                                            clientAddress: order.address.actual,
                                            clientAddressLink: order.address.link,
                                            aquaMarketPoints: { lat: nearestCourier.aquaMarket.point.lat, lon: nearestCourier.aquaMarket.point.lon },
                                            aquaMarketAddress: nearestCourier.aquaMarket.address,
                                            aquaMarketAddressLink: nearestCourier.aquaMarket.link,
                                            step: "toAquaMarket",
                                            income: order.sum
                                        }
                                    }
                                }
                            );

                            await Order.updateOne({_id: order._id}, {$set: {courierAggregator: nearestCourier._id}})
                            console.log("Список заказов курьера обновлен");
                        } catch (error) {
                            console.error("Ошибка при обновлении списка заказов:", error);
                        }
                        break;
                    }

                    await new Promise(resolve => setTimeout(resolve, 20000));
                    order = await Order.findById(orderId);

                    if (order?.status === "onTheWay" && order?.courierAggregator !== null) {
                        await Order.updateOne({_id: order._id}, {$set: {courierAggregator: nearestCourier._id}})
                        console.log("Заказ успешно назначен курьеру");
                        break;
                    }

                    if (order?.courierAggregator !== null) {
                        console.log("Заказ успешно назначен курьеру");
                        break;
                    } else {
                        rejectedCourierIds.add(nearestCourier._id.toString());
                        console.log("Курьер отклонил заказ:", nearestCourier.fullName);
                    }
                } else {
                    console.error("Ошибка: Нет доступных путей через аквамаркеты");
                    break;
                }
            } catch (loopError) {
                console.error("Ошибка в цикле распределения заказа:", loopError);
            }
        }

        if (order?.status === "onTheWay" || order?.courierAggregator !== null) {
            console.log("Заказ успешно распределен");
            return;
        } else {
            console.error("Ошибка: Не удалось распределить заказ");
            return;
        }
    } catch (error) {
        console.error("Критическая ошибка при распределении заказа:", error);
        throw error;
    }
}

export default getLocationsLogic;