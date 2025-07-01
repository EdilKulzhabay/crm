const mongoose = require('mongoose');
const CourierAggregator = require('./Models/CourierAggregator');

// Подключение к MongoDB
mongoose.connect('mongodb://localhost:27017/crm', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function redistributeOrders() {
    try {
        console.log('🔄 Начинаем перераспределение заказов...\n');

        // Получаем всех активных курьеров
        const couriers = await CourierAggregator.find({onTheLine: true});
        console.log(`📋 Найдено ${couriers.length} активных курьеров\n`);

        // Находим курьеров по именам
        const vasiliy = couriers.find(c => c.fullName === 'Василий Яковлев');
        const beket = couriers.find(c => c.fullName === 'Бекет Сапарбаев');
        const taskyn = couriers.find(c => c.fullName === 'Тасқын Әбікен');

        if (!vasiliy || !beket || !taskyn) {
            console.log('❌ Не найдены все необходимые курьеры');
            return;
        }

        console.log('👥 Найдены курьеры:');
        console.log(`   - Василий Яковлев: ${vasiliy._id}`);
        console.log(`   - Бекет Сапарбаев: ${beket._id}`);
        console.log(`   - Тасқын Әбікен: ${taskyn._id}\n`);

        // Собираем все заказы от всех курьеров
        const allOrders = [];
        couriers.forEach(courier => {
            courier.orders.forEach(order => {
                allOrders.push({
                    ...order.toObject(),
                    currentCourier: courier.fullName
                });
            });
        });

        console.log(`📦 Всего заказов найдено: ${allOrders.length}\n`);

        // Находим нужные заказы
        const orderForVasiliy1 = allOrders.find(o => o.orderId === '68636a8848cdb02bd0ba8deb');
        const orderForVasiliy2 = allOrders.find(o => o.orderId === '68636e0948cdb02bd0ba97df');
        const orderForBeket1 = allOrders.find(o => o.orderId === '68634eb248cdb02bd0ba7e7a');
        const orderForBeket2 = allOrders.find(o => o.orderId === '6862557048cdb02bd0ba091c');
        const orderForTaskyn = allOrders.find(o => o.orderId === '6862a9ed48cdb02bd0ba6d1e');

        console.log('🔍 Найденные заказы для перераспределения:');
        console.log(`   - Для Василия: ${orderForVasiliy1 ? orderForVasiliy1.clientTitle : 'НЕ НАЙДЕН'} (${orderForVasiliy1 ? orderForVasiliy1.currentCourier : 'N/A'})`);
        console.log(`   - Для Василия: ${orderForVasiliy2 ? orderForVasiliy2.clientTitle : 'НЕ НАЙДЕН'} (${orderForVasiliy2 ? orderForVasiliy2.currentCourier : 'N/A'})`);
        console.log(`   - Для Бекета: ${orderForBeket1 ? orderForBeket1.clientTitle : 'НЕ НАЙДЕН'} (${orderForBeket1 ? orderForBeket1.currentCourier : 'N/A'})`);
        console.log(`   - Для Бекета: ${orderForBeket2 ? orderForBeket2.clientTitle : 'НЕ НАЙДЕН'} (${orderForBeket2 ? orderForBeket2.currentCourier : 'N/A'})`);
        console.log(`   - Для Таскына: ${orderForTaskyn ? orderForTaskyn.clientTitle : 'НЕ НАЙДЕН'} (${orderForTaskyn ? orderForTaskyn.currentCourier : 'N/A'})\n`);

        // Очищаем заказы у всех курьеров
        await CourierAggregator.updateMany(
            {onTheLine: true},
            {$set: {orders: []}}
        );

        console.log('🧹 Очистили заказы у всех курьеров\n');

        // Назначаем новые заказы
        const newOrders = {
            [vasiliy._id]: [orderForVasiliy1, orderForVasiliy2].filter(Boolean),
            [beket._id]: [orderForBeket1, orderForBeket2].filter(Boolean),
            [taskyn._id]: [orderForTaskyn].filter(Boolean)
        };

        // Обновляем каждого курьера
        for (const [courierId, orders] of Object.entries(newOrders)) {
            if (orders.length > 0) {
                await CourierAggregator.findByIdAndUpdate(
                    courierId,
                    {$set: {orders: orders}}
                );
                
                const courierName = couriers.find(c => c._id.toString() === courierId).fullName;
                console.log(`✅ ${courierName}: назначено ${orders.length} заказов`);
                orders.forEach(order => {
                    console.log(`   - ${order.clientTitle} (${order.orderId})`);
                });
                console.log();
            }
        }

        console.log('🎉 Перераспределение заказов завершено успешно!');

    } catch (error) {
        console.error('❌ Ошибка при перераспределении заказов:', error);
    } finally {
        mongoose.connection.close();
    }
}

async function showCurrentDistribution() {
    try {
        console.log('📊 ТЕКУЩЕЕ РАСПРЕДЕЛЕНИЕ ЗАКАЗОВ:\n');
        
        const couriers = await CourierAggregator.find({onTheLine: true});
        
        couriers.forEach(courier => {
            console.log(`👤 ${courier.fullName}:`);
            if (courier.orders.length === 0) {
                console.log('   - Нет заказов');
            } else {
                courier.orders.forEach((order, index) => {
                    console.log(`   ${index + 1}. ${order.clientTitle} (${order.orderId})`);
                });
            }
            console.log();
        });
        
    } catch (error) {
        console.error('❌ Ошибка при показе распределения:', error);
    }
}

async function main() {
    console.log('🚀 СКРИПТ ПЕРЕРАСПРЕДЕЛЕНИЯ ЗАКАЗОВ\n');
    
    await showCurrentDistribution();
    await redistributeOrders();
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 ИТОГОВОЕ РАСПРЕДЕЛЕНИЕ:');
    console.log('='.repeat(50));
    await showCurrentDistribution();
}

// Экспорт функций
module.exports = {
    redistributeOrders,
    showCurrentDistribution
};

// Запуск если файл выполняется напрямую
if (require.main === module) {
    main();
}