import mongoose from 'mongoose';
import Order from '../Models/Order.js';
import CourierAggregator from '../Models/CourierAggregator.js';
import AquaMarket from '../Models/AquaMarket.js';
import Client from '../Models/Client.js';
import { getDateAlmaty } from '../utils/dateUtils.js';
import { pushNotification } from '../pushNotification.js';

/**
 * 📏 ВЫЧИСЛЕНИЕ РАССТОЯНИЯ МЕЖДУ ДВУМЯ ТОЧКАМИ В МЕТРАХ
 * Использует формулу гаверсинуса для точного расчета
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
 * 🗺️ СОЗДАНИЕ МАТРИЦЫ РАССТОЯНИЙ
 * Предварительно вычисляет все расстояния между точками
 */
function createDistanceMatrix(locations) {
    const matrix = [];
    for (let i = 0; i < locations.length; i++) {
        matrix[i] = [];
        for (let j = 0; j < locations.length; j++) {
            if (i === j) {
                matrix[i][j] = 0;
            } else {
                matrix[i][j] = calculateDistance(
                    locations[i].lat,
                    locations[i].lon,
                    locations[j].lat,
                    locations[j].lon
                );
            }
        }
    }
    return matrix;
}

/**
 * 🧬 ГЕНЕТИЧЕСКИЙ АЛГОРИТМ ДЛЯ TSP
 * Более эффективное решение задачи коммивояжера
 */
function solveTSPGenetic(distanceMatrix, populationSize = 50, generations = 100) {
    const n = distanceMatrix.length;
    if (n <= 2) return Array.from({length: n}, (_, i) => i);

    console.log(`   🧬 Запуск генетического алгоритма: ${n} точек, ${populationSize} особей, ${generations} поколений`);

    // Создание начальной популяции
    function createRandomRoute() {
        const route = Array.from({length: n - 1}, (_, i) => i + 1);
        // Перемешиваем все точки кроме первой (начальная точка)
        for (let i = route.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [route[i], route[j]] = [route[j], route[i]];
        }
        return [0, ...route]; // Всегда начинаем с точки 0
    }

    // Вычисление фитнес-функции (обратная величина общего расстояния)
    function calculateFitness(route) {
        let totalDistance = 0;
        for (let i = 0; i < route.length - 1; i++) {
            totalDistance += distanceMatrix[route[i]][route[i + 1]];
        }
        return 1 / (totalDistance + 1); // +1 чтобы избежать деления на 0
    }

    // Турнирная селекция
    function tournamentSelection(population, fitnesses, tournamentSize = 3) {
        let best = Math.floor(Math.random() * population.length);
        let bestFitness = fitnesses[best];
        
        for (let i = 1; i < tournamentSize; i++) {
            const candidate = Math.floor(Math.random() * population.length);
            if (fitnesses[candidate] > bestFitness) {
                best = candidate;
                bestFitness = fitnesses[candidate];
            }
        }
        return [...population[best]];
    }

    // Скрещивание (Order Crossover - OX)
    function orderCrossover(parent1, parent2) {
        const start = Math.floor(Math.random() * (n - 2)) + 1;
        const end = Math.floor(Math.random() * (n - start - 1)) + start + 1;
        
        const child = new Array(n);
        child[0] = 0; // Фиксированная начальная точка
        
        // Копируем сегмент от parent1
        for (let i = start; i < end; i++) {
            child[i] = parent1[i];
        }
        
        // Заполняем оставшиеся позиции из parent2
        const used = new Set(child.slice(start, end));
        let childIndex = 1;
        
        for (let i = 1; i < n; i++) {
            if (childIndex === start) childIndex = end;
            if (childIndex >= n) break;
            
            if (!used.has(parent2[i])) {
                child[childIndex] = parent2[i];
                childIndex++;
            }
        }
        
        return child;
    }

    // Мутация (swap mutation)
    function mutate(route, mutationRate = 0.02) {
        const mutated = [...route];
        for (let i = 1; i < mutated.length; i++) { // Пропускаем первую точку
            if (Math.random() < mutationRate) {
                const j = Math.floor(Math.random() * (mutated.length - 1)) + 1;
                [mutated[i], mutated[j]] = [mutated[j], mutated[i]];
            }
        }
        return mutated;
    }

    // Создаем начальную популяцию
    let population = [];
    for (let i = 0; i < populationSize; i++) {
        population.push(createRandomRoute());
    }

    let bestRoute = null;
    let bestDistance = Infinity;

    // Эволюционный процесс
    for (let generation = 0; generation < generations; generation++) {
        // Вычисляем фитнес для всей популяции
        const fitnesses = population.map(calculateFitness);
        
        // Находим лучшую особь в текущем поколении
        const maxFitnessIndex = fitnesses.indexOf(Math.max(...fitnesses));
        const currentBest = population[maxFitnessIndex];
        const currentBestDistance = 1 / fitnesses[maxFitnessIndex] - 1;
        
        if (currentBestDistance < bestDistance) {
            bestDistance = currentBestDistance;
            bestRoute = [...currentBest];
        }

        // Создаем новое поколение
        const newPopulation = [];
        
        // Элитизм - сохраняем лучшую особь
        newPopulation.push([...bestRoute]);
        
        // Генерируем остальную популяцию
        while (newPopulation.length < populationSize) {
            const parent1 = tournamentSelection(population, fitnesses);
            const parent2 = tournamentSelection(population, fitnesses);
            const child = orderCrossover(parent1, parent2);
            const mutatedChild = mutate(child);
            newPopulation.push(mutatedChild);
        }
        
        population = newPopulation;
        
        if (generation % 20 === 0) {
            console.log(`      Поколение ${generation}: лучшее расстояние ${Math.round(bestDistance)}м`);
        }
    }

    console.log(`   ✅ Генетический алгоритм завершен. Итоговое расстояние: ${Math.round(bestDistance)}м`);
    return bestRoute;
}

