import mongoose from "mongoose";
import Client from "../Models/Client.js";
import Order from "../Models/Order.js";
import "dotenv/config";

const migrateBClients = async () => {
    try {
        await mongoose.connect(process.env.MONGOURL);

        // 1) Найти уникальные clientId у заказов нужного franchisee
        const franchiseeId = new mongoose.Types.ObjectId("66fc0cc6953c2dbbc86c2132");

        const clientIds = await Order.distinct("client", { franchisee: franchiseeId });

        // 2) Получить список клиентов
        const clients = await Client.find(
            { _id: { $in: clientIds } },
            { _id: 1, fullName: 1, phone: 1, mail: 1 }
        ).populate("franchisee", "userName");

        console.log(JSON.stringify(clients, null, 2));
    } catch (error) {
        console.error("Ошибка при миграции:", error);
    } finally {
        await mongoose.disconnect();
    }
};

migrateBClients();