import mongoose from 'mongoose';
import axios from 'axios';

// Подключение к MongoDB
mongoose.connect('mongodb://localhost:27017/crm');

// Схемы для заказов и клиентов
const orderSchema = new mongoose.Schema({}, { strict: false, strictPopulate: false });
const clientSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model('Order', orderSchema, 'orders');
const Client = mongoose.model('Client', clientSchema, 'clients');

// Функция для получения координат по адресу (как в ClientController.js)
const fetchAddressId = async (addressActual) => {
    try {
        const response = await axios.get('https://catalog.api.2gis.com/3.0/items/geocode', {
            params: {
                fields: "items.point",
                key: "f5af220d-c60a-4cf6-a350-4a953c324a3d",
                q: `Алматы, ${addressActual}`,
            },
        });
        
        console.log(`Поиск координат для: ${addressActual}`);
        console.log("response.data.result", response.data.result);
        
        return response.data.result.items[0] || null;
    } catch (error) {
        console.log(`Невозможно найти адрес: ${addressActual}`);
        return null;
    }
};

// Основная функция обновления
const updateOrderCoordinates = async () => {
    try {
        // Находим заказы на 2025-06-27 для указанных франчайзи без координат с populate client
        const orders = await Order.find({
            franchisee: { 
                $in: [
                    new mongoose.Types.ObjectId('66f15c557a27c92d447a16a0'), 
                    new mongoose.Types.ObjectId('66fc0cc6953c2dbbc86c2132'), 
                    new mongoose.Types.ObjectId('66fc0d01953c2dbbc86c2135'), 
                    new mongoose.Types.ObjectId('66fc0d3e953c2dbbc86c2138'),
                    new mongoose.Types.ObjectId('67010493e6648af4cb0213b7')
                ]
            },
            _id: {
                $nin: [
                    new mongoose.Types.ObjectId('6860fe2848cdb02bd0b9acc2'),
                    new mongoose.Types.ObjectId('68636ae448cdb02bd0ba8f34'),
                    new mongoose.Types.ObjectId('6862aa3b48cdb02bd0ba6ddc')
                ]
            },
            "date.d": "2025-07-01",
            $or: [
                { "address.point": null },
                { "address.point": { lat: null, lon: null } },
                { "address.point": { $exists: false } }
            ]
        }).populate('client');

        console.log(`Найдено ${orders.length} заказов для обновления координат`);

        let updatedCount = 0;
        let failedCount = 0;
        let clientsUpdated = new Set(); // Для отслеживания обновленных клиентов

        // Обрабатываем каждый заказ
        for (const order of orders) {
            console.log(`\nОбрабатываем заказ ID: ${order._id}`);
            console.log(`Адрес заказа: ${order.address.actual}`);
            console.log(`Текущие координаты:`, order.address.point);

            if (!order.client) {
                console.log(`❌ Клиент не найден для заказа ${order._id}`);
                failedCount++;
                continue;
            }

            // Ищем соответствующий адрес в массиве адресов клиента
            const clientAddresses = order.client.addresses || [];
            let matchingAddress = null;

            // Пытаемся найти соответствующий адрес по имени или по содержимому
            if (order.address.name) {
                matchingAddress = clientAddresses.find(addr => addr.name === order.address.name);
            }
            
            // Если не найден по имени, ищем по частичному совпадению actual
            if (!matchingAddress) {
                matchingAddress = clientAddresses.find(addr => 
                    addr.actual && order.address.actual && 
                    (addr.actual.includes(order.address.actual) || order.address.actual.includes(addr.actual))
                );
            }

            let addressToGeocode = order.address.actual;
            
            // Если найден соответствующий адрес клиента, используем его street
            if (matchingAddress && matchingAddress.street) {
                addressToGeocode = matchingAddress.street;
                console.log(`Используем адрес клиента: ${addressToGeocode}`);
            }

            // Получаем координаты через API 2GIS
            const result = await fetchAddressId(addressToGeocode);

            if (result && result.point) {
                console.log(`📍 Получены координаты из API:`, result.point);
                
                // Обновляем координаты в заказе
                const newPoint = {
                    lat: result.point.lat,
                    lon: result.point.lon
                };
                
                console.log(`🔄 Устанавливаем новые координаты:`, newPoint);
                
                // Используем updateOne вместо save для надежности
                const updateResult = await Order.updateOne(
                    { _id: order._id },
                    { 
                        $set: { 
                            "address.point": newPoint,
                            updatedAt: new Date(),
                            forceUpdate: true
                        }
                    }
                );
                
                console.log(`📊 Результат обновления:`, updateResult);
                
                if (updateResult.modifiedCount > 0) {
                    console.log(`✅ Координаты заказа обновлены: lat=${newPoint.lat}, lon=${newPoint.lon}`);
                    updatedCount++;
                } else {
                    console.log(`❌ Не удалось обновить координаты в базе данных`);
                    failedCount++;
                }

                // Обновляем координаты в адресе клиента, если найден соответствующий адрес
                if (matchingAddress) {
                    matchingAddress.id2Gis = result.id;
                    matchingAddress.point = newPoint;
                    
                    // Сохраняем клиента только если еще не обновляли
                    if (!clientsUpdated.has(order.client._id.toString())) {
                        await order.client.save();
                        clientsUpdated.add(order.client._id.toString());
                        console.log(`✅ Координаты клиента также обновлены`);
                    }
                }
            } else {
                console.log(`❌ Координаты не найдены для адреса: ${addressToGeocode}`);
                failedCount++;
            }

            // Небольшая задержка между запросами к API
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`\n=== РЕЗУЛЬТАТ ===`);
        console.log(`Всего обработано заказов: ${orders.length}`);
        console.log(`Успешно обновлено: ${updatedCount}`);
        console.log(`Не удалось найти координаты: ${failedCount}`);
        console.log(`Обновлено клиентов: ${clientsUpdated.size}`);

    } catch (error) {
        console.error('Ошибка при обновлении координат:', error);
    } finally {
        mongoose.connection.close();
    }
};

// Запускаем скрипт
updateOrderCoordinates(); 