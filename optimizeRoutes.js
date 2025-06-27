import mongoose from 'mongoose';
import Order from './Models/Order.js';
import CourierAggregator from './Models/CourierAggregator.js';
import AquaMarket from './Models/AquaMarket.js';
import Client from './Models/Client.js';
import { getDateAlmaty } from './utils/dateUtils.js';
import { pushNotification } from './pushNotification.js';

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
 * 🗺️ ОПТИМИЗАЦИЯ МАРШРУТА ПО ПРИНЦИПУ "БЛИЖАЙШИЙ СОСЕД"
 * Каждый следующий заказ - ближайший к текущему местоположению
 */
function optimizeCourierRoute(orders, courierName) {
    if (orders.length <= 1) return orders;

    console.log(`   🗺️ Оптимизируем маршрут для ${courierName} (${orders.length} заказов)`);

    const optimizedRoute = [];
    const remainingOrders = [...orders];
    
    // Начинаем с первого заказа (любого)
    const firstOrder = remainingOrders.shift();
    optimizedRoute.push(firstOrder);
    let currentLocation = {
        lat: firstOrder.address.point.lat,
        lon: firstOrder.address.point.lon
    };

    console.log(`      🚀 Начинаем с заказа: ${firstOrder.address.actual}`);
    console.log(`         📍 (${currentLocation.lat.toFixed(4)}, ${currentLocation.lon.toFixed(4)})`);

    // Строим маршрут по принципу "ближайший сосед"
    while (remainingOrders.length > 0) {
        let nearestIndex = 0;
        let shortestDistance = Infinity;

        // Находим ближайший заказ к текущему местоположению
        for (let i = 0; i < remainingOrders.length; i++) {
            const order = remainingOrders[i];
            const distance = calculateDistance(
                currentLocation.lat,
                currentLocation.lon,
                order.address.point.lat,
                order.address.point.lon
            );

            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestIndex = i;
            }
        }

        // Добавляем ближайший заказ в маршрут
        const selectedOrder = remainingOrders.splice(nearestIndex, 1)[0];
        optimizedRoute.push(selectedOrder);
        
        // Определяем направление движения
        const deltaLat = selectedOrder.address.point.lat - currentLocation.lat;
        const deltaLon = selectedOrder.address.point.lon - currentLocation.lon;
        
        let direction = '';
        if (Math.abs(deltaLat) > Math.abs(deltaLon)) {
            direction = deltaLat > 0 ? '⬆️ Север' : '⬇️ Юг';
        } else {
            direction = deltaLon > 0 ? '➡️ Восток' : '⬅️ Запад';
        }
        
        console.log(`      → ${optimizedRoute.length}. ${selectedOrder.address.actual}`);
        console.log(`         📍 (${selectedOrder.address.point.lat}, ${selectedOrder.address.point.lon})`);
        console.log(`         ${direction} - ${Math.round(shortestDistance)}м от предыдущей точки`);
        
        // Обновляем текущее местоположение
        currentLocation = {
            lat: selectedOrder.address.point.lat,
            lon: selectedOrder.address.point.lon
        };
    }

    // Рассчитываем общее расстояние маршрута между заказами
    let totalDistance = 0;
    
    for (let i = 1; i < optimizedRoute.length; i++) {
        const distance = calculateDistance(
            optimizedRoute[i-1].address.point.lat,
            optimizedRoute[i-1].address.point.lon,
            optimizedRoute[i].address.point.lat,
            optimizedRoute[i].address.point.lon
        );
        totalDistance += distance;
    }

    console.log(`   ✅ Маршрут оптимизирован. Общее расстояние между заказами: ${Math.round(totalDistance)}м`);
    return optimizedRoute;
}

/**
 * 🧠 ИНТЕЛЛЕКТУАЛЬНАЯ ГРУППИРОВКА ЗОН ДЛЯ КУРЬЕРОВ
 * Объединяет близкие зоны для минимизации общего расстояния
 */
