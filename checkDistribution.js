import mongoose from 'mongoose';
import Order from './Models/Order.js';
import CourierAggregator from './Models/CourierAggregator.js';

async function checkDistribution() {
    await mongoose.connect('mongodb://127.0.0.1:27017/crm');

    console.log('🎯 ФИНАЛЬНАЯ ПРОВЕРКА РАСПРЕДЕЛЕНИЯ ЗАКАЗОВ');
    console.log('===========================================');

    const couriers = await CourierAggregator.find({ onTheLine: true });

    console.log('👥 КУРЬЕРЫ И ИХ ЗАКАЗЫ:');
    for (const courier of couriers) {
        console.log(`\n👤 ${courier.fullName}: ${courier.orders.length} заказов`);
        
        for (let i = 0; i < courier.orders.length; i++) {
            const orderData = courier.orders[i];
            if (orderData && orderData.clientAddress) {
                console.log(`   ${i+1}. ${orderData.clientAddress}`);
            }
        }
    }

    const today = new Date().toISOString().split('T')[0];
    const totalOrders = await Order.countDocuments({ 
        createdAt: { 
            $gte: new Date(today + 'T00:00:00.000Z'), 
            $lt: new Date(today + 'T23:59:59.999Z') 
        } 
    });
    
    const assignedOrders = await Order.countDocuments({ 
        createdAt: { 
            $gte: new Date(today + 'T00:00:00.000Z'), 
            $lt: new Date(today + 'T23:59:59.999Z') 
        },
        courierAggregator: { $exists: true }
    });

    console.log(`\n📊 СТАТИСТИКА:`);
    console.log(`📦 Всего заказов: ${totalOrders}`);
    console.log(`✅ Назначено: ${assignedOrders}`);
    console.log(`❌ Не назначено: ${totalOrders - assignedOrders}`);

    await mongoose.disconnect();
}

checkDistribution().catch(console.error); 