/**
 * 🔄 2-OPT ЛОКАЛЬНАЯ ОПТИМИЗАЦИЯ
 * Улучшает существующий маршрут методом 2-opt
 */
function improve2Opt(route, distanceMatrix, maxIterations = 100) {
    let improved = true;
    let currentRoute = [...route];
    let iterations = 0;
    
    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;
        
        for (let i = 1; i < currentRoute.length - 2; i++) {
            for (let j = i + 1; j < currentRoute.length - 1; j++) {
                // Вычисляем текущее расстояние
                const currentDistance = 
                    distanceMatrix[currentRoute[i-1]][currentRoute[i]] +
                    distanceMatrix[currentRoute[j]][currentRoute[j+1]];
                
                // Вычисляем расстояние после 2-opt обмена
                const newDistance = 
                    distanceMatrix[currentRoute[i-1]][currentRoute[j]] +
                    distanceMatrix[currentRoute[i]][currentRoute[j+1]];
                
                if (newDistance < currentDistance) {
                    // Выполняем 2-opt обмен (разворачиваем сегмент)
                    const newRoute = [
                        ...currentRoute.slice(0, i),
                        ...currentRoute.slice(i, j + 1).reverse(),
                        ...currentRoute.slice(j + 1)
                    ];
                    currentRoute = newRoute;
                    improved = true;
                }
            }
        }
    }
    
    return currentRoute;
}

/**
 * 🚀 УЛУЧШЕННАЯ ОПТИМИЗАЦИЯ МАРШРУТА С TSP
 * Использует генетический алгоритм + 2-opt оптимизацию
 */