function groupZonesForCouriers(zones, courierCount) {
    console.log(`\n🧠 ГРУППИРОВКА ${zones.length} ЗОН ДЛЯ ${courierCount} КУРЬЕРОВ`);
    
    if (zones.length === 0) return [];
    if (courierCount === 0) return [];
    
    // Подсчитываем общее количество заказов и целевую нагрузку на курьера
    const totalOrders = zones.reduce((sum, zone) => sum + zone.orders.length, 0);
    const targetOrdersPerCourier = Math.ceil(totalOrders / courierCount);
    const maxOrdersPerCourier = targetOrdersPerCourier + 1; // Максимум +1 заказ к целевой нагрузке
    
    console.log(`📊 Общий анализ:`);
    console.log(`   📦 Всего заказов: ${totalOrders}`);
    console.log(`   👥 Курьеров: ${courierCount}`);
    console.log(`   🎯 Целевая нагрузка на курьера: ${targetOrdersPerCourier} заказов`);
    console.log(`   ⚠️ Максимум на курьера: ${maxOrdersPerCourier} заказов`);
    
    // Разделяем зоны на приоритетные и обычные
    const priorityZones = zones.filter(zone => zone.priority === 'high');
    const normalZones = zones.filter(zone => zone.priority !== 'high');
    
    // НОВАЯ ЛОГИКА: Разбиваем большие зоны, если они превышают максимум
    const processedZones = [];
    
    for (const zone of [...priorityZones, ...normalZones]) {
        if (zone.orders.length <= maxOrdersPerCourier) {
            processedZones.push(zone);
        } else {
            // Разбиваем большую зону на меньшие части
            console.log(`⚡ Разбиваем большую зону ${zone.id} (${zone.orders.length} заказов) на части`);
            
            const ordersPerPart = Math.ceil(zone.orders.length / Math.ceil(zone.orders.length / maxOrdersPerCourier));
            let partIndex = 1;
            
            for (let i = 0; i < zone.orders.length; i += ordersPerPart) {
                const partOrders = zone.orders.slice(i, i + ordersPerPart);
                const partCenter = calculateOrdersCenterFromArray(partOrders);
                
                const newZone = {
                    id: `${zone.id}_part${partIndex}`,
                    center: partCenter,
                    orders: partOrders,
                    radius: Math.min(calculateClusterRadius(partCenter, partOrders), 2000),
                    priority: zone.priority || 'normal'
                };
                
                processedZones.push(newZone);
                console.log(`   📦 Часть ${partIndex}: ${newZone.id} (${newZone.orders.length} заказов)`);
                partIndex++;
            }
        }
    }
    
    // Сортируем обработанные зоны: сначала приоритетные, потом по количеству заказов
    processedZones.sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (b.priority === 'high' && a.priority !== 'high') return 1;
        return b.orders.length - a.orders.length;
    });
    
    console.log(`📊 Зоны для распределения после обработки:`);
    processedZones.forEach(zone => {
        const priorityIcon = zone.priority === 'high' ? '⭐' : '🏷️';
        console.log(`   ${priorityIcon} ${zone.id}: ${zone.orders.length} заказов, центр (${zone.center.lat.toFixed(4)}, ${zone.center.lon.toFixed(4)})`);
    });
    
    // Создаем группы для курьеров
    const courierGroups = Array.from({ length: courierCount }, () => ({
        zones: [],
        totalOrders: 0,
        center: null,
        totalDistance: 0,
        hasPriorityZone: false
    }));
    
    // Распределяем зоны с СТРОГИМ контролем балансировки нагрузки
    for (const zone of processedZones) {
        let bestCourierIndex = 0;
        let bestScore = Infinity;
        
        for (let i = 0; i < courierCount; i++) {
            const group = courierGroups[i];
            
            // Проверяем, не превысит ли курьер МАКСИМАЛЬНУЮ нагрузку
            const newTotalOrders = group.totalOrders + zone.orders.length;
            
            // СТРОГОЕ ОГРАНИЧЕНИЕ: не превышаем максимум
            if (newTotalOrders > maxOrdersPerCourier) {
                continue; // Пропускаем этого курьера
            }
            
            // Штраф за превышение целевой нагрузки (но в пределах максимума)
            let loadBalancePenalty = 0;
            if (newTotalOrders > targetOrdersPerCourier) {
                loadBalancePenalty = (newTotalOrders - targetOrdersPerCourier) * 5000; // Умеренный штраф
            }
            
            // Если у курьера еще нет зон, назначаем эту зону
            if (group.zones.length === 0) {
                bestCourierIndex = i;
                bestScore = loadBalancePenalty;
                if (loadBalancePenalty === 0) break; // Если нет штрафа, сразу выбираем
            } else {
                // Вычисляем оптимальность добавления зоны к курьеру
                let routeOptimality = 0;
                
                // 1. Расстояние между зонами курьера
                let totalDistance = 0;
                for (const existingZone of group.zones) {
                    const distance = calculateDistance(
                        zone.center.lat,
                        zone.center.lon,
                        existingZone.center.lat,
                        existingZone.center.lon
                    );
                    totalDistance += distance;
                }
                const avgDistance = totalDistance / group.zones.length;
                
                // 2. Компактность маршрута (штраф за разбросанность)
                const compactnessBonus = avgDistance < 3000 ? -500 : avgDistance < 5000 ? -200 : 0;
                
                // 3. Бонус для приоритетных зон
                const priorityBonus = zone.priority === 'high' ? -1000 : 0;
                
                routeOptimality = avgDistance + compactnessBonus + priorityBonus + loadBalancePenalty;
                
                if (routeOptimality < bestScore) {
                    bestScore = routeOptimality;
                    bestCourierIndex = i;
                }
            }
        }
        
        // Проверяем, что нашли подходящего курьера
        if (bestScore === Infinity) {
            console.log(`⚠️ Не удалось назначить зону ${zone.id} - все курьеры перегружены`);
            continue;
        }
        
        // Назначаем зону лучшему курьеру
        const selectedGroup = courierGroups[bestCourierIndex];
        selectedGroup.zones.push(zone);
        selectedGroup.totalOrders += zone.orders.length;
        
        // Отмечаем наличие приоритетной зоны
        if (zone.priority === 'high') {
            selectedGroup.hasPriorityZone = true;
        }
        
        // Пересчитываем центр группы
        if (selectedGroup.zones.length === 1) {
            selectedGroup.center = { ...zone.center };
        } else {
            let totalLat = 0;
            let totalLon = 0;
            for (const z of selectedGroup.zones) {
                totalLat += z.center.lat;
                totalLon += z.center.lon;
            }
            selectedGroup.center = {
                lat: totalLat / selectedGroup.zones.length,
                lon: totalLon / selectedGroup.zones.length
            };
        }
        
        const priorityMark = zone.priority === 'high' ? ' ⭐' : '';
        console.log(`👤 Курьер ${bestCourierIndex + 1}: добавлена зона ${zone.id}${priorityMark} (оптимальность ${Math.round(bestScore)}, всего заказов: ${selectedGroup.totalOrders})`);
    }
    
    // Вычисляем общее расстояние для каждого курьера
    for (let i = 0; i < courierGroups.length; i++) {
        const group = courierGroups[i];
        if (group.zones.length > 1) {
            // Вычисляем расстояние между зонами курьера
            let totalDistance = 0;
            for (let j = 0; j < group.zones.length - 1; j++) {
                const distance = calculateDistance(
                    group.zones[j].center.lat,
                    group.zones[j].center.lon,
                    group.zones[j + 1].center.lat,
                    group.zones[j + 1].center.lon
                );
                totalDistance += distance;
            }
            group.totalDistance = totalDistance;
        }
    }
    
    console.log(`\n📊 ИТОГОВОЕ РАСПРЕДЕЛЕНИЕ ЗОН:`);
    courierGroups.forEach((group, index) => {
        if (group.zones.length > 0) {
            const zoneNames = group.zones.map(z => z.id).join(' + ');
            const priorityMark = group.hasPriorityZone ? ' ⭐' : '';
            const balanceStatus = group.totalOrders <= targetOrdersPerCourier ? '✅' : group.totalOrders <= maxOrdersPerCourier ? '⚠️' : '❌';
            console.log(`👤 Курьер ${index + 1}: ${zoneNames}${priorityMark} (${group.totalOrders} заказов ${balanceStatus}, ${Math.round(group.totalDistance)}м между зонами)`);
        }
    });
    
    return courierGroups.filter(group => group.zones.length > 0);
}

