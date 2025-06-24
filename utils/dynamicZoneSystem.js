import Order from "../Models/Order.js";
import CourierAggregator from "../Models/CourierAggregator.js";
import { getDateAlmaty } from "./dateUtils.js";
import { pushNotification } from "../pushNotification.js";

/**
 * Вычисляет расстояние между двумя точками в метрах
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Радиус Земли в метрах
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Создает кластеры заказов на основе их плотности
 */
export async function createDynamicZones(date = null, maxDistance = 3000, minOrdersInZone = 3) {
    try {
        // Получаем заказы за сегодня или указанную дату
        const today = getDateAlmaty(date);
        console.log("today = ", today);
        const filter = {
            "date.d": today,
            status: { $nin: ["delivered", "cancelled"] },
            forAggregator: true,
            "address.point.lat": { $exists: true, $ne: null },
            "address.point.lon": { $exists: true, $ne: null }
        };

        const orders = await Order.find(filter).populate('client');
        
        if (orders.length === 0) {
            console.log("Нет заказов для создания зон");
            return [];
        }

        console.log(`Найдено ${orders.length} заказов для кластеризации`);

        // Алгоритм кластеризации по плотности (DBSCAN)
        const clusters = [];
        const visited = new Set();
        const noise = [];

        for (let i = 0; i < orders.length; i++) {
            if (visited.has(i)) continue;

            const order = orders[i];
            const neighbors = findNeighbors(orders, i, maxDistance);

            if (neighbors.length < minOrdersInZone) {
                noise.push(order);
                continue;
            }

            // Создаем новый кластер
            const cluster = {
                id: `zone_${clusters.length + 1}`,
                center: calculateClusterCenter(orders, neighbors),
                orders: [],
                radius: 0
            };

            // Добавляем заказы в кластер
            const stack = [...neighbors];
            visited.add(i);

            while (stack.length > 0) {
                const currentIdx = stack.pop();
                if (visited.has(currentIdx)) continue;

                visited.add(currentIdx);
                cluster.orders.push(orders[currentIdx]);

                const currentNeighbors = findNeighbors(orders, currentIdx, maxDistance);
                if (currentNeighbors.length >= minOrdersInZone) {
                    for (const neighborIdx of currentNeighbors) {
                        if (!visited.has(neighborIdx)) {
                            stack.push(neighborIdx);
                        }
                    }
                }
            }

            // Вычисляем радиус зоны
            cluster.radius = calculateZoneRadius(cluster.center, cluster.orders);
            clusters.push(cluster);
        }

        // Обрабатываем "шумовые" заказы - присоединяем к ближайшим зонам или создаем мини-зоны
        for (const noiseOrder of noise) {
            const nearestCluster = findNearestCluster(clusters, noiseOrder);
            if (nearestCluster && 
                calculateDistance(
                    nearestCluster.center.lat, 
                    nearestCluster.center.lon,
                    noiseOrder.address.point.lat, 
                    noiseOrder.address.point.lon
                ) <= maxDistance * 1.5) {
                nearestCluster.orders.push(noiseOrder);
                // Пересчитываем центр и радиус
                nearestCluster.center = calculateClusterCenterFromOrders(nearestCluster.orders);
                nearestCluster.radius = calculateZoneRadius(nearestCluster.center, nearestCluster.orders);
            } else {
                // Создаем отдельную мини-зону для изолированного заказа
                clusters.push({
                    id: `mini_zone_${clusters.length + 1}`,
                    center: {
                        lat: noiseOrder.address.point.lat,
                        lon: noiseOrder.address.point.lon
                    },
                    orders: [noiseOrder],
                    radius: 1000 // Минимальный радиус для одиночного заказа
                });
            }
        }

        console.log(`Создано ${clusters.length} динамических зон`);
        return clusters;

    } catch (error) {
        console.error("Ошибка при создании динамических зон:", error);
        return [];
    }
}

/**
 * Находит соседние заказы в пределах заданного расстояния
 */
function findNeighbors(orders, centerIndex, maxDistance) {
    const neighbors = [centerIndex];
    const centerOrder = orders[centerIndex];

    for (let i = 0; i < orders.length; i++) {
        if (i === centerIndex) continue;

        const distance = calculateDistance(
            centerOrder.address.point.lat,
            centerOrder.address.point.lon,
            orders[i].address.point.lat,
            orders[i].address.point.lon
        );

        if (distance <= maxDistance) {
            neighbors.push(i);
        }
    }

    return neighbors;
}

/**
 * Вычисляет центр кластера
 */
