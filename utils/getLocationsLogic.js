// import CourierAggregator from "../Models/CourierAggregator.js";
// import Order from "../Models/Order.js";
// import AquaMarket from "../Models/AquaMarket.js";
// import { pushNotification } from "../pushNotification.js";

// function calculateHypotenuseDistance(lat1, lon1, lat2, lon2) {
//     const deltaLat = lat2 - lat1;
//     const deltaLon = lon2 - lon1;
//     const distance = Math.sqrt(Math.pow(deltaLat, 2) + Math.pow(deltaLon, 2));
//     return distance;
// }

// // Функция для генерации всех перестановок массива (нужна для полного перебора)
// function permute(arr) {
//     const result = [];
//     if (arr.length === 0) return [];
//     if (arr.length === 1) return [arr];

//     for (let i = 0; i < arr.length; i++) {
//         const current = arr[i];
//         const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
//         const perms = permute(remaining);
//         for (const perm of perms) {
//             result.push([current].concat(perm));
//         }
//     }
//     return result;
// }

// // Функция для расчета полного пути через все точки
// function calculatePathDistance(points) {
//     let totalDistance = 0;
//     for (let i = 0; i < points.length - 1; i++) {
//         totalDistance += calculateHypotenuseDistance(
//             points[i].lat,
//             points[i].lon,
//             points[i + 1].lat,
//             points[i + 1].lon
//         );
//     }
//     return totalDistance;
// }

// // Функция для поиска кратчайшего пути
// async function findShortestPath(courier, order, aquaMarkets) {
//     const startPoint = { lat: courier.point.lat, lon: courier.point.lon, type: "courier" };
//     const endPoint = { lat: order.address.point.lat, lon: order.address.point.lon, type: "client" };

//     // Точки из текущих заказов курьера
//     const orderPoints = courier.orders.map(o => [
//         { lat: o.aquaMarketPoints.lat, lon: o.aquaMarketPoints.lon, type: "aquaMarket", orderId: o.orderId },
//         { lat: o.clientPoints.lat, lon: o.clientPoints.lon, type: "client", orderId: o.orderId }
//     ]).flat();

//     // Точки аквамаркетов с dispensedBottlesKol <= 50 и достаточным количеством бутылок
//     const validAquaMarkets = aquaMarkets
//         .filter(m => m.dispensedBottlesKol <= 50 && m.full.b191 >= order.products.b19)
//         .map(m => ({ lat: m.point.lat, lon: m.point.lon, type: "aquaMarket", id: m._id, address: m.address || "Unknown" }));

//     if (validAquaMarkets.length === 0) return null;

//     // Все точки, которые нужно рассмотреть (кроме начальной и конечной)
//     const intermediatePoints = [...orderPoints, ...validAquaMarkets];

//     // Генерируем все возможные перестановки промежуточных точек
//     const permutations = permute(intermediatePoints);

//     let shortestPath = null;
//     let minDistance = Infinity;
//     let selectedAquaMarket = null;

//     for (const perm of permutations) {
//         // Путь: старт -> все промежуточные точки -> конечная точка
//         const fullPath = [startPoint, ...perm, endPoint];
//         const distance = calculatePathDistance(fullPath);

//         // Проверяем, что в пути есть хотя бы один аквамаркет для нового заказа
//         const hasAquaMarket = perm.some(point => point.type === "aquaMarket" && !point.orderId);
//         if (hasAquaMarket && distance < minDistance) {
//             minDistance = distance;
//             shortestPath = fullPath;
//             selectedAquaMarket = perm.find(point => point.type === "aquaMarket" && !point.orderId);
//         }
//     }

//     return { path: shortestPath, distance: minDistance, aquaMarket: selectedAquaMarket };
// }

// export const getLocationsLogic = async (req, res) => {
//     try {
//         const { orderId } = req.body;
//         if (!orderId) {
//             return res.status(400).json({
//                 success: false,
//                 message: "orderId обязателен",
//             });
//         }

//         let order = await Order.findById(orderId);
//         if (!order) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Заказ не найден",
//             });
//         }