function optimizeCourierRouteTSP(orders, courierName) {
    if (orders.length <= 1) return orders;
    if (orders.length === 2) return orders; // Для 2 заказов оптимизация не нужна

    console.log(`   🚀 TSP оптимизация маршрута для ${courierName} (${orders.length} заказов)`);

    // Извлекаем координаты заказов
    const locations = orders.map(order => {
        if (order.address && order.address.point) {
            return {
                lat: order.address.point.lat,
                lon: order.address.point.lon
            };
        } else if (order.clientPoints) {
            return {
                lat: order.clientPoints.lat,
                lon: order.clientPoints.lon
            };
        }
        return null;
    }).filter(loc => loc !== null);

    if (locations.length !== orders.length) {
        console.log(`   ⚠️ Не все заказы имеют координаты, используем простую оптимизацию`);
        return optimizeCourierRouteSimple(orders, courierName);
    }

    // Создаем матрицу расстояний
    const distanceMatrix = createDistanceMatrix(locations);

    // Решаем TSP генетическим алгоритмом
    let optimalRoute;
    if (orders.length <= 10) {
        // Для маленьких маршрутов используем более интенсивную оптимизацию
        optimalRoute = solveTSPGenetic(distanceMatrix, 100, 200);
    } else {
        // Для больших маршрутов используем более быструю оптимизацию
        optimalRoute = solveTSPGenetic(distanceMatrix, 50, 100);
    }

    // Дополнительная 2-opt оптимизация
    optimalRoute = improve2Opt(optimalRoute, distanceMatrix);

    // Применяем найденный порядок к заказам
    const optimizedOrders = optimalRoute.map(index => orders[index]);

    // Вычисляем итоговое расстояние
    let totalDistance = 0;
    for (let i = 0; i < optimalRoute.length - 1; i++) {
        totalDistance += distanceMatrix[optimalRoute[i]][optimalRoute[i + 1]];
    }

    console.log(`   ✅ TSP маршрут оптимизирован. Общее расстояние: ${Math.round(totalDistance)}м`);
    
    // Выводим порядок заказов
    optimizedOrders.forEach((order, index) => {
        const address = order.address?.actual || order.clientAddress || order.clientTitle;
        console.log(`      ${index + 1}. ${address}`);
    });

    return optimizedOrders;
}

/**
 * 🏃‍♂️ ПРОСТАЯ ОПТИМИЗАЦИЯ (FALLBACK)
 * Используется когда TSP неприменим
 */