function calculateClusterCenter(orders, indices) {
    let totalLat = 0;
    let totalLon = 0;

    for (const idx of indices) {
        totalLat += orders[idx].address.point.lat;
        totalLon += orders[idx].address.point.lon;
    }

    return {
        lat: totalLat / indices.length,
        lon: totalLon / indices.length
    };
}

/**
 * Вычисляет центр кластера из массива заказов
 */
function calculateClusterCenterFromOrders(orders) {
    let totalLat = 0;
    let totalLon = 0;

    for (const order of orders) {
        totalLat += order.address.point.lat;
        totalLon += order.address.point.lon;
    }

    return {
        lat: totalLat / orders.length,
        lon: totalLon / orders.length
    };
}

/**
 * Вычисляет радиус зоны
 */
function calculateZoneRadius(center, orders) {
    let maxDistance = 0;

    for (const order of orders) {
        const distance = calculateDistance(
            center.lat,
            center.lon,
            order.address.point.lat,
            order.address.point.lon
        );
        maxDistance = Math.max(maxDistance, distance);
    }

    return Math.max(maxDistance, 1000); // Минимальный радиус 1км
}

/**
 * Находит ближайший кластер для заказа
 */
function findNearestCluster(clusters, order) {
    let nearestCluster = null;
    let minDistance = Infinity;

    for (const cluster of clusters) {
        const distance = calculateDistance(
            cluster.center.lat,
            cluster.center.lon,
            order.address.point.lat,
            order.address.point.lon
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearestCluster = cluster;
        }
    }

    return nearestCluster;
}

/**
 * Назначает курьеров зонам на основе их местоположения
 */
export async function assignCouriersToZones(zones) {
    try {
        const availableCouriers = await CourierAggregator.find({
            onTheLine: true,
            status: "active",
            "point.lat": { $exists: true, $ne: null },
            "point.lon": { $exists: true, $ne: null }
        });

        const assignments = [];

        for (const zone of zones) {
            // Находим курьеров в пределах зоны или рядом с ней
            const suitableCouriers = availableCouriers.filter(courier => {
                const distance = calculateDistance(
                    zone.center.lat,
                    zone.center.lon,
                    courier.point.lat,
                    courier.point.lon
                );
                return distance <= zone.radius + 2000; // +2км буферная зона
            });

            // Сортируем по близости к центру зоны
            suitableCouriers.sort((a, b) => {
                const distanceA = calculateDistance(
                    zone.center.lat, zone.center.lon,
                    a.point.lat, a.point.lon
                );
                const distanceB = calculateDistance(
                    zone.center.lat, zone.center.lon,
                    b.point.lat, b.point.lon
                );
                return distanceA - distanceB;
            });

            // Вычисляем количество необходимых курьеров
            const ordersCount = zone.orders.length;
            const maxOrdersPerCourier = 4;
            const requiredCouriers = Math.ceil(ordersCount / maxOrdersPerCourier);

            const assignedCouriers = suitableCouriers.slice(0, requiredCouriers);

            assignments.push({
                zone: zone,
                couriers: assignedCouriers,
                ordersPerCourier: Math.ceil(ordersCount / Math.max(assignedCouriers.length, 1))
            });
        }

        return assignments;

    } catch (error) {
        console.error("Ошибка при назначении курьеров зонам:", error);
        return [];
    }
}

/**
 * 📦 РАСПРЕДЕЛЕНИЕ ЗАКАЗОВ ПО КУРЬЕРАМ В ЗОНЕ
 * 
 * Работает как раздача писем почтальонам:
 * - Берем все заказы в зоне
 * - Равномерно распределяем между курьерами
 * - Обновляем базу данных
 * - Отправляем уведомления курьерам
 */
