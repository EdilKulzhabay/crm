import mongoose from 'mongoose';
import Order from '../Models/Order.js';
import CourierAggregator from '../Models/CourierAggregator.js';
import AquaMarket from '../Models/AquaMarket.js';
import Client from '../Models/Client.js';
import { getDateAlmaty } from '../utils/dateUtils.js';
import { pushNotification } from '../pushNotification.js';

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
    
    // Определяем структуру координат (поддерживаем оба формата)
    let currentLocation;
    if (firstOrder.address && firstOrder.address.point) {
        // Формат из базы Order
        currentLocation = {
            lat: firstOrder.address.point.lat,
            lon: firstOrder.address.point.lon
        };
        console.log(`      🚀 Начинаем с заказа: ${firstOrder.address.actual}`);
    } else if (firstOrder.clientPoints) {
        // Формат из CourierAggregator
        currentLocation = {
            lat: firstOrder.clientPoints.lat,
            lon: firstOrder.clientPoints.lon
        };
        console.log(`      🚀 Начинаем с заказа: ${firstOrder.clientAddress || firstOrder.clientTitle}`);
    } else {
        console.log(`      ❌ Не найдены координаты для первого заказа`);
        return orders; // Возвращаем исходный порядок
    }

    console.log(`         📍 (${currentLocation.lat.toFixed(4)}, ${currentLocation.lon.toFixed(4)})`);

    // Строим маршрут по принципу "ближайший сосед"
    while (remainingOrders.length > 0) {
        let nearestIndex = 0;
        let shortestDistance = Infinity;

        // Находим ближайший заказ к текущему местоположению
        for (let i = 0; i < remainingOrders.length; i++) {
            const order = remainingOrders[i];
            let orderLat, orderLon;
            
            // Определяем координаты заказа (поддерживаем оба формата)
            if (order.address && order.address.point) {
                orderLat = order.address.point.lat;
                orderLon = order.address.point.lon;
            } else if (order.clientPoints) {
                orderLat = order.clientPoints.lat;
                orderLon = order.clientPoints.lon;
            } else {
                continue; // Пропускаем заказы без координат
            }

            const distance = calculateDistance(
                currentLocation.lat,
                currentLocation.lon,
                orderLat,
                orderLon
            );

            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestIndex = i;
            }
        }

        // Добавляем ближайший заказ в маршрут
        const selectedOrder = remainingOrders.splice(nearestIndex, 1)[0];
        optimizedRoute.push(selectedOrder);
        
        // Определяем новое местоположение
        let newLat, newLon, orderName;
        if (selectedOrder.address && selectedOrder.address.point) {
            newLat = selectedOrder.address.point.lat;
            newLon = selectedOrder.address.point.lon;
            orderName = selectedOrder.address.actual;
        } else if (selectedOrder.clientPoints) {
            newLat = selectedOrder.clientPoints.lat;
            newLon = selectedOrder.clientPoints.lon;
            orderName = selectedOrder.clientAddress || selectedOrder.clientTitle;
        }
        
        // Определяем направление движения
        const deltaLat = newLat - currentLocation.lat;
        const deltaLon = newLon - currentLocation.lon;
        
        let direction = '';
        if (Math.abs(deltaLat) > Math.abs(deltaLon)) {
            direction = deltaLat > 0 ? '⬆️ Север' : '⬇️ Юг';
        } else {
            direction = deltaLon > 0 ? '➡️ Восток' : '⬅️ Запад';
        }
        
        console.log(`      → ${optimizedRoute.length}. ${orderName}`);
        console.log(`         📍 (${newLat}, ${newLon})`);
        console.log(`         ${direction} - ${Math.round(shortestDistance)}м от предыдущей точки`);
        
        // Обновляем текущее местоположение
        currentLocation = {
            lat: newLat,
            lon: newLon
        };
    }

    // Рассчитываем общее расстояние маршрута между заказами
    let totalDistance = 0;
    
    for (let i = 1; i < optimizedRoute.length; i++) {
        let prevLat, prevLon, currLat, currLon;
        
        // Координаты предыдущего заказа
        if (optimizedRoute[i-1].address && optimizedRoute[i-1].address.point) {
            prevLat = optimizedRoute[i-1].address.point.lat;
            prevLon = optimizedRoute[i-1].address.point.lon;
        } else if (optimizedRoute[i-1].clientPoints) {
            prevLat = optimizedRoute[i-1].clientPoints.lat;
            prevLon = optimizedRoute[i-1].clientPoints.lon;
        }
        
        // Координаты текущего заказа
        if (optimizedRoute[i].address && optimizedRoute[i].address.point) {
            currLat = optimizedRoute[i].address.point.lat;
            currLon = optimizedRoute[i].address.point.lon;
        } else if (optimizedRoute[i].clientPoints) {
            currLat = optimizedRoute[i].clientPoints.lat;
            currLon = optimizedRoute[i].clientPoints.lon;
        }
        
        if (prevLat && prevLon && currLat && currLon) {
            const distance = calculateDistance(prevLat, prevLon, currLat, currLon);
            totalDistance += distance;
        }
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
    const maxOrdersPerCourier = targetOrdersPerCourier + 3 // Строже ограничение
    
    console.log(`📊 Общий анализ:`);
    console.log(`   📦 Всего заказов: ${totalOrders}`);
    console.log(`   👥 Курьеров: ${courierCount}`);
    console.log(`   🎯 Целевая нагрузка на курьера: ${targetOrdersPerCourier} заказов`);
    console.log(`   ⚠️ Максимум на курьера: ${maxOrdersPerCourier} заказов`);
    
    // Разделяем зоны по приоритетам
    const highPriorityZones = zones.filter(zone => zone.priority === 'high');
    const mediumPriorityZones = zones.filter(zone => zone.priority === 'medium');
    const lowPriorityZones = zones.filter(zone => zone.priority === 'low');
    
    console.log(`📊 Зоны по приоритетам: ⭐${highPriorityZones.length} / 🔶${mediumPriorityZones.length} / 🏷️${lowPriorityZones.length}`);
    
    // Создаем группы для курьеров
    const courierGroups = Array.from({ length: courierCount }, () => ({
        zones: [],
        totalOrders: 0,
        center: null,
        totalDistance: 0,
        maxDistanceBetweenZones: 0,
        hasPriorityZone: false
    }));
    
    // Функция для вычисления оценки совместимости зоны с группой курьера
    function calculateZoneCompatibilityScore(zone, courierGroup) {
        const newTotalOrders = courierGroup.totalOrders + zone.orders.length;
        
        // ЖЕСТКИЙ лимит по заказам
        if (newTotalOrders > maxOrdersPerCourier) {
            return Infinity; // Недопустимо
        }
        
        let score = 0;
        
        if (courierGroup.zones.length === 0) {
            // Первая зона для курьера - минимальный штраф за превышение целевой нагрузки
            score = newTotalOrders > targetOrdersPerCourier ? 
                (newTotalOrders - targetOrdersPerCourier) * 500 : 0;
        } else {
            // Вычисляем расстояния до всех существующих зон
            let minDistance = Infinity;
            let maxDistance = 0;
            let totalDistance = 0;
            
            for (const existingZone of courierGroup.zones) {
                const distance = calculateDistance(
                    zone.center.lat,
                    zone.center.lon,
                    existingZone.center.lat,
                    existingZone.center.lon
                );
                minDistance = Math.min(minDistance, distance);
                maxDistance = Math.max(maxDistance, distance);
                totalDistance += distance;
            }
            
            const avgDistance = totalDistance / courierGroup.zones.length;
            
            // ОЧЕНЬ СТРОГИЕ штрафы за большие расстояния
            let distancePenalty = minDistance; // Используем минимальное расстояние как базу
            
            // Экспоненциальные штрафы за большие расстояния
            if (minDistance > 3000) distancePenalty *= 5;   // 3км - пятикратный штраф
            if (minDistance > 5000) distancePenalty *= 10;  // 5км - десятикратный штраф
            if (minDistance > 8000) distancePenalty *= 20;  // 8км - двадцатикратный штраф
            
            // Дополнительный штраф если максимальное расстояние между любыми зонами > 6км
            if (maxDistance > 6000) {
                distancePenalty += (maxDistance - 6000) * 3;
            }
            
            // Штраф за перегрузку (более мягкий, чем раньше)
            const loadPenalty = newTotalOrders > targetOrdersPerCourier ? 
                (newTotalOrders - targetOrdersPerCourier) * 1000 : 0;
            
            // Бонус за недозагрузку курьера (стимулируем равномерность)
            const underloadBonus = courierGroup.totalOrders < targetOrdersPerCourier ? 
                (targetOrdersPerCourier - courierGroup.totalOrders) * -300 : 0;
            
            score = distancePenalty + loadPenalty + underloadBonus;
        }
        
        return score;
    }
    
    // Объединяем все зоны для распределения с учетом приоритета
    const allZones = [
        ...highPriorityZones.map(z => ({...z, priorityWeight: 3})),
        ...mediumPriorityZones.map(z => ({...z, priorityWeight: 2})),
        ...lowPriorityZones.map(z => ({...z, priorityWeight: 1}))
    ];
    
    // ЭТАП 1: Распределяем зоны с учетом приоритета и совместимости
    for (const zone of allZones) {
        let bestCourierIndex = -1;
        let bestScore = Infinity;
        
        // Анализируем всех курьеров
        for (let i = 0; i < courierCount; i++) {
            const score = calculateZoneCompatibilityScore(zone, courierGroups[i]);
            
            if (score < bestScore) {
                bestScore = score;
                bestCourierIndex = i;
            }
        }
        
        if (bestCourierIndex === -1 || bestScore === Infinity) {
            console.log(`⚠️ Не удалось назначить зону ${zone.id} - все курьеры перегружены или слишком далеко`);
            continue;
        }
        
        const selectedGroup = courierGroups[bestCourierIndex];
        selectedGroup.zones.push(zone);
        selectedGroup.totalOrders += zone.orders.length;
        
        if (zone.priority === 'high') {
            selectedGroup.hasPriorityZone = true;
        }
        
        // Обновляем центр группы
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
        
        const priorityIcon = zone.priority === 'high' ? '⭐' : zone.priority === 'medium' ? '🔶' : '🏷️';
        console.log(`👤 Курьер ${bestCourierIndex + 1}: добавлена ${priorityIcon}зона ${zone.id} (оценка ${Math.round(bestScore)}, всего заказов: ${selectedGroup.totalOrders})`);
    }
    
    // ЭТАП 2: Пост-обработка - пытаемся перераспределить для лучшей балансировки
    console.log(`\n🔄 ПОСТ-ОБРАБОТКА: Балансировка нагрузки между курьерами`);
    
    let improved = true;
    let iterations = 0;
    const maxIterations = 5;
    
    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;
        
        console.log(`   Итерация ${iterations}:`);
        
        // Ищем возможности для улучшения
        for (let i = 0; i < courierGroups.length; i++) {
            for (let j = i + 1; j < courierGroups.length; j++) {
                const group1 = courierGroups[i];
                const group2 = courierGroups[j];
                
                if (group1.zones.length === 0 || group2.zones.length === 0) continue;
                
                // Пытаемся переместить зоны для лучшей балансировки
                for (let zoneIdx = 0; zoneIdx < group1.zones.length; zoneIdx++) {
                    const zone = group1.zones[zoneIdx];
                    
                    // Вычисляем текущие оценки
                    const currentScore1 = calculateGroupEfficiency(group1);
                    const currentScore2 = calculateGroupEfficiency(group2);
                    const currentTotal = currentScore1 + currentScore2;
                    
                    // Проверяем, что будет если переместить зону
                    if (group2.totalOrders + zone.orders.length <= maxOrdersPerCourier) {
                        // Создаем временные копии
                        const tempGroup1 = {
                            ...group1,
                            zones: group1.zones.filter((_, idx) => idx !== zoneIdx),
                            totalOrders: group1.totalOrders - zone.orders.length
                        };
                        
                        const tempGroup2 = {
                            ...group2,
                            zones: [...group2.zones, zone],
                            totalOrders: group2.totalOrders + zone.orders.length
                        };
                        
                        const newScore1 = calculateGroupEfficiency(tempGroup1);
                        const newScore2 = calculateGroupEfficiency(tempGroup2);
                        const newTotal = newScore1 + newScore2;
                        
                        // Если улучшение значительное (минимум 1000 единиц)
                        if (newTotal < currentTotal - 1000) {
                            console.log(`     🔄 Перемещаем зону ${zone.id} от курьера ${i+1} к курьеру ${j+1}`);
                            console.log(`        Улучшение: ${Math.round(currentTotal - newTotal)} единиц`);
                            
                            // Применяем изменения
                            group1.zones.splice(zoneIdx, 1);
                            group1.totalOrders -= zone.orders.length;
                            group2.zones.push(zone);
                            group2.totalOrders += zone.orders.length;
                            
                            // Обновляем центры групп
                            updateGroupCenter(group1);
                            updateGroupCenter(group2);
                            
                            improved = true;
                            break;
                        }
                    }
                }
                if (improved) break;
            }
            if (improved) break;
        }
        
        if (!improved) {
            console.log(`     ✅ Дальнейших улучшений не найдено`);
        }
    }
    
    // Вычисляем статистику для каждого курьера
    for (let i = 0; i < courierGroups.length; i++) {
        const group = courierGroups[i];
        if (group.zones.length > 1) {
            let totalDistance = 0;
            let maxDistance = 0;
            
            for (let j = 0; j < group.zones.length - 1; j++) {
                for (let k = j + 1; k < group.zones.length; k++) {
                    const distance = calculateDistance(
                        group.zones[j].center.lat,
                        group.zones[j].center.lon,
                        group.zones[k].center.lat,
                        group.zones[k].center.lon
                    );
                    totalDistance += distance;
                    maxDistance = Math.max(maxDistance, distance);
                }
            }
            
            group.totalDistance = totalDistance;
            group.maxDistanceBetweenZones = maxDistance;
        }
    }
    
    console.log(`\n📊 ИТОГОВОЕ РАСПРЕДЕЛЕНИЕ ЗОН:`);
    courierGroups.forEach((group, index) => {
        if (group.zones.length > 0) {
            const zoneNames = group.zones.map(z => {
                const priorityIcon = z.priority === 'high' ? '⭐' : z.priority === 'medium' ? '🔶' : '🏷️';
                return `${priorityIcon}${z.id}`;
            }).join(' + ');
            
            const balanceStatus = group.totalOrders <= targetOrdersPerCourier ? '✅' : 
                                group.totalOrders <= maxOrdersPerCourier ? '⚠️' : '❌';
            
            const distanceStatus = group.maxDistanceBetweenZones > 8000 ? '🔴' : 
                                 group.maxDistanceBetweenZones > 5000 ? '🟡' : '🟢';
            
            console.log(`👤 Курьер ${index + 1}: ${zoneNames} (${group.totalOrders} заказов ${balanceStatus}, макс.расстояние ${Math.round(group.maxDistanceBetweenZones)}м ${distanceStatus})`);
        }
    });
    
    return courierGroups.filter(group => group.zones.length > 0);
}