function optimizeCourierRouteSimple(orders, courierName) {
    if (orders.length <= 1) return orders;

    console.log(`   🏃‍♂️ Простая оптимизация для ${courierName} (${orders.length} заказов)`);

    const optimizedRoute = [];
    const remainingOrders = [...orders];
    
    // Начинаем с первого заказа
    const firstOrder = remainingOrders.shift();
    optimizedRoute.push(firstOrder);
    
    let currentLocation;
    if (firstOrder.address && firstOrder.address.point) {
        currentLocation = {
            lat: firstOrder.address.point.lat,
            lon: firstOrder.address.point.lon
        };
    } else if (firstOrder.clientPoints) {
        currentLocation = {
            lat: firstOrder.clientPoints.lat,
            lon: firstOrder.clientPoints.lon
        };
    } else {
        return orders; // Возвращаем исходный порядок
    }

    // Алгоритм ближайшего соседа
    while (remainingOrders.length > 0) {
        let nearestIndex = 0;
        let shortestDistance = Infinity;

        for (let i = 0; i < remainingOrders.length; i++) {
            const order = remainingOrders[i];
            let orderLat, orderLon;
            
            if (order.address && order.address.point) {
                orderLat = order.address.point.lat;
                orderLon = order.address.point.lon;
            } else if (order.clientPoints) {
                orderLat = order.clientPoints.lat;
                orderLon = order.clientPoints.lon;
            } else {
                continue;
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

        const selectedOrder = remainingOrders.splice(nearestIndex, 1)[0];
        optimizedRoute.push(selectedOrder);
        
        if (selectedOrder.address && selectedOrder.address.point) {
            currentLocation = {
                lat: selectedOrder.address.point.lat,
                lon: selectedOrder.address.point.lon
            };
        } else if (selectedOrder.clientPoints) {
            currentLocation = {
                lat: selectedOrder.clientPoints.lat,
                lon: selectedOrder.clientPoints.lon
            };
        }
    }

    return optimizedRoute;
}

/**
 * 🌐 ИНТЕГРАЦИЯ С VROOM API
 * Использует внешний сервис для решения VRP (Vehicle Routing Problem)
 */
async function optimizeWithVROOM(orders, vehicles, depot) {
    try {
        console.log(`   🌐 Запрос к VROOM API для оптимизации ${orders.length} заказов и ${vehicles.length} курьеров`);

        // Подготавливаем данные для VROOM
        const vroomJobs = orders.map((order, index) => ({
            id: index + 1,
            location: [
                order.address?.point?.lon || order.clientPoints?.lon,
                order.address?.point?.lat || order.clientPoints?.lat
            ],
            service: 300, // 5 минут на доставку
            delivery: [1], // Единица груза
            skills: order.priority === 'high' ? [1] : [] // Навыки для приоритетных заказов
        }));

        const vroomVehicles = vehicles.map((vehicle, index) => ({
            id: index + 1,
            start: [depot.lon, depot.lat],
            end: [depot.lon, depot.lat],
            capacity: [6], // Максимум 6 заказов
            skills: [1], // Может обрабатывать приоритетные заказы
            time_window: [28800, 72000] // 8:00 - 20:00 в секундах
        }));

        const vroomRequest = {
            jobs: vroomJobs,
            vehicles: vroomVehicles,
            options: {
                g: true // Включить геометрию маршрута
            }
        };

        // Здесь должен быть HTTP запрос к VROOM API
        // const response = await fetch('http://localhost:3000/vroom', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(vroomRequest)
        // });
        // const result = await response.json();

        console.log(`   ⚠️ VROOM API не настроен, используем TSP оптимизацию`);
        return null;

    } catch (error) {
        console.log(`   ❌ Ошибка VROOM API: ${error.message}, используем TSP`);
        return null;
    }
}

/**
 * 🧠 УЛУЧШЕННАЯ ГРУППИРОВКА ЗОН С КЛАСТЕРИЗАЦИЕЙ
 * Использует k-means для более точного разделения на зоны
 */
function createAdvancedZones(orders, maxZones = 10) {
    console.log(`\n🧠 СОЗДАНИЕ ПРОДВИНУТЫХ ЗОН (макс. ${maxZones} зон)`);
    
    if (orders.length === 0) return [];
    
    // Извлекаем координаты
    const points = orders.map(order => ({
        lat: order.address?.point?.lat || order.clientPoints?.lat,
        lon: order.address?.point?.lon || order.clientPoints?.lon,
        order: order
    })).filter(p => p.lat && p.lon);

    if (points.length === 0) return [];

    // Определяем оптимальное количество кластеров
    const optimalClusters = Math.min(Math.ceil(points.length / 3), maxZones);
    
    console.log(`   📊 K-means кластеризация: ${points.length} точек → ${optimalClusters} кластеров`);

    // Простая реализация k-means
    function kMeans(points, k) {
        // Инициализация центроидов
        let centroids = [];
        for (let i = 0; i < k; i++) {
            const randomPoint = points[Math.floor(Math.random() * points.length)];
            centroids.push({ lat: randomPoint.lat, lon: randomPoint.lon });
        }

        let clusters = [];
        let iterations = 0;
        const maxIterations = 50;

        while (iterations < maxIterations) {
            // Назначаем точки к ближайшим центроидам
            clusters = Array.from({ length: k }, () => []);
            
            for (const point of points) {
                let minDistance = Infinity;
                let closestCluster = 0;
                
                for (let i = 0; i < centroids.length; i++) {
                    const distance = calculateDistance(
                        point.lat, point.lon,
                        centroids[i].lat, centroids[i].lon
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCluster = i;
                    }
                }
                clusters[closestCluster].push(point);
            }

            // Обновляем центроиды
            let centroidsChanged = false;
            for (let i = 0; i < k; i++) {
                if (clusters[i].length > 0) {
                    const newLat = clusters[i].reduce((sum, p) => sum + p.lat, 0) / clusters[i].length;
                    const newLon = clusters[i].reduce((sum, p) => sum + p.lon, 0) / clusters[i].length;
                    
                    if (Math.abs(centroids[i].lat - newLat) > 0.0001 || 
                        Math.abs(centroids[i].lon - newLon) > 0.0001) {
                        centroids[i] = { lat: newLat, lon: newLon };
                        centroidsChanged = true;
                    }
                }
            }

            if (!centroidsChanged) break;
            iterations++;
        }

        return { clusters, centroids };
    }

    const { clusters, centroids } = kMeans(points, optimalClusters);

    // Создаем зоны из кластеров
    const zones = [];
    for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].length > 0) {
            const zoneOrders = clusters[i].map(p => p.order);
            const priority = zoneOrders.length >= 4 ? 'high' : 
                           zoneOrders.length >= 2 ? 'medium' : 'low';
            
            zones.push({
                id: `cluster_zone_${i + 1}`,
                center: centroids[i],
                orders: zoneOrders,
                radius: Math.max(...clusters[i].map(p => 
                    calculateDistance(p.lat, p.lon, centroids[i].lat, centroids[i].lon)
                )),
                priority: priority
            });
        }
    }

    console.log(`   ✅ Создано ${zones.length} продвинутых зон`);
    zones.forEach(zone => {
        const priorityIcon = zone.priority === 'high' ? '⭐' : 
                           zone.priority === 'medium' ? '🔶' : '🏷️';
        console.log(`      ${priorityIcon} ${zone.id}: ${zone.orders.length} заказов, радиус ${Math.round(zone.radius)}м`);
    });

    return zones;
}