export async function distributeOrdersInZone(zoneAssignment) {
    try {
        const { zone, couriers, ordersPerCourier } = zoneAssignment;
        
        console.log(`\n📦 РАСПРЕДЕЛЯЕМ ЗАКАЗЫ В ЗОНЕ ${zone.id}`);
        console.log(`   Заказов: ${zone.orders.length}, Курьеров: ${couriers.length}`);
        
        if (couriers.length === 0) {
            console.log(`❌ Нет доступных курьеров для зоны ${zone.id}`);
            return false;
        }

        // ШАГ 1: Сортируем заказы по времени создания (старые первыми)
        zone.orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        console.log(`   📋 Заказы отсортированы по времени создания`);

        let courierIndex = 0; // Индекс текущего курьера
        const courierOrderCounts = new Array(couriers.length).fill(0); // Счетчик заказов для каждого курьера

        // ШАГ 2: Распределяем каждый заказ
        for (let i = 0; i < zone.orders.length; i++) {
            const order = zone.orders[i];
            const courier = couriers[courierIndex];

            console.log(`   📦 Заказ ${i + 1}/${zone.orders.length}: ${order.address.actual}`);
            console.log(`      → Курьер: ${courier.fullName}`);

            // ШАГ 3: Проверяем, нет ли уже этого заказа у курьера (защита от дублирования)
            const existingOrder = await CourierAggregator.findOne({
                _id: courier._id,
                "orders.orderId": order._id.toString()
            });

            if (existingOrder) {
                console.log(`      ⚠️ Заказ уже назначен этому курьеру, пропускаем`);
                continue;
            }

            // ШАГ 4: Назначаем заказ курьеру в базе данных
            await Order.updateOne(
                { _id: order._id },
                { 
                    $set: { 
                        courierAggregator: courier._id,
                        status: "assigned",
                        assignedAt: new Date() // Время назначения
                    }
                }
            );

            const aquaMarket = await AquaMarket.findOne({
                "point.lat": { $exists: true, $ne: null },
                "point.lon": { $exists: true, $ne: null }
            });

            // ШАГ 5: Формируем данные заказа для курьера
            const orderData = {
                orderId: order._id.toString(),
                status: order.status,
                products: order.products,
                sum: order.sum,
                opForm: order.opForm,
                comment: order.comment || "",
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
                step: "pending",
                assignedAt: new Date()
            };

            // ШАГ 6: Проверяем еще раз перед добавлением (двойная защита от дублирования)
            const courierDoc = await CourierAggregator.findById(courier._id);
            const alreadyHasOrder = courierDoc.orders.some(existingOrder => 
                existingOrder.orderId === order._id.toString()
            );

            if (!alreadyHasOrder) {
                // Добавляем заказ в массив заказов курьера
                await CourierAggregator.updateOne(
                    { _id: courier._id },
                    { $push: { orders: orderData } }
                );
                
                courierOrderCounts[courierIndex]++;
                console.log(`      ✅ Заказ успешно назначен`);

                // ШАГ 7: Отправляем уведомление курьеру о новом заказе (только для первого заказа)
                try {
                    // Проверяем есть ли у курьера токен для уведомлений
                    if (courier.notificationPushToken) {
                        // Отправляем уведомление только если это первый заказ для курьера
                        if (courierOrderCounts[courierIndex] === 1) {
                            // Формируем сообщение для курьера
                            let message = ""
                            
                            // Добавляем информацию о продуктах
                            if (order.products?.b19 > 0) {
                                message += `${order.products.b19} бутылей 19л. `;
                            }
                            if (order.products?.b12 > 0) {
                                message += `${order.products.b12} бутылей 12.5л. `;
                            }
                            
                            message += `Забрать из аквамаркета: ${aquaMarket.address}`;

                            // Отправляем уведомление
                            await pushNotification(
                                "newOrder",                              // title (как в getLocationLogic)
                                message,                                 // body с деталями заказа
                                [courier.notificationPushToken],        // массив токенов
                                "newOrder",                             // статус
                                orderData                               // данные заказа
                            );
                            
                            console.log(`      📱 Уведомление отправлено курьеру ${courier.fullName} (первый заказ)`);
                        } else {
                            console.log(`      📱 Уведомление не отправлено - это не первый заказ для курьера`);
                        }
                    } else {
                        console.log(`      ⚠️ У курьера ${courier.fullName} нет токена для уведомлений`);
                    }
                } catch (notificationError) {
                    console.log(`      ❌ Ошибка отправки уведомления: ${notificationError.message}`);
                    // Продолжаем работу даже если уведомление не отправилось
                }
            } else {
                console.log(`      ⚠️ Заказ уже есть у курьера (повторная проверка)`);
            }

            // ШАГ 8: Переходим к следующему курьеру если текущий получил достаточно заказов
            if (courierOrderCounts[courierIndex] >= ordersPerCourier) {
                courierIndex = (courierIndex + 1) % couriers.length;
            }
        }

        // Выводим статистику распределения
        console.log(`   📊 СТАТИСТИКА РАСПРЕДЕЛЕНИЯ:`);
        couriers.forEach((courier, index) => {
            console.log(`      ${courier.fullName}: ${courierOrderCounts[index]} заказов`);
        });

        console.log(`✅ Распределение в зоне ${zone.id} завершено успешно`);
        return true;

    } catch (error) {
        console.error("❌ Ошибка при распределении заказов в зоне:", error);
        return false;
    }
}

/**
 * Основная функция запуска зональной системы
 */
