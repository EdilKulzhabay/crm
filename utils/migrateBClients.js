import Client from "../Models/Client.js";
import Order from "../Models/Order.js";

const migrateBClients = async () => {
    // 1) Найти уникальные clientId у заказов нужного franchisee
    const franchiseeId = ObjectId("66fc0cc6953c2dbbc86c2132");

    const clientIds = await Order.distinct("client", { franchisee: franchiseeId });

    // 2) Получить список клиентов
    const clients = await Client.find(
        { _id: { $in: clientIds } },
        { _id: 1, fullName: 1, phone: 1, mail: 1 }
    ).populate("franchisee", "userName");

    console.log(clients);
}

migrateBClients();