/**
 * 🎯 ГЛАВНАЯ ФУНКЦИЯ ОПТИМИЗИРОВАННОГО РАСПРЕДЕЛЕНИЯ
 * Использует все улучшенные алгоритмы
 */
export async function optimizedZoneBasedDistribution(date = null, useVROOM = false) {
    try {
        const today = getDateAlmaty(date);
        console.log(`🚀 ОПТИМИЗИРОВАННОЕ ЗОНАЛЬНОЕ РАСПРЕДЕЛЕНИЕ НА ${today}`);
        console.log("=".repeat(70));

        // Сначала сбрасываем старые назначения только для новых заказов
        console.log("🔄 Сброс старых назначений...");

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

        // 1. Получаем заказы и курьеров (аналогично оригинальной функции)
        const orders = await Order.find({
            "date.d": today,
            forAggregator: true,
            status: { $nin: ["onTheWay", "delivered", "cancelled"] },
            $or: [
                { courierAggregator: { $exists: false } },
                { courierAggregator: null },
                { courierAggregator: undefined }
            ],
            "address.point.lat": { $exists: true, $ne: null },
            "address.point.lon": { $exists: true, $ne: null }
        }).populate('client');

        if (orders.length === 0) {
            console.log("❌ Нет заказов для распределения");
            return { success: false, message: "Нет заказов для распределения" };
        }

        const couriers = await CourierAggregator.find({
            onTheLine: true,
            status: "active"
        });

        if (couriers.length === 0) {
            console.log("❌ Нет доступных курьеров!");
            return { success: false, message: "Нет доступных курьеров" };
        }

        const aquaMarket = await AquaMarket.findOne({
            "point.lat": { $exists: true, $ne: null },
            "point.lon": { $exists: true, $ne: null }
        });

        if (!aquaMarket) {
            console.log("❌ Не найден аквамаркет!");
            return { success: false, message: "Не найден аквамаркет" };
        }

        console.log(`📦 Заказов: ${orders.length} | 👥 Курьеров: ${couriers.length}`);

        // 2. Создаем продвинутые зоны с k-means кластеризацией
        const zones = createAdvancedZones(orders, couriers.length * 2);

        if (zones.length === 0) {
            console.log("❌ Не удалось создать зоны!");
            return { success: false, message: "Не удалось создать зоны" };
        }

        // 3. Пытаемся использовать VROOM если включено
        let vroomResult = null;
        if (useVROOM) {
            vroomResult = await optimizeWithVROOM(orders, couriers, {
                lat: aquaMarket.point.lat,
                lon: aquaMarket.point.lon
            });
        }

        // 4. Если VROOM не сработал, используем улучшенное TSP распределение
        if (!vroomResult) {
            console.log(`\n🧠 РАСПРЕДЕЛЕНИЕ ЗОН МЕЖДУ КУРЬЕРАМИ`);
            
            // Используем ту же логику группировки, что и в оригинале
            const courierGroups = groupZonesForCouriersAdvanced(zones, couriers);

            // 5. Назначаем заказы с TSP оптимизацией
            let totalDistributed = 0;
            console.log(`\n👥 НАЗНАЧЕНИЕ С TSP ОПТИМИЗАЦИЕЙ:`);

            for (let groupIndex = 0; groupIndex < courierGroups.length; groupIndex++) {
                const courierGroup = courierGroups[groupIndex];
                const courier = courierGroup.courier;
                
                console.log(`\n👤 КУРЬЕР: ${courier.fullName}`);
                console.log(`   📍 Местоположение: ${courierGroup.courierLocation.lat.toFixed(6)}, ${courierGroup.courierLocation.lon.toFixed(6)}`);
                console.log(`   🏷️ Зоны: ${courierGroup.zones.map(z => z.id).join(', ')}`);
                console.log(`   📦 Всего заказов: ${courierGroup.totalOrders}`);

                // Собираем все заказы курьера
                const allCourierOrders = [];
                for (const zone of courierGroup.zones) {
                    allCourierOrders.push(...zone.orders);
                }

                // ИСПОЛЬЗУЕМ TSP ОПТИМИЗАЦИЮ ВМЕСТО ПРОСТОГО АЛГОРИТМА
                const optimizedOrders = optimizeCourierRouteTSP(allCourierOrders, courier.fullName);

                // Назначаем заказы (аналогично оригинальной функции)
                for (const order of optimizedOrders) {
                    try {
                        await Order.updateOne(
                            { _id: order._id },
                            { 
                                $set: { 
                                    courierAggregator: courier._id,
                                }
                            }
                        );

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
                        };

                        await CourierAggregator.updateOne(
                            { _id: courier._id },
                            { $push: { orders: orderData } }
                        );
                        
                        totalDistributed++;
                        console.log(`      ✅ Заказ назначен`);

                    } catch (error) {
                        console.log(`      ❌ Ошибка: ${error.message}`);
                    }
                }
            }

            // 6. Итоговая статистика
            console.log("\n" + "=".repeat(70));
            console.log("🎉 ОПТИМИЗИРОВАННОЕ РАСПРЕДЕЛЕНИЕ ЗАВЕРШЕНО!");
            console.log("=".repeat(70));
            console.log(`📦 Всего заказов: ${orders.length}`);
            console.log(`✅ Распределено: ${totalDistributed}`);
            console.log(`🏷️ Создано зон: ${zones.length}`);
            console.log(`👥 Задействовано курьеров: ${courierGroups.length}`);
            console.log(`🧬 Использован алгоритм: TSP + Генетический + 2-opt`);

            return {
                success: true,
                totalOrders: orders.length,
                distributedOrders: totalDistributed,
                zonesCreated: zones.length,
                couriersUsed: courierGroups.length,
                algorithm: 'TSP + Genetic + 2-opt',
                zones: zones.map(zone => ({
                    id: zone.id,
                    center: zone.center,
                    ordersCount: zone.orders.length,
                    radius: zone.radius
                }))
            };
        }

    } catch (error) {
        console.error("❌ Ошибка при оптимизированном распределении:", error);
        return { success: false, error: error.message };
    }
}