export async function runDynamicZoneDistribution(date = null) {
    try {
        console.log("🚀 Запуск динамической зональной системы распределения");

        // 1. Создаем зоны на основе плотности заказов
        const zones = await createDynamicZones(date);
        
        if (zones.length === 0) {
            console.log("Нет зон для распределения");
            return { success: false, message: "Нет заказов для создания зон" };
        }

        // 2. Назначаем курьеров зонам
        const assignments = await assignCouriersToZones(zones);

        // 3. Распределяем заказы внутри каждой зоны
        let totalDistributed = 0;
        let assignedCouriers = 0;
        const courierSet = new Set();
        
        for (const assignment of assignments) {
            const success = await distributeOrdersInZone(assignment);
            if (success) {
                totalDistributed += assignment.zone.orders.length;
                assignment.couriers.forEach(courier => courierSet.add(courier._id.toString()));
            }
        }
        
        assignedCouriers = courierSet.size;

        const result = {
            success: true,
            zonesCreated: zones.length,
            ordersDistributed: totalDistributed,
            processedOrders: totalDistributed, // Добавляем для совместимости с планировщиком
            assignedCouriers: assignedCouriers, // Добавляем для совместимости с планировщиком
            zones: zones.map(zone => ({
                id: zone.id,
                center: {
                    lat: parseFloat(zone.center.lat.toFixed(6)),
                    lon: parseFloat(zone.center.lon.toFixed(6))
                },
                radius: Math.round(zone.radius),
                ordersCount: zone.orders.length,
                address: `${zone.center.lat.toFixed(4)}, ${zone.center.lon.toFixed(4)}` // Добавляем читаемый адрес
            }))
        };

        console.log("✅ Зональное распределение завершено:", result);
        
        // Выводим детальную информацию о зонах
        printZoneInfo(result.zones);
        
        return result;

    } catch (error) {
        console.error("Ошибка в динамической зональной системе:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Анализирует эффективность зон
 */
export async function analyzeZoneEfficiency(date = null) {
    try {
        const today = getDateAlmaty(date);
        
        const orders = await Order.find({
            "date.d": today,
            courierAggregator: { $exists: true, $ne: null },
            forAggregator: true
        }).populate('courierAggregator');

        const zoneStats = {};

        for (const order of orders) {
            const courierId = order.courierAggregator._id.toString();
            if (!zoneStats[courierId]) {
                zoneStats[courierId] = {
                    courierName: order.courierAggregator.fullName,
                    orders: [],
                    totalDistance: 0,
                    averageDistance: 0
                };
            }
            zoneStats[courierId].orders.push(order);
        }

        // Вычисляем статистику для каждого курьера/зоны
        for (const courierId in zoneStats) {
            const stats = zoneStats[courierId];
            const orders = stats.orders;
            
            if (orders.length > 1) {
                let totalDistance = 0;
                for (let i = 0; i < orders.length - 1; i++) {
                    const distance = calculateDistance(
                        orders[i].address.point.lat,
                        orders[i].address.point.lon,
                        orders[i + 1].address.point.lat,
                        orders[i + 1].address.point.lon
                    );
                    totalDistance += distance;
                }
                stats.totalDistance = Math.round(totalDistance);
                stats.averageDistance = Math.round(totalDistance / (orders.length - 1));
            }
        }

        return zoneStats;

    } catch (error) {
        console.error("Ошибка при анализе эффективности зон:", error);
        return {};
    }
}

/**
 * Получает детальную информацию о созданных зонах
 */
export async function getZoneDetails(date = null) {
    try {
        const today = getDateAlmaty(date);
        
        console.log(`🔍 Получение деталей зон для ${today}`);
        
        // Получаем все заказы с назначенными курьерами за указанную дату
        const orders = await Order.find({
            "date.d": today,
            courierAggregator: { $exists: true, $ne: null },
            status: { $nin: ["delivered", "cancelled"] },
            forAggregator: true
        }).populate('courierAggregator client');

        if (orders.length === 0) {
            return {
                success: false,
                message: "Нет активных зон для отображения",
                zones: []
            };
        }

        // Группируем заказы по курьерам (зонам)
        const zoneMap = {};
        
        orders.forEach(order => {
            const courierId = order.courierAggregator._id.toString();
            
            if (!zoneMap[courierId]) {
                zoneMap[courierId] = {
                    id: `zone_${courierId}`,
                    courier: {
                        id: order.courierAggregator._id,
                        name: order.courierAggregator.fullName,
                        phone: order.courierAggregator.phone,
                        status: order.courierAggregator.onTheLine ? "Онлайн" : "Офлайн",
                        location: order.courierAggregator.point
                    },
                    orders: [],
                    center: { lat: 0, lon: 0 },
                    radius: 0,
                    totalDistance: 0
                };
            }
            
            zoneMap[courierId].orders.push({
                id: order._id,
                address: order.address.actual,
                coordinates: order.address.point,
                client: {
                    name: order.client?.fullName || "Не указано",
                    phone: order.client?.phone || "Не указано"
                },
                products: order.products,
                status: order.status,
                sum: order.sum,
                createdAt: order.createdAt
            });
        });

        // Вычисляем центры и радиусы зон
        const zones = Object.values(zoneMap).map(zone => {
            const orders = zone.orders;
            
            // Вычисляем центр зоны
            let centerLat = 0;
            let centerLon = 0;
            orders.forEach(order => {
                centerLat += order.coordinates.lat;
                centerLon += order.coordinates.lon;
            });
            
            zone.center = {
                lat: parseFloat((centerLat / orders.length).toFixed(6)),
                lon: parseFloat((centerLon / orders.length).toFixed(6))
            };

            // Вычисляем радиус зоны (максимальное расстояние от центра)
            let maxDistance = 0;
            orders.forEach(order => {
                const distance = calculateDistance(
                    zone.center.lat,
                    zone.center.lon,
                    order.coordinates.lat,
                    order.coordinates.lon
                );
                maxDistance = Math.max(maxDistance, distance);
            });
            
            zone.radius = Math.round(maxDistance);

            // Вычисляем общий маршрут
            let totalDistance = 0;
            for (let i = 0; i < orders.length - 1; i++) {
                const distance = calculateDistance(
                    orders[i].coordinates.lat,
                    orders[i].coordinates.lon,
                    orders[i + 1].coordinates.lat,
                    orders[i + 1].coordinates.lon
                );
                totalDistance += distance;
            }
            
            zone.totalDistance = Math.round(totalDistance);
            zone.averageDistance = orders.length > 1 ? Math.round(totalDistance / (orders.length - 1)) : 0;
            zone.ordersCount = orders.length;
            zone.centerAddress = `${zone.center.lat.toFixed(4)}, ${zone.center.lon.toFixed(4)}`;

            return zone;
        });

        // Сортируем зоны по количеству заказов
        zones.sort((a, b) => b.ordersCount - a.ordersCount);

        const summary = {
            totalZones: zones.length,
            totalOrders: orders.length,
            totalCouriers: zones.length,
            averageOrdersPerZone: Math.round(orders.length / zones.length),
            totalDistance: zones.reduce((sum, zone) => sum + zone.totalDistance, 0)
        };

        return {
            success: true,
            message: `Найдено ${zones.length} активных зон с ${orders.length} заказами`,
            date: today,
            summary,
            zones
        };

    } catch (error) {
        console.error("Ошибка при получении деталей зон:", error);
        return {
            success: false,
            message: "Ошибка при получении информации о зонах",
            error: error.message
        };
    }
}

/**
 * Выводит информацию о зонах в консоль
 */
export function printZoneInfo(zones) {
    if (!zones || zones.length === 0) {
        console.log("📍 Нет активных зон для отображения");
        return;
    }

    console.log("\n" + "=".repeat(80));
    console.log("🗺️  ИНФОРМАЦИЯ О ЗОНАХ ДОСТАВКИ");
    console.log("=".repeat(80));
    
    zones.forEach((zone, index) => {
        console.log(`\n📍 ЗОНА ${index + 1}: ${zone.id}`);
        console.log(`   Центр: ${zone.center.lat.toFixed(6)}, ${zone.center.lon.toFixed(6)}`);
        console.log(`   Адрес центра: ${zone.centerAddress || zone.address || 'Не определен'}`);
        console.log(`   Радиус: ${zone.radius}м`);
        console.log(`   Заказов: ${zone.ordersCount}`);
        
        if (zone.courier) {
            console.log(`   Курьер: ${zone.courier.name} (${zone.courier.status})`);
            console.log(`   Телефон: ${zone.courier.phone || 'Не указан'}`);
        }
        
        if (zone.totalDistance) {
            console.log(`   Общий маршрут: ${zone.totalDistance}м`);
            console.log(`   Среднее расстояние: ${zone.averageDistance}м`);
        }
        
        console.log(`   ${'─'.repeat(60)}`);
    });
    
    console.log("=".repeat(80));
    console.log(`📊 Всего зон: ${zones.length}`);
    console.log(`📦 Всего заказов: ${zones.reduce((sum, zone) => sum + zone.ordersCount, 0)}`);
    console.log(`🚚 Общий маршрут: ${zones.reduce((sum, zone) => sum + (zone.totalDistance || 0), 0)}м`);
    console.log("=".repeat(80) + "\n");
} 