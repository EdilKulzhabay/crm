import mongoose from 'mongoose';
import CourierAggregator from './Models/CourierAggregator.js';

/**
 * 🔄 ИЗМЕНЕНИЕ ПОРЯДКА ЗАКАЗОВ У КУРЬЕРА
 * Переставляет заказы в нужном порядке
 */
async function reorderCourierOrders() {
    try {
        console.log('🔄 ИЗМЕНЕНИЕ ПОРЯДКА ЗАКАЗОВ У КУРЬЕРА');
        console.log('='.repeat(50));

        // ID курьера
        const courierId = '683dd48b54ed3e4c0adcc241';
        
        // ID заказов для перестановки
        const orderToPosition2 = '68626cc548cdb02bd0ba39b3'; // Адм суд каб-111 и 210
        const orderToPosition6 = '6862a9ed48cdb02bd0ba6d1e'; // Академия им. Жургенова

        console.log(`👤 Курьер ID: ${courierId}`);
        console.log(`📦 Заказ на 2-е место: ${orderToPosition2}`);
        console.log(`📦 Заказ на 6-е место: ${orderToPosition6}`);

        // Получаем текущего курьера
        const courier = await CourierAggregator.findById(courierId);
        
        if (!courier) {
            console.log('❌ Курьер не найден!');
            return;
        }

        console.log(`\n📋 Текущий курьер: ${courier.fullName}`);
        console.log(`📦 Всего заказов: ${courier.orders.length}`);

        // Показываем текущий порядок
        console.log('\n📋 ТЕКУЩИЙ ПОРЯДОК ЗАКАЗОВ:');
        courier.orders.forEach((order, index) => {
            const isTarget1 = order.orderId === orderToPosition2;
            const isTarget2 = order.orderId === orderToPosition6;
            const marker = isTarget1 ? ' 🎯➡️2' : isTarget2 ? ' 🎯➡️6' : '';
            console.log(`   ${index + 1}. ${order.orderId} - ${order.clientTitle}${marker}`);
        });

        // Создаем новый массив заказов
        let newOrders = [...courier.orders];

        // Находим индексы нужных заказов
        const order1Index = newOrders.findIndex(order => order.orderId === orderToPosition2);
        const order2Index = newOrders.findIndex(order => order.orderId === orderToPosition6);

        if (order1Index === -1) {
            console.log(`❌ Заказ ${orderToPosition2} не найден!`);
            return;
        }

        if (order2Index === -1) {
            console.log(`❌ Заказ ${orderToPosition6} не найден!`);
            return;
        }

        console.log(`\n🔍 НАЙДЕННЫЕ ПОЗИЦИИ:`);
        console.log(`   Заказ ${orderToPosition2} находится на позиции: ${order1Index + 1}`);
        console.log(`   Заказ ${orderToPosition6} находится на позиции: ${order2Index + 1}`);

        // Сохраняем заказы
        const order1 = newOrders[order1Index];
        const order2 = newOrders[order2Index];

        // Удаляем заказы из текущих позиций (удаляем сначала тот, что с большим индексом)
        if (order1Index > order2Index) {
            newOrders.splice(order1Index, 1);
            newOrders.splice(order2Index, 1);
        } else {
            newOrders.splice(order2Index, 1);
            newOrders.splice(order1Index, 1);
        }

        // Вставляем заказы на новые позиции
        newOrders.splice(1, 0, order1); // Вставляем order1 на позицию 2 (индекс 1)
        newOrders.splice(5, 0, order2); // Вставляем order2 на позицию 6 (индекс 5)

        // Показываем новый порядок
        console.log('\n📋 НОВЫЙ ПОРЯДОК ЗАКАЗОВ:');
        newOrders.forEach((order, index) => {
            const isTarget1 = order.orderId === orderToPosition2;
            const isTarget2 = order.orderId === orderToPosition6;
            const marker = isTarget1 ? ' ✅ (перемещен на 2-е место)' : 
                          isTarget2 ? ' ✅ (перемещен на 6-е место)' : '';
            console.log(`   ${index + 1}. ${order.orderId} - ${order.clientTitle}${marker}`);
        });

        // Обновляем курьера в базе данных
        const result = await CourierAggregator.updateOne(
            { _id: courierId },
            { $set: { orders: newOrders } }
        );

        if (result.modifiedCount > 0) {
            console.log('\n✅ ПОРЯДОК ЗАКАЗОВ УСПЕШНО ИЗМЕНЕН!');
            console.log(`📊 Обновлено документов: ${result.modifiedCount}`);
        } else {
            console.log('\n⚠️ Изменения не были сохранены');
        }

        // Проверяем результат
        const updatedCourier = await CourierAggregator.findById(courierId);
        console.log('\n🔍 ПРОВЕРКА РЕЗУЛЬТАТА:');
        
        const finalOrder1Position = updatedCourier.orders.findIndex(order => order.orderId === orderToPosition2) + 1;
        const finalOrder2Position = updatedCourier.orders.findIndex(order => order.orderId === orderToPosition6) + 1;
        
        console.log(`   Заказ ${orderToPosition2} теперь на позиции: ${finalOrder1Position} ${finalOrder1Position === 2 ? '✅' : '❌'}`);
        console.log(`   Заказ ${orderToPosition6} теперь на позиции: ${finalOrder2Position} ${finalOrder2Position === 6 ? '✅' : '❌'}`);

        console.log('\n🎉 ОПЕРАЦИЯ ЗАВЕРШЕНА!');

    } catch (error) {
        console.error('❌ Ошибка при изменении порядка заказов:', error);
    }
}

/**
 * 📊 ПОКАЗАТЬ ТЕКУЩИЙ ПОРЯДОК ЗАКАЗОВ
 */
async function showCurrentOrder(courierId = '683dd48b54ed3e4c0adcc241') {
    try {
        const courier = await CourierAggregator.findById(courierId);
        
        if (!courier) {
            console.log('❌ Курьер не найден!');
            return;
        }

        console.log(`\n👤 Курьер: ${courier.fullName}`);
        console.log(`📦 Всего заказов: ${courier.orders.length}`);
        console.log('\n📋 ПОРЯДОК ЗАКАЗОВ:');
        
        courier.orders.forEach((order, index) => {
            console.log(`   ${index + 1}. ${order.orderId} - ${order.clientTitle}`);
            console.log(`      📍 ${order.clientAddress}`);
            console.log(`      💰 ${order.sum} тенге (${order.opForm})`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Ошибка при получении заказов:', error);
    }
}

// Подключение к MongoDB и выполнение
async function main() {
    try {
        // Подключаемся к MongoDB
        await mongoose.connect('mongodb://localhost:27017/crm');
        console.log('🔗 Подключение к MongoDB установлено');

        // Показываем текущий порядок
        console.log('📋 ТЕКУЩИЙ ПОРЯДОК ЗАКАЗОВ:');
        await showCurrentOrder();

        // Выполняем перестановку
        await reorderCourierOrders();

        // Показываем итоговый порядок
        console.log('\n📋 ИТОГОВЫЙ ПОРЯДОК ЗАКАЗОВ:');
        await showCurrentOrder();

    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Соединение с MongoDB закрыто');
    }
}

// Экспортируем функции
export { reorderCourierOrders, showCurrentOrder };

// Если файл запускается напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
} 