//         const couriers = await CourierAggregator.find({ onTheLine: true });
//         if (couriers.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Нет активных курьеров для отправки уведомлений",
//             });
//         }

//         const tokens = couriers.flatMap(item => item.notificationPushTokens || []);
//         if (tokens.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Нет токенов для отправки уведомлений",
//             });
//         }

//         const aquaMarkets = await AquaMarket.find();
//         const rejectedCourierIds = new Set();

//         while (order?.status !== "onTheWay") {
//             try {
//                 await pushNotification("location", "location", tokens, "location");
//                 await new Promise(resolve => setTimeout(resolve, 60000));

//                 const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
//                 const updatedCouriers = await CourierAggregator.find({
//                     "point.timestamp": { $gte: twoMinutesAgo },
//                     _id: { $nin: Array.from(rejectedCourierIds) }
//                 });

//                 if (updatedCouriers.length === 0) {
//                     console.log("Нет доступных курьеров с актуальными координатами");
//                     break;
//                 }

//                 // Находим кратчайший путь для каждого курьера
//                 const couriersWithPath = await Promise.all(
//                     updatedCouriers.map(async courier => {
//                         const courierLat = courier.point.lat;
//                         const courierLon = courier.point.lon;

//                         if (!courierLat || !courierLon) {
//                             return { ...courier.toObject(), totalDistance: Infinity };
//                         }

//                         const pathInfo = await findShortestPath(courier, order, aquaMarkets);
//                         if (!pathInfo) {
//                             return { ...courier.toObject(), totalDistance: Infinity };
//                         }

//                         return {
//                             ...courier.toObject(),
//                             totalDistance: pathInfo.distance,
//                             path: pathInfo.path,
//                             aquaMarket: pathInfo.aquaMarket
//                         };
//                     })
//                 );

//                 couriersWithPath.sort((a, b) => a.totalDistance - b.totalDistance);
//                 console.log("Отсортированные курьеры по кратчайшему пути:", couriersWithPath);

//                 if (couriersWithPath.length > 0 && couriersWithPath[0].totalDistance !== Infinity) {
//                     const nearestCourier = couriersWithPath[0];
//                     await pushNotification(
//                         "Новый заказ",
//                         `${order?.products?.b19} бутылей. Забрать из аквамаркета: ${nearestCourier.aquaMarket.address}`,
//                         nearestCourier.notificationPushTokens,
//                         "new Order"
//                     );

//                     await new Promise(resolve => setTimeout(resolve, 60000));
//                     order = await Order.findById(orderId);

//                     if (order?.status === "onTheWay") {
//                         await CourierAggregator.updateOne(
//                             { _id: nearestCourier._id },
//                             {
//                                 $push: {
//                                     orders: {
//                                         orderId: order._id,
//                                         clientPoints: { lat: order.address.point.lat, lon: order.address.point.lon },
//                                         aquaMarketPoints: { lat: nearestCourier.aquaMarket.lat, lon: nearestCourier.aquaMarket.lon },
//                                         aquaMarketAddress: nearestCourier.aquaMarket.address,
//                                         step: "toAquaMarket"
//                                     }
//                                 }
//                             }
//                         );
//                         console.log(`Курьер ${nearestCourier.fullName} принял заказ`);
//                         break;
//                     } else {
//                         rejectedCourierIds.add(nearestCourier._id.toString());
//                         console.log(`Курьер ${nearestCourier.fullName} отклонил заказ`);
//                     }
//                 } else {
//                     console.log("Нет доступных путей через аквамаркеты");
//                     break;
//                 }
//             } catch (loopError) {
//                 console.error("Ошибка внутри цикла:", loopError);
//             }
//         }

//         if (order?.status === "onTheWay") {
//             return res.status(200).json({
//                 success: true,
//                 message: "Заказ назначен курьеру",
//                 order,
//             });
//         } else {
//             return res.status(404).json({
//                 success: false,
//                 message: "Нет доступных курьеров или путей через аквамаркеты",
//             });
//         }
//     } catch (error) {
//         console.error("Ошибка при получении локаций:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Ошибка сервера",
//             error: error.message,
//         });
//     }
// };