import Client from "../Models/Client.js";
import Notification from "../Models/Notification.js";
import User from "../Models/User.js";
import axios from "axios"

export const addClient = async (req, res) => {
    try {
        const {
            fullName,
            userName,
            phone,
            mail,
            addresses,
            price19,
            price12,
            franchisee,
            opForm
        } = req.body;

        const client = new Client({
            fullName,
            userName,
            phone,
            mail,
            addresses,
            price19,
            price12,
            franchisee,
            opForm,
            verify: {status: "waitingVerification", message: ""}
        });

        await client.save();

        let orConditions = [];

        if (phone) {
            orConditions.push({ phone: phone, franchisee: { $ne: franchisee } });
        }

        if (addresses && addresses.length > 0) {
            addresses.forEach((address) => {
                orConditions.push({
                    addresses: {
                        $elemMatch: {
                            street: address.street,
                            link: address.link
                        },
                    },
                    franchisee: { $ne: franchisee },
                });
            });
        }

        let existingClients = null
        if (orConditions.length > 0) {
            existingClients = await Client.findOne({ $or: orConditions });
        }

        if (existingClients) {
            let matchedField = "";
            if (existingClients.phone === phone) matchedField += "phone ";
            if (
                existingClients.addresses &&
                addresses &&
                existingClients.addresses.some((addr) =>
                    addresses.some(
                        (newAddr) => addr.link === newAddr.link || addr.street === newAddr.street
                    )
                )
            ) {
                matchedField += "addresses ";
            }

            const notDoc = new Notification({
                first: existingClients.franchisee,
                second: franchisee,
                matchesType: "client",
                matchedField,
                firstObject: existingClients._id,
                secondObject: client._doc._id
            });

            await notDoc.save();

            const notification = {
                message: "Есть совпадение клиентов",
            };

            global.io.emit("clientMatch", notification);
        }

        res.json({
            success: true,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getClients = async (req, res) => {
    try {
        const id = req.userId;
        const { page, startDate, endDate } = req.body;

        const sDate = startDate
            ? new Date(startDate + "T00:00:00.000Z")
            : new Date("2024-01-01T00:00:00.000Z");
        const eDate = endDate
            ? new Date(endDate + "T00:00:00.000Z")
            : new Date("2026-01-01T00:00:00.000Z");
        
        const limit = 5;
        const skip = (page - 1) * limit;

        const user = await User.findById(id);

        // Строим базовый фильтр
        const filter = {
            createdAt: { $gte: sDate, $lte: eDate },
        };

        // Добавляем фильтр по франчайзи для админа
        if (user.role === "admin") {
            filter.franchisee = id;
        }

        // Выполняем запрос с фильтрацией, сортировкой, пропуском и лимитом
        const clients = await Client.find(filter)
            .populate("franchisee")
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit);

        res.json({ clients });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getFreeInfo = async (req, res) => {
    try {
        const id = req.userId;

        const user = await User.findById(id);

        const filter = {};

        if (user.role === "admin") {
            filter.franchisee = id;
        }

        const activeTotal = await Client.countDocuments({
            ...filter,
            status: "active",
        });
        const inActiveTotal = await Client.countDocuments({
            ...filter,
            status: "inActive",
        });
        const total = activeTotal + inActiveTotal;

        res.json({
            activeTotal,
            inActiveTotal,
            total,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const searchClient = async (req, res) => {
    try {
        const id = req.userId;

        const user = await User.findById(id);

        const { search } = req.body;

        const regex = new RegExp(search, "i"); // 'i' делает поиск регистронезависимым

        const filter = [
            { fullName: { $regex: regex } },
            { userName: { $regex: regex } },
            { phone: { $regex: regex } },
            { mail: { $regex: regex } },
            { 
                addresses: { 
                    $elemMatch: { 
                        $or: [
                            { street: { $regex: regex } },
                            { house: { $regex: regex } },
                        ] 
                    } 
                } 
            },
        ];

        const franch = {};

        if (user.role === "admin") {
            franch.franchisee = id;
        }

        const clients = await Client.find({
            ...franch,
            $or: filter,
        }).populate("franchisee");

        res.json(clients);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const deleteClient = async (req, res) => {
    try {
        const { id } = req.body;

        const delRes = await Client.findByIdAndDelete(id);

        if (!delRes) {
            return res.status(400).json({
                success: false,
                message: "Не удалось удалить клиента",
            });
        }
        res.json({
            success: true,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getClientDataForId = async (req, res) => {
    try {
        const { id } = req.body;

        const client = await Client.findById(id).populate("franchisee", "fullName");

        if (!client) {
            res.status(404).json({
                message: "Не удалось найти клиента",
            });
        }

        res.json(client);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const deleteClientAdress = async (req, res) => {
    try {
        const { clientId, adressId } = req.body;

        const client = await Client.findById(clientId);

        if (!client) {
            return res.status(404).json({ message: "Проблема с сетью" });
        }

        client.addresses = client.addresses.filter(
            (address) => address._id.toString() !== adressId
        );
        await client.save();

        res.json({
            success: true,
            message: "Удаение адреса прошло успешно",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const updateClientData = async (req, res) => {
    try {
        const { clientId, field, value } = req.body;
    
        // Находим текущего клиента
        const client = await Client.findById(clientId);
        if (!client) {
            return res
            .status(404)
            .json({ success: false, message: "Client not found" });
        }
  
        // Обновляем поле клиента
        client.verify.status = "waitingVerification"
        client.verify.message = ""
        client[field] = value;

        if (field === "verify" && value.status === "verified") {
            const clientAddresses = client.addresses;

            // Функция для получения ID 2GIS по адресу
            const fetchAddressId = async (item) => {
                try {
                    const response = await axios.get('https://catalog.api.2gis.com/3.0/items/geocode', {
                        params: {
                            fields: "items.point",
                            key: "f5af220d-c60a-4cf6-a350-4a953c324a3d",
                            q: `Алматы, ${item.street}`,
                        },
                    });
                    console.log("response.data.result", response.data.result);
                    
                    return response.data.result.items[0]?.id || null; // Возвращаем ID или null
                } catch (error) {
                    console.log(`Невозможно найти адрес: ${item.street}`);
                    return null;
                }
            };

            // Получаем IDs для всех адресов
            const addressIds = await Promise.allSettled(clientAddresses.map(fetchAddressId));
            addressIds.forEach((result, index) => {
                clientAddresses[index].id2Gis = result.status === "fulfilled" ? result.value : null;
            });

            // Сохраняем обновленный документ клиента
            client.addresses = clientAddresses; // Перезаписываем массив addresses
            await client.save();

            // Проверяем совпадения с другими клиентами
            let orConditions = [];
            if (client.phone !== "") {
                orConditions.push({ phone: client.phone, franchisee: { $ne: client.franchisee } });
            }
            if (client.mail !== "") {
                orConditions.push({ mail: client.mail, franchisee: { $ne: client.franchisee } });
            }
            client.addresses.forEach((address) => {
                console.log(address.id2Gis);
                
                orConditions.push({
                    addresses: {
                    $elemMatch: {
                        id2Gis: address.id2Gis,
                    },
                    },
                    franchisee: { $ne: client.franchisee },
                });
            });

            let existingClients = null;
            existingClients = await Client.findOne({
                $or: orConditions,
                "verify.status": "verified",
                _id: { $ne: clientId }, // исключаем текущего клиента из поиска
            });

            // Если найдены совпадения, создаем уведомление
            if (existingClients) {
                let matchedField = "";
                if (existingClients.phone === client.phone && client.phone !== "") {
                    matchedField += "phone ";
                }
                if (existingClients.mail === client.mail && client.mail !== "") {
                    matchedField += "mail ";
                }
                if (existingClients.addresses.some((addr) => addr.id2Gis && client.addresses.some((newAddr) => addr.id2Gis === newAddr.id2Gis))) {
                    matchedField += "addresses ";
                }
        
                const notDoc = new Notification({
                    first: existingClients.franchisee,
                    second: client.franchisee,
                    matchesType: "client",
                    matchedField,
                    firstObject: existingClients._id,
                    secondObject: client._id
                });
        
                await notDoc.save();
        
                const notification = {
                    message: "Есть совпадение клиентов",
                };
        
                global.io.emit("clientMatch", notification);
            }
        } else {
            await client.save();
        }

        res.json({ success: true, message: "Данные успешно изменены" });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const updateClientFranchisee = async (req, res) => {
    try {
        const { clientId, franchiseeId } = req.body;

        const client = await Client.findById(clientId);

        if (!client) {
            res.json({
                success: false,
                message: "Не удалось найти клиента",
            });
        }

        client.franchisee = franchiseeId;

        await client.save();

        res.json({
            success: true,
            message: "Клиент успешно перенесен",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getClientsForExcel = async (req, res) => {
    try {
        const id = req.userId;
        const { startDate, endDate, status } = req.body;

        const sDate = startDate
            ? new Date(startDate + "T00:00:00.000Z")
            : new Date("2024-01-01T00:00:00.000Z");
        const eDate = endDate
            ? new Date(endDate + "T00:00:00.000Z")
            : new Date("2026-01-01T00:00:00.000Z");

        const user = await User.findById(id);

        // Строим базовый фильтр
        const filter = {
            createdAt: { $gte: sDate, $lte: eDate },
        };

        // Добавляем фильтр по статусу, если он не "all"
        if (status !== "all") {
            filter.status = status;
        }

        // Добавляем фильтр по франчайзи для админа
        if (user.role === "admin") {
            filter.franchisee = id;
        }

        // Выполняем запрос с фильтрацией, сортировкой, пропуском и лимитом
        const clients = await Client.find(filter)
            .populate("franchisee", "fullName")
            .sort({ createdAt: 1 });

        res.json({ clients });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getNotVerifyClients = async (req, res) => {
    try {
        const {page, searchF, sa} = req.body

        const limit = 20;
        const skip = (page - 1) * limit;
        const filter = {}

        if (searchF !== "") {
            const franchisees = await User.find({
                $or: [
                    { fullName: { $regex: searchF, $options: "i" } },
                    { userName: { $regex: searchF, $options: "i" } }
                ]
            }).select('_id');
    
            const franchiseeIds = franchisees.map(franchisee => franchisee._id);
            filter.$or = [
                { franchisee: { $in: franchiseeIds } }, // Применяем $in к полю franchisee
                { transferredFranchise: { $regex: searchF, $options: "i" } } // Фильтр по transferredFranchise
            ];
        } else if (sa) {
            const franchisees = await User.find({
                $or: [
                    { fullName: { $regex: "admin", $options: "i" } },
                    { userName: { $regex: "admin", $options: "i" } }
                ]
            }).select('_id');
    
            const franchiseeIds = franchisees.map(franchisee => franchisee._id);
            filter.$or = [
                { franchisee: { $in: franchiseeIds } }, // Применяем $in к полю franchisee
                { transferredFranchise: { $regex: "admin", $options: "i" } } // Фильтр по transferredFranchise
            ];
        }

        const totalClients = await Client.countDocuments({...filter, "verify.status": "waitingVerification"})

        const clients = await Client.find({...filter, "verify.status": "waitingVerification"})
            .populate("franchisee", "fullName")
            .skip(skip)
            .limit(limit);

        res.json({ clients, totalClients })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getDenyVerfifcation = async (req, res) => {
    try {
        const id = req.userId;
        const {searchF} = req.body

        const franchisee = await User.findById(id)
        const filter = {"verify.status": "denyVerification"}

        if (searchF !== "") {
            const regex = new RegExp(searchF, "i"); 
            const filterF = [
                { fullName: { $regex: regex } },
                { userName: { $regex: regex } },
            ]; 
            const searchFranchisee = await User.findOne(filterF)
            filter.franchisee = searchFranchisee._id
        }
        
        if (franchisee.role === "admin") {
            filter.franchisee = id
        }
        
        const clients = await Client.find(filter).populate("franchisee", "fullName")

        res.json({ clients })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const checkClientsCoincidences = async (req, res) => {
    try {
        const clients = await Client.find({ "verify.status": "verified" }).sort({ createdAt: 1 });

        for (let i = 0; i < clients.length - 1; i++) {
            const client1 = clients[i];

            for (let j = i + 1; j < clients.length; j++) {
                const client2 = clients[j];

                // Проверяем, что franchisee разные
                if (client1.franchisee.toString() === client2.franchisee.toString()) {
                    continue; // Пропускаем эту пару клиентов
                }

                // Условия совпадения
                let matchedField = "";

                // Сравнение телефона
                if (client1.phone && client1.phone === client2.phone) {
                    matchedField += "phone ";
                }

                // Сравнение почты
                if (client1.mail && client1.mail === client2.mail) {
                    matchedField += "mail ";
                }

                // Сравнение адресов
                if (
                    client1.addresses.some((addr1) =>
                        client2.addresses.some((addr2) => addr1.id2Gis && addr1.id2Gis === addr2.id2Gis)
                    )
                ) {
                    matchedField += "addresses ";
                }

                // Если есть совпадения
                if (matchedField) {
                    const existingNotification = await Notification.findOne({
                        first: client1.franchisee,
                        second: client2.franchisee,
                        matchesType: "client",
                        firstObject: client1._id,
                        secondObject: client2._id,
                    });

                    if (!existingNotification) {
                        const notDoc = new Notification({
                            first: client1.franchisee,
                            second: client2.franchisee,
                            matchesType: "client",
                            matchedField,
                            firstObject: client1._id,
                            secondObject: client2._id,
                        });

                        await notDoc.save();
                        global.io.emit("clientMatch", { message: "Есть совпадение клиентов" });
                    }
                }
            }
        }

        res.status(200).json({ message: "Проверка клиентов завершена успешно." });
    } catch (error) {
        console.error("Ошибка при проверке совпадений клиентов:", error.message);
        res.status(500).json({ message: "Что-то пошло не так" });
    }
};

export const updateClientData2 = async (req, res) => {
    try {
        const clients = await Client.find({
            "verify.status": "verified",
            addresses: {
              $elemMatch: { id2Gis: { $in: [null, undefined] } },
            },
          });

          for (const client of clients) {
            const clientAddresses = client.addresses;

            // Функция для получения ID 2GIS по адресу
            const fetchAddressId = async (item) => {
                try {
                    const response = await axios.get('https://catalog.api.2gis.com/3.0/items/geocode', {
                        params: {
                            fields: "items.point",
                            key: "f5af220d-c60a-4cf6-a350-4a953c324a3d",
                            q: `Алматы, ${item.street}`,
                        },
                    });
                    console.log("response.data.result", response.data.result);
                    
                    return response.data.result.items[0]?.id || null; // Возвращаем ID или null
                } catch (error) {
                    console.log(`Невозможно найти адрес: ${item.street}`);
                    return null;
                }
            };

            // Получаем IDs для всех адресов
            const addressIds = await Promise.allSettled(clientAddresses.map(fetchAddressId));
            addressIds.forEach((result, index) => {
                clientAddresses[index].id2Gis = result.status === "fulfilled" ? result.value : null;
            });

            // Сохраняем обновленный документ клиента
            client.addresses = clientAddresses; // Перезаписываем массив addresses
            await client.save();

            // Проверяем совпадения с другими клиентами
            let orConditions = [];
            if (client.phone !== "") {
                orConditions.push({ phone: client.phone, franchisee: { $ne: client.franchisee } });
            }
            if (client.mail !== "") {
                orConditions.push({ mail: client.mail, franchisee: { $ne: client.franchisee } });
            }
            client.addresses.forEach((address) => {
                console.log(address.id2Gis);
                
                orConditions.push({
                    addresses: {
                    $elemMatch: {
                        id2Gis: address.id2Gis,
                    },
                    },
                    franchisee: { $ne: client.franchisee },
                });
            });

            const clientId = client._id

            let existingClients = null;
            existingClients = await Client.findOne({
                $or: orConditions,
                "verify.status": "verified",
                _id: { $ne: clientId }, // исключаем текущего клиента из поиска
            });

            // Если найдены совпадения, создаем уведомление
            if (existingClients) {
                let matchedField = "";
                if (existingClients.phone === client.phone && client.phone !== "") {
                    matchedField += "phone ";
                }
                if (existingClients.mail === client.mail && client.mail !== "") {
                    matchedField += "mail ";
                }
                if (existingClients.addresses.some((addr) => addr.id2Gis && client.addresses.some((newAddr) => addr.id2Gis === newAddr.id2Gis))) {
                    matchedField += "addresses ";
                }
        
                const notDoc = new Notification({
                    first: existingClients.franchisee,
                    second: client.franchisee,
                    matchesType: "client",
                    matchedField,
                    firstObject: existingClients._id,
                    secondObject: client._id
                });
        
                await notDoc.save();
        
                const notification = {
                    message: "Есть совпадение клиентов",
                };
        
                global.io.emit("clientMatch", notification);
            }
        }

        res.json({ success: true, message: "Данные успешно изменены" });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};