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

        // 2) Обновить franchisee для найденных клиентов
        const fromFranchiseeId = new mongoose.Types.ObjectId("66f15c557a27c92d447a16a0");
        const toFranchiseeId = new mongoose.Types.ObjectId("697c1dbedfdc5bb6a0c21089");

        const updateResult = await Client.updateMany(
            { _id: { $in: clientIds }, franchisee: fromFranchiseeId },
            { $set: { franchisee: toFranchiseeId } }
        );

        console.log("Обновлено клиентов:", updateResult.modifiedCount);
    } catch (error) {
        console.error("Ошибка при миграции:", error);
    } finally {
        await mongoose.disconnect();
    }
};

migrateBClients();