/**
 * 🔄 ПОСТ-ОПТИМИЗАЦИЯ МАРШРУТОВ ПУТЕМ ОБМЕНА ЗАКАЗАМИ
 * Проверяет возможность улучшения общих маршрутов путем обмена заказами между курьерами
 */
async function optimizeRoutesBySwapping(couriers) {
    console.log("🔍 Анализируем возможности улучшения маршрутов...");
    
    let improvements = 0;
    
    // Получаем актуальные данные курьеров
    const courierDocs = await Promise.all(
        couriers.map(c => CourierAggregator.findById(c._id))
    );
    
    // Анализируем каждую пару курьеров
    for (let i = 0; i < courierDocs.length; i++) {
        for (let j = i + 1; j < courierDocs.length; j++) {
            const courier1 = courierDocs[i];
            const courier2 = courierDocs[j];
            
            if (courier1.orders.length === 0 || courier2.orders.length === 0) continue;
            
            // Проверяем все возможные обмены заказами
            for (let order1Idx = 0; order1Idx < courier1.orders.length; order1Idx++) {
                for (let order2Idx = 0; order2Idx < courier2.orders.length; order2Idx++) {
                    const order1 = courier1.orders[order1Idx];
                    const order2 = courier2.orders[order2Idx];
                    
                    // Вычисляем текущие расстояния
                    const current1Distance = calculateCourierTotalDistance(courier1.orders);
                    const current2Distance = calculateCourierTotalDistance(courier2.orders);
                    const currentTotal = current1Distance + current2Distance;
                    
                    // Создаем копии с обменянными заказами
                    const newOrders1 = [...courier1.orders];
                    const newOrders2 = [...courier2.orders];
                    
                    newOrders1[order1Idx] = order2;
                    newOrders2[order2Idx] = order1;
                    
                    // Вычисляем новые расстояния
                    const new1Distance = calculateCourierTotalDistance(newOrders1);
                    const new2Distance = calculateCourierTotalDistance(newOrders2);
                    const newTotal = new1Distance + new2Distance;
                    
                    // Если обмен улучшает общее расстояние
                    if (newTotal < currentTotal - 500) { // минимум 500м улучшения
                        console.log(`🔄 УЛУЧШЕНИЕ НАЙДЕНО:`);
                        console.log(`   📦 Обмениваем "${order1.clientAddress}" ↔ "${order2.clientAddress}"`);
                        console.log(`   📊 Экономия: ${Math.round(currentTotal - newTotal)}м`);
                        console.log(`   🚗 ${courier1.fullName}: ${Math.round(current1Distance)}м → ${Math.round(new1Distance)}м`);
                        console.log(`   🚗 ${courier2.fullName}: ${Math.round(current2Distance)}м → ${Math.round(new2Distance)}м`);
                        
                        // Выполняем обмен в базе данных
                        try {
                            // Обновляем назначение заказов в коллекции Order
                            await Order.updateOne(
                                { _id: order1.orderId },
                                { $set: { courierAggregator: courier2._id } }
                            );
                            
                            await Order.updateOne(
                                { _id: order2.orderId },
                                { $set: { courierAggregator: courier1._id } }
                            );
                            
                            // Обновляем заказы у курьеров
                            await CourierAggregator.updateOne(
                                { _id: courier1._id },
                                { $set: { orders: newOrders1 } }
                            );
                            
                            await CourierAggregator.updateOne(
                                { _id: courier2._id },
                                { $set: { orders: newOrders2 } }
                            );
                            
                            // Обновляем локальные копии
                            courier1.orders = newOrders1;
                            courier2.orders = newOrders2;
                            
                            improvements++;
                            console.log(`   ✅ Обмен выполнен успешно`);
                            
                            // Прерываем циклы для этой пары курьеров
                            break;
                            
                        } catch (error) {
                            console.log(`   ❌ Ошибка обмена: ${error.message}`);
                        }
                    }
                }
                if (improvements > 0) break; // Один обмен за раз
            }
            if (improvements > 0) break; // Один обмен за раз
        }
        if (improvements > 0) break; // Один обмен за раз
    }
    
    if (improvements > 0) {
        console.log(`✅ Выполнено ${improvements} улучшений маршрутов`);
        // Рекурсивно проверяем дальнейшие улучшения
        if (improvements < 3) { // Ограничиваем глубину рекурсии
            await optimizeRoutesBySwapping(couriers);
        }
    } else {
        console.log(`✅ Маршруты оптимальны, улучшений не найдено`);
    }
}