// Вспомогательные функции для улучшенной группировки
function calculateGroupEfficiency(group) {
    if (group.zones.length === 0) return 0;
    if (group.zones.length === 1) return group.totalOrders * 100; // Базовая оценка для одной зоны
    
    let totalDistance = 0;
    let maxDistance = 0;
    
    // Вычисляем все расстояния между зонами в группе
    for (let i = 0; i < group.zones.length - 1; i++) {
        for (let j = i + 1; j < group.zones.length; j++) {
            const distance = calculateDistance(
                group.zones[i].center.lat,
                group.zones[i].center.lon,
                group.zones[j].center.lat,
                group.zones[j].center.lon
            );
            totalDistance += distance;
            maxDistance = Math.max(maxDistance, distance);
        }
    }
    
    // Штрафы за большие расстояния и неоптимальную нагрузку
    let penalty = totalDistance;
    if (maxDistance > 5000) penalty += (maxDistance - 5000) * 2;
    if (maxDistance > 8000) penalty += (maxDistance - 8000) * 5;
    
    // Штраф за неравномерную нагрузку
    const targetLoad = 4; // Примерная целевая нагрузка
    if (group.totalOrders > targetLoad) {
        penalty += (group.totalOrders - targetLoad) * 1000;
    }
    
    return penalty;
}