/**
 * 🎯 УЛУЧШЕННАЯ ГРУППИРОВКА ЗОН ДЛЯ КУРЬЕРОВ
 * Учитывает текущее местоположение курьеров
 */
function groupZonesForCouriersAdvanced(zones, couriers) {
    console.log(`\n🧠 ПРОДВИНУТАЯ ГРУППИРОВКА ${zones.length} ЗОН ДЛЯ ${couriers.length} КУРЬЕРОВ С УЧЕТОМ ИХ МЕСТОПОЛОЖЕНИЯ`);
    
    if (zones.length === 0) return [];
    if (couriers.length === 0) return [];
    
    const totalOrders = zones.reduce((sum, zone) => sum + zone.orders.length, 0);
    const targetOrdersPerCourier = Math.ceil(totalOrders / couriers.length);
    const maxOrdersPerCourier = Math.min(targetOrdersPerCourier + 1, 6);
    
    console.log(`📊 Целевая нагрузка: ${targetOrdersPerCourier}, максимум: ${maxOrdersPerCourier} заказов на курьера`);
    
    // Создаем группы с информацией о курьерах
    const courierGroups = couriers.map((courier, index) => ({
        courier: courier,
        courierIndex: index,
        zones: [],
        totalOrders: 0,
        center: null,
        totalDistance: 0,
        maxDistanceBetweenZones: 0,
        hasPriorityZone: false,
        // Добавляем текущие координаты курьера
        courierLocation: {
            lat: courier.point?.lat || 43.2, // Координаты по умолчанию для Алматы
            lon: courier.point?.lon || 76.9
        }
    }));

    // Выводим информацию о курьерах
    console.log(`👥 КУРЬЕРЫ И ИХ МЕСТОПОЛОЖЕНИЕ:`);
    courierGroups.forEach((group, index) => {
        console.log(`   ${index + 1}. ${group.courier.fullName}: ${group.courierLocation.lat.toFixed(6)}, ${group.courierLocation.lon.toFixed(6)}`);
    });

    // Сортируем зоны по приоритету и размеру
    const sortedZones = [...zones].sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        const aPriority = priorityOrder[a.priority] || 1;
        const bPriority = priorityOrder[b.priority] || 1;
        
        if (aPriority !== bPriority) {
            return bPriority - aPriority;
        }
        return b.orders.length - a.orders.length;
    });

    // Назначаем зоны курьерам с учетом их местоположения и нагрузки
    for (const zone of sortedZones) {
        let bestCourierIndex = -1;
        let bestScore = Infinity;
        
        console.log(`\n🏷️ Назначение зоны ${zone.id} (${zone.orders.length} заказов):`);
        console.log(`   📍 Центр зоны: ${zone.center.lat.toFixed(6)}, ${zone.center.lon.toFixed(6)}`);
        
        for (let i = 0; i < courierGroups.length; i++) {
            const group = courierGroups[i];
            const newTotalOrders = group.totalOrders + zone.orders.length;
            
            if (newTotalOrders > maxOrdersPerCourier) {
                console.log(`      ❌ ${group.courier.fullName}: перегрузка (${newTotalOrders}/${maxOrdersPerCourier})`);
                continue; // Пропускаем перегруженных курьеров
            }
            
            // Вычисляем расстояние от курьера до центра зоны
            const distanceToCourier = calculateDistance(
                group.courierLocation.lat, group.courierLocation.lon,
                zone.center.lat, zone.center.lon
            );
            
            let score = distanceToCourier;
            
            // Если у курьера уже есть зоны, учитываем расстояние до ближайшей зоны
            if (group.zones.length > 0) {
                let minDistanceToExistingZone = Infinity;
                for (const existingZone of group.zones) {
                    const distance = calculateDistance(
                        zone.center.lat, zone.center.lon,
                        existingZone.center.lat, existingZone.center.lon
                    );
                    minDistanceToExistingZone = Math.min(minDistanceToExistingZone, distance);
                }
                
                // Комбинируем расстояние до курьера и до существующих зон
                score = (distanceToCourier * 0.7) + (minDistanceToExistingZone * 0.3);
                
                // Штрафуем за большие расстояния между зонами
                if (minDistanceToExistingZone > 3000) score *= 2;
                if (minDistanceToExistingZone > 5000) score *= 3;
            }
            
            // Штрафуем за превышение целевой нагрузки
            const loadPenalty = newTotalOrders > targetOrdersPerCourier ? 
                (newTotalOrders - targetOrdersPerCourier) * 1000 : 0;
            score += loadPenalty;
            
            console.log(`      📊 ${group.courier.fullName}: расстояние ${Math.round(distanceToCourier)}м, score ${Math.round(score)}, нагрузка ${newTotalOrders}/${maxOrdersPerCourier}`);
            
            if (score < bestScore) {
                bestScore = score;
                bestCourierIndex = i;
            }
        }
        
        if (bestCourierIndex !== -1) {
            const selectedGroup = courierGroups[bestCourierIndex];
            selectedGroup.zones.push(zone);
            selectedGroup.totalOrders += zone.orders.length;
            
            if (zone.priority === 'high') {
                selectedGroup.hasPriorityZone = true;
            }
            
            console.log(`      ✅ Назначено курьеру: ${selectedGroup.courier.fullName} (расстояние ${Math.round(bestScore)}м)`);
        } else {
            console.log(`      ⚠️ Не удалось назначить зону - все курьеры перегружены`);
        }
    }
    
    return courierGroups.filter(group => group.zones.length > 0);
}

// Экспортируем также отдельные функции для тестирования
export { 
    optimizeCourierRouteTSP, 
    createAdvancedZones, 
    solveTSPGenetic, 
    improve2Opt,
    optimizeWithVROOM 
}; 