/**
 * 📏 ВЫЧИСЛЕНИЕ ОБЩЕГО РАССТОЯНИЯ МАРШРУТА КУРЬЕРА
 */
function calculateCourierTotalDistance(orders) {
    if (orders.length <= 1) return 0;
    
    let totalDistance = 0;
    
    // Считаем расстояния только между заказами
    for (let i = 1; i < orders.length; i++) {
        const prevOrder = orders[i-1];
        const currentOrder = orders[i];
        
        if (prevOrder.clientPoints && prevOrder.clientPoints.lat && prevOrder.clientPoints.lon &&
            currentOrder.clientPoints && currentOrder.clientPoints.lat && currentOrder.clientPoints.lon) {
            const distance = calculateDistance(
                prevOrder.clientPoints.lat,
                prevOrder.clientPoints.lon,
                currentOrder.clientPoints.lat,
                currentOrder.clientPoints.lon
            );
            totalDistance += distance;
        }
    }
    
    return totalDistance;
}

/**
 * 🗺️ ЗОНАЛЬНОЕ РАСПРЕДЕЛЕНИЕ С ГРУППИРОВКОЙ
 * Создает зоны, группирует их по близости и назначает курьерам
 */
export async function zoneBasedDistribution(date = null) {
    try {
        const today = getDateAlmaty(date);
        console.log(`🚀 ЗОНАЛЬНОЕ РАСПРЕДЕЛЕНИЕ ЗАКАЗОВ НА ${today}`);
        console.log("=".repeat(60));

        // 1. Получаем только новые неназначенные заказы (исключаем уже начатые)
        const orders = await Order.find({
            "date.d": today,
            forAggregator: true,
            status: { $nin: ["onTheWay", "delivered", "cancelled"] }, // Исключаем начатые, доставленные и отмененные
            $or: [
                { courierAggregator: { $exists: false } },
                { courierAggregator: null },
                { courierAggregator: undefined }
            ],
            "address.point.lat": { $exists: true, $ne: null },
            "address.point.lon": { $exists: true, $ne: null }
        }).populate('client');

        console.log(`🔍 Поиск заказов для распределения:`);
        console.log(`   ✅ Статус: исключаем "onTheWay", "delivered", "cancelled"`);
        console.log(`   ✅ Курьер: не назначен`);
        console.log(`   ✅ Координаты: присутствуют`);

        if (orders.length === 0) {
            console.log("❌ Нет новых заказов для распределения");
            return { success: false, message: "Нет новых заказов для распределения" };
        }

        // 2. Получаем всех доступных курьеров
        const couriers = await CourierAggregator.find({
            onTheLine: true,
            status: "active"
        });

        if (couriers.length === 0) {
            console.log("❌ Нет доступных курьеров!");
            return { success: false, message: "Нет доступных курьеров" };
        }

        console.log(`📦 Найдено заказов: ${orders.length}`);
        console.log(`👥 Доступно курьеров: ${couriers.length}`);

        // 3. Получаем координаты аквамаркета
        const aquaMarket = await AquaMarket.findOne({
            "point.lat": { $exists: true, $ne: null },
            "point.lon": { $exists: true, $ne: null }
        });

        if (!aquaMarket) {
            console.log("❌ Не найден аквамаркет!");
            return { success: false, message: "Не найден аквамаркет" };
        }

        const aquaMarketLocation = { lat: aquaMarket.point.lat, lon: aquaMarket.point.lon };
        console.log(`🏪 Аквамаркет: ${aquaMarket.address}`);

        // 4. СОЗДАЕМ ЗОНЫ НА ОСНОВЕ ПЛОТНОСТИ ЗАКАЗОВ
        const zones = await createSmartZones(orders);
        
        if (zones.length === 0) {
            console.log("❌ Не удалось создать зоны!");
            return { success: false, message: "Не удалось создать зоны" };
        }

        // 5. ГРУППИРУЕМ ЗОНЫ ДЛЯ КУРЬЕРОВ
        const courierGroups = groupZonesForCouriers(zones, couriers.length);

        // 6. НАЗНАЧАЕМ ЗАКАЗЫ КУРЬЕРАМ ПО ГРУППАМ ЗОН
        let totalDistributed = 0;
        console.log(`\n👥 НАЗНАЧЕНИЕ ЗАКАЗОВ КУРЬЕРАМ:`);

        for (let groupIndex = 0; groupIndex < courierGroups.length && groupIndex < couriers.length; groupIndex++) {
            const courier = couriers[groupIndex];
            const group = courierGroups[groupIndex];
            
            console.log(`\n👤 КУРЬЕР: ${courier.fullName}`);
            console.log(`   🏷️ Зоны: ${group.zones.map(z => z.id).join(', ')}`);
            console.log(`   📦 Всего заказов: ${group.totalOrders}`);

            // Собираем все заказы из всех зон курьера
            const allCourierOrders = [];
            for (const zone of group.zones) {
                allCourierOrders.push(...zone.orders);
            }

            // Оптимизируем маршрут для всех заказов курьера
            const optimizedOrders = optimizeCourierRoute(allCourierOrders, courier.fullName);

            // Назначаем оптимизированные заказы курьеру
            for (let orderIndex = 0; orderIndex < optimizedOrders.length; orderIndex++) {
                const order = optimizedOrders[orderIndex];

                try {
                    // Назначаем заказ курьеру в базе данных
                    await Order.updateOne(
                        { _id: order._id },
                        { 
                            $set: { 
                                courierAggregator: courier._id,
                                status: "assigned",
                                assignedAt: new Date()
                            }
                        }
                    );

                    // Формируем данные заказа для курьера
                    const orderData = {
                        orderId: order._id.toString(),
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
                        assignedAt: new Date()
                    };

                    // Добавляем заказ в массив заказов курьера
                    await CourierAggregator.updateOne(
                        { _id: courier._id },
                        { $push: { orders: orderData } }
                    );
                    
                    totalDistributed++;

                    console.log(`      ✅ Заказ назначен курьеру`);

                } catch (error) {
                    console.log(`      ❌ Ошибка назначения: ${error.message}`);
                }
            }
        }

        // 7. ПОСТ-ОПТИМИЗАЦИЯ: УЛУЧШЕНИЕ МАРШРУТОВ ПУТЕМ ОБМЕНА ЗАКАЗАМИ
        console.log(`\n🔄 ПОСТ-ОПТИМИЗАЦИЯ МАРШРУТОВ`);
        await optimizeRoutesBySwapping(couriers);

        // 8. ПРОВЕРЯЕМ И НАЗНАЧАЕМ ОСТАВШИЕСЯ НЕНАЗНАЧЕННЫЕ ЗАКАЗЫ
        const remainingOrders = await Order.find({
            "date.d": today,
            forAggregator: true,
            status: { $nin: ["onTheWay", "delivered", "cancelled"] }, // Исключаем начатые, доставленные и отмененные
            $or: [
                { courierAggregator: { $exists: false } },
                { courierAggregator: null },
                { courierAggregator: undefined }
            ],
            "address.point.lat": { $exists: true, $ne: null },
            "address.point.lon": { $exists: true, $ne: null }
        });

        if (remainingOrders.length > 0) {
            console.log(`\n⚠️ НАЙДЕНО ${remainingOrders.length} НЕНАЗНАЧЕННЫХ ЗАКАЗОВ`);
            console.log("🔧 НАЗНАЧАЕМ ОСТАВШИЕСЯ ЗАКАЗЫ С КОНТРОЛЕМ НАГРУЗКИ:");

            // Вычисляем максимальную нагрузку на курьера
            const totalOrdersWithRemaining = orders.length;
            const targetOrdersPerCourier = Math.ceil(totalOrdersWithRemaining / couriers.length);
            const maxOrdersPerCourier = targetOrdersPerCourier + 1;
            
            console.log(`   📊 Максимум заказов на курьера: ${maxOrdersPerCourier}`);

            for (const order of remainingOrders) {
                let bestCourier = null;
                let shortestDistance = Infinity;
                let bestScore = Infinity;

                console.log(`   📦 Ищем курьера для "${order.address.actual}"`);
                console.log(`      📍 Координаты: (${order.address.point.lat.toFixed(4)}, ${order.address.point.lon.toFixed(4)})`);

                // Анализируем всех курьеров с учетом нагрузки
                const courierAnalysis = [];
                
                for (const courier of couriers) {
                    const courierDoc = await CourierAggregator.findById(courier._id);
                    
                    // СТРОГИЙ КОНТРОЛЬ: пропускаем перегруженных курьеров
                    if (courierDoc.orders.length >= maxOrdersPerCourier) {
                        console.log(`      🚫 ${courier.fullName}: перегружен (${courierDoc.orders.length}/${maxOrdersPerCourier} заказов)`);
                        continue;
                    }

                    let avgDistance = Infinity;
                    
                    if (courierDoc.orders.length > 0) {
                        // Вычисляем среднее расстояние до заказов курьера
                        let totalDistance = 0;
                        let validOrders = 0;

                        for (const courierOrder of courierDoc.orders) {
                            if (courierOrder.clientPoints && courierOrder.clientPoints.lat && courierOrder.clientPoints.lon) {
                                const distance = calculateDistance(
                                    order.address.point.lat,
                                    order.address.point.lon,
                                    courierOrder.clientPoints.lat,
                                    courierOrder.clientPoints.lon
                                );
                                totalDistance += distance;
                                validOrders++;
                            }
                        }

                        if (validOrders > 0) {
                            avgDistance = totalDistance / validOrders;
                        }
                    } else {
                        // Если у курьера нет заказов, считаем расстояние от центра города
                        avgDistance = calculateDistance(
                            43.2220, 76.8512, // координаты центра Алматы
                            order.address.point.lat,
                            order.address.point.lon
                        );
                    }

                    // Штраф за нагрузку (предпочитаем менее загруженных курьеров)
                    const loadPenalty = courierDoc.orders.length * 2000; // 2км штрафа за каждый заказ
                    
                    // Общий рейтинг курьера
                    const score = avgDistance + loadPenalty;
                    
                    courierAnalysis.push({
                        courier: courier,
                        ordersCount: courierDoc.orders.length,
                        avgDistance: avgDistance,
                        loadPenalty: loadPenalty,
                        score: score
                    });

                    console.log(`      🚗 ${courier.fullName}: ${Math.round(avgDistance)}м, нагрузка ${courierDoc.orders.length}, рейтинг ${Math.round(score)}`);
                }

                // Сортируем курьеров по рейтингу (лучший - с наименьшим рейтингом)
                courierAnalysis.sort((a, b) => a.score - b.score);

                if (courierAnalysis.length > 0) {
                    const best = courierAnalysis[0];
                    bestCourier = best.courier;
                    shortestDistance = best.avgDistance;
                    
                    console.log(`      ✅ Лучший выбор → ${bestCourier.fullName}`);
                    console.log(`         📊 Расстояние: ${Math.round(shortestDistance)}м, нагрузка: ${best.ordersCount}→${best.ordersCount + 1}`);
                } else {
                    console.log(`      ❌ Все курьеры перегружены! Заказ останется неназначенным.`);
                    continue;
                }

                try {
                    // Назначаем заказ курьеру в базе данных
                    await Order.updateOne(
                        { _id: order._id },
                        { 
                            $set: { 
                                courierAggregator: bestCourier._id,
                                status: "assigned",
                                assignedAt: new Date()
                            }
                        }
                    );

                    // Формируем данные заказа для курьера
                    const orderData = {
                        orderId: order._id.toString(),
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
                        assignedAt: new Date()
                    };

                    // Добавляем заказ в массив заказов курьера
                    await CourierAggregator.updateOne(
                        { _id: bestCourier._id },
                        { $push: { orders: orderData } }
                    );
                    
                    totalDistributed++;

                    console.log(`      ✅ Заказ успешно назначен`);

                } catch (error) {
                    console.log(`      ❌ Ошибка назначения: ${error.message}`);
                }
            }
        }

        // 9. Итоговая статистика
        console.log("\n" + "=".repeat(60));
        console.log("🎉 ЗОНАЛЬНОЕ РАСПРЕДЕЛЕНИЕ ЗАВЕРШЕНО!");
        console.log("=".repeat(60));
        console.log(`📦 Всего заказов: ${orders.length}`);
        console.log(`✅ Распределено: ${totalDistributed}`);
        console.log(`🏷️ Создано зон: ${zones.length}`);
        console.log(`👥 Задействовано курьеров: ${courierGroups.length}`);
        
        if (totalDistributed < orders.length) {
            console.log(`⚠️ Нераспределенных: ${orders.length - totalDistributed}`);
        }

        return {
            success: true,
            totalOrders: orders.length,
            distributedOrders: totalDistributed,
            zonesCreated: zones.length,
            couriersUsed: courierGroups.length,
            zones: zones.map(zone => ({
                id: zone.id,
                center: zone.center,
                ordersCount: zone.orders.length,
                radius: zone.radius
            }))
        };

    } catch (error) {
        console.error("❌ Ошибка при зональном распределении:", error);
        return { success: false, error: error.message };
    }
}

/**
 * 🏗️ СОЗДАНИЕ УМНЫХ ЗОН НА ОСНОВЕ ПЛОТНОСТИ
 */
async function createSmartZones(orders, maxDistance = 2000, minOrdersInZone = 2) {
    console.log(`\n🏗️ СОЗДАНИЕ ЗОНАЛЬНОЙ СИСТЕМЫ`);
    console.log(`📊 Параметры: макс. расстояние ${maxDistance}м, мин. заказов в зоне ${minOrdersInZone}`);
    
    // Сортируем заказы по координатам для стабильного распределения
    const sortedOrders = [...orders].sort((a, b) => {
        // Сортируем сначала по широте, потом по долготе
        if (a.address.point.lat !== b.address.point.lat) {
            return a.address.point.lat - b.address.point.lat;
        }
        return a.address.point.lon - b.address.point.lon;
    });
    
    console.log(`📍 Заказы отсортированы по координатам:`);
    sortedOrders.forEach((order, index) => {
        console.log(`   ${index + 1}. ${order.address.actual} - (${order.address.point.lat.toFixed(4)}, ${order.address.point.lon.toFixed(4)})`);
    });
    
    const clusters = [];
    const visited = new Set();
    const noise = [];

    // Основная кластеризация
    for (let i = 0; i < sortedOrders.length; i++) {
        if (visited.has(i)) continue;

        const order = sortedOrders[i];
        const neighbors = findOrderNeighbors(sortedOrders, i, maxDistance);

        if (neighbors.length < minOrdersInZone) {
            noise.push({ order, index: i });
            continue;
        }

        // Создаем новый кластер
        const cluster = {
            id: `zone_${clusters.length + 1}`,
            center: calculateOrdersCenter(sortedOrders, neighbors),
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
            cluster.orders.push(sortedOrders[currentIdx]);

            const currentNeighbors = findOrderNeighbors(sortedOrders, currentIdx, maxDistance);
            if (currentNeighbors.length >= minOrdersInZone) {
                for (const neighborIdx of currentNeighbors) {
                    if (!visited.has(neighborIdx)) {
                        stack.push(neighborIdx);
                    }
                }
            }
        }

        cluster.radius = Math.min(calculateClusterRadius(cluster.center, cluster.orders), maxDistance);
        clusters.push(cluster);
    }

    // Обработка одиночных заказов
    const processedNoise = new Set();
    
    for (let i = 0; i < noise.length; i++) {
        if (processedNoise.has(i)) continue;
        
        const noiseOrder = noise[i].order;
        const nearbyNoise = [];
        
        for (let j = i + 1; j < noise.length; j++) {
            if (processedNoise.has(j)) continue;
            
            const distance = calculateDistance(
                noiseOrder.address.point.lat,
                noiseOrder.address.point.lon,
                noise[j].order.address.point.lat,
                noise[j].order.address.point.lon
            );
            
            if (distance <= maxDistance * 1.2) {
                nearbyNoise.push(noise[j]);
                processedNoise.add(j);
            }
        }
        
        processedNoise.add(i);
        
        // Создаем отдельные зоны для заказов
        
        if (nearbyNoise.length > 0) {
            const miniZoneOrders = [noiseOrder, ...nearbyNoise.map(n => n.order)];
            const miniCenter = calculateOrdersCenterFromArray(miniZoneOrders);
            
            clusters.push({
                id: `zone_${clusters.length + 1}`,
                center: miniCenter,
                orders: miniZoneOrders,
                radius: Math.min(calculateClusterRadius(miniCenter, miniZoneOrders), maxDistance),
                priority: 'normal' // Все зоны имеют стандартный приоритет
            });
        } else {
            clusters.push({
                id: `single_zone_${clusters.length + 1}`,
                center: {
                    lat: noiseOrder.address.point.lat,
                    lon: noiseOrder.address.point.lon
                },
                orders: [noiseOrder],
                radius: 800,
                priority: 'normal' // Все зоны имеют стандартный приоритет
            });
        }
    }

    // Сортируем зоны по количеству заказов (без приоритетов)
    clusters.sort((a, b) => {
        return b.orders.length - a.orders.length;
    });

    console.log(`✅ Создано ${clusters.length} зон:`);
    clusters.forEach(zone => {
        console.log(`   🏷️ ${zone.id}: ${zone.orders.length} заказов, радиус ${Math.round(zone.radius)}м`);
    });
    
    return clusters;
}