function updateGroupCenter(group) {
    if (group.zones.length === 0) {
        group.center = null;
        return;
    }
    
    if (group.zones.length === 1) {
        group.center = { ...group.zones[0].center };
        return;
    }
    
    let totalLat = 0;
    let totalLon = 0;
    for (const zone of group.zones) {
        totalLat += zone.center.lat;
        totalLon += zone.center.lon;
    }
    
    group.center = {
        lat: totalLat / group.zones.length,
        lon: totalLon / group.zones.length
    };
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
        }).populate('client');

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
    const remainingOrders = [];

    // ЭТАП 1: Создаем крупные зоны (минимум 3 заказа)
    for (let i = 0; i < sortedOrders.length; i++) {
        if (visited.has(i)) continue;

        const order = sortedOrders[i];
        const neighbors = findOrderNeighbors(sortedOrders, i, maxDistance);

        if (neighbors.length >= 3) { // Увеличенный минимум для крупных зон
            // Создаем новый кластер
            const cluster = {
                id: `zone_${clusters.length + 1}`,
                center: calculateOrdersCenter(sortedOrders, neighbors),
                orders: [],
                radius: 0,
                priority: 'high' // Крупные зоны имеют высокий приоритет
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
                if (currentNeighbors.length >= 2) { // Более мягкое требование для расширения
                    for (const neighborIdx of currentNeighbors) {
                        if (!visited.has(neighborIdx)) {
                            stack.push(neighborIdx);
                        }
                    }
                }
            }

            cluster.radius = Math.min(calculateClusterRadius(cluster.center, cluster.orders), maxDistance);
            clusters.push(cluster);
            console.log(`🏷️ Создана крупная зона ${cluster.id}: ${cluster.orders.length} заказов`);
        }
    }

    // ЭТАП 2: Собираем оставшиеся (не назначенные) заказы
    for (let i = 0; i < sortedOrders.length; i++) {
        if (!visited.has(i)) {
            remainingOrders.push({ order: sortedOrders[i], index: i });
        }
    }

    console.log(`📦 Оставшихся заказов для группировки: ${remainingOrders.length}`);

    // ЭТАП 3: Создаем средние зоны из оставшихся заказов (минимум 2 заказа)
    const processedRemaining = new Set();
    
    for (let i = 0; i < remainingOrders.length; i++) {
        if (processedRemaining.has(i)) continue;
        
        const baseOrder = remainingOrders[i].order;
        const closeOrders = [baseOrder];
        const usedIndices = [i];
        
        // Ищем близкие заказы
        for (let j = i + 1; j < remainingOrders.length; j++) {
            if (processedRemaining.has(j)) continue;
            
            const distance = calculateDistance(
                baseOrder.address.point.lat,
                baseOrder.address.point.lon,
                remainingOrders[j].order.address.point.lat,
                remainingOrders[j].order.address.point.lon
            );
            
            if (distance <= maxDistance * 1.5) { // Увеличенный радиус для группировки оставшихся
                closeOrders.push(remainingOrders[j].order);
                usedIndices.push(j);
            }
        }
        
        // Отмечаем использованные заказы
        for (const idx of usedIndices) {
            processedRemaining.add(idx);
        }
        
        if (closeOrders.length >= 2) {
            // Создаем среднюю зону
            const mediumCenter = calculateOrdersCenterFromArray(closeOrders);
            
            clusters.push({
                id: `zone_${clusters.length + 1}`,
                center: mediumCenter,
                orders: closeOrders,
                radius: Math.min(calculateClusterRadius(mediumCenter, closeOrders), maxDistance),
                priority: 'medium'
            });
            console.log(`🏷️ Создана средняя зона zone_${clusters.length}: ${closeOrders.length} заказов`);
        } else {
            // Одиночный заказ - создаем маленькую зону
            clusters.push({
                id: `single_zone_${clusters.length + 1}`,
                center: {
                    lat: baseOrder.address.point.lat,
                    lon: baseOrder.address.point.lon
                },
                orders: [baseOrder],
                radius: 1000, // Увеличенный радиус для одиночных зон
                priority: 'low'
            });
            console.log(`🏷️ Создана одиночная зона single_zone_${clusters.length}: 1 заказ`);
        }
    }

    // Сортируем зоны по приоритету, затем по количеству заказов
    clusters.sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        const aPriority = priorityOrder[a.priority] || 1;
        const bPriority = priorityOrder[b.priority] || 1;
        
        if (aPriority !== bPriority) {
            return bPriority - aPriority;
        }
        return b.orders.length - a.orders.length;
    });

    console.log(`✅ Создано ${clusters.length} зон:`);
    clusters.forEach(zone => {
        const priorityIcon = zone.priority === 'high' ? '⭐' : zone.priority === 'medium' ? '🔶' : '🏷️';
        console.log(`   ${priorityIcon} ${zone.id}: ${zone.orders.length} заказов, радиус ${Math.round(zone.radius)}м`);
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