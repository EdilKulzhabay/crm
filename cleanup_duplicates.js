import mongoose from "mongoose";

async function cleanupDuplicates() {
    if (mongoose.connection.readyState === 0) {
        const uri = "mongodb://localhost:27017/crm";
        await mongoose.connect(uri, {
            dbName: "crm",
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("✅ MongoDB connected");
    }
    
    try {
        // Получаем всех курьеров онлайн
        const couriers = await mongoose.connection.db.collection('courieraggregators').find({onTheLine: true}).toArray();
        
        console.log(`Найдено ${couriers.length} курьеров онлайн`);
        
        for (const courier of couriers) {
            console.log(`\n=== Обрабатываем курьера: ${courier.fullName} ===`);
            console.log(`Заказов до очистки: ${courier.orders.length}`);
            
            // Удаляем дубликаты, оставляя только первое вхождение каждого orderId
            const uniqueOrders = [];
            const seenOrderIds = new Set();
            
            courier.orders.forEach(order => {
                if (!seenOrderIds.has(order.orderId)) {
                    seenOrderIds.add(order.orderId);
                    uniqueOrders.push(order);
                    console.log(`✅ Оставляем заказ: ${order.orderId} (${order.status})`);
                } else {
                    console.log(`❌ Удаляем дубликат: ${order.orderId} (${order.status})`);
                }
            });
            
            console.log(`Заказов после очистки: ${uniqueOrders.length}`);
            
            // Обновляем документ курьера
            const result = await mongoose.connection.db.collection('courieraggregators').updateOne(
                { _id: courier._id },
                { $set: { orders: uniqueOrders } }
            );
            
            console.log(`Обновлено документов: ${result.modifiedCount}`);
        }
        
        console.log('\n✅ Очистка дубликатов завершена!');
        
    } catch (error) {
        console.error('Ошибка:', error);
    } finally {
        await mongoose.connection.close();
    }
}

cleanupDuplicates(); 