// Вспомогательные функции для зональной системы
function findOrderNeighbors(orders, centerIndex, maxDistance) {
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

function calculateOrdersCenter(orders, indices) {
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

function calculateOrdersCenterFromArray(orders) {
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

function calculateClusterRadius(center, orders) {
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

    return Math.max(maxDistance, 1000);
}

// Подключаемся к MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/crm');

// Сначала сбрасываем старые назначения только для новых заказов
console.log("🔄 Сброс старых назначений...");

const today = getDateAlmaty();

// Сбрасываем назначения только для новых заказов (не начатых курьерами)
const resetResult = await Order.updateMany(
    { 
        "date.d": today,
        forAggregator: true,
        status: { $nin: ["onTheWay", "delivered", "cancelled"] } // Исключаем начатые, доставленные и отмененные
    },
    { 
        $unset: { courierAggregator: "" }
    }
);

console.log(`📊 Сброшено назначений: ${resetResult.modifiedCount} заказов`);

// Очищаем только новые заказы у курьеров (не трогаем уже начатые)
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

// Запускаем умное распределение
zoneBasedDistribution().then(result => {
    console.log("\n📊 РЕЗУЛЬТАТ:", result);
    mongoose.disconnect();
}).catch(error => {
    console.error("Ошибка:", error);
    mongoose.disconnect();
}); 