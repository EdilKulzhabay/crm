import Client from "../Models/Client.js";
import Notification from "../Models/Notification.js";
import User from "../Models/User.js";

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

        const client = await Client.findById(id);

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
      client[field] = value;
      await client.save();
  
      // Проверяем совпадения с другими клиентами
      let orConditions = [];
      if (field === "phone" && value) {
        orConditions.push({ phone: value, franchisee: { $ne: client.franchisee } });
      }
      if (field === "addresses" && value.length > 0) {
        value.forEach((address) => {
          orConditions.push({
            addresses: {
              $elemMatch: {
                link: address.link,
              },
            },
            franchisee: { $ne: client.franchisee },
          });
        });
      }
  
      let existingClients = null;
      if (orConditions.length > 0) {
        existingClients = await Client.findOne({
          $or: orConditions,
          _id: { $ne: clientId }, // исключаем текущего клиента из поиска
        });
      }
  
      // Если найдены совпадения, создаем уведомление
      if (existingClients) {
        let matchedField = "";
        if (existingClients.phone === value && field === "phone")
          matchedField += "phone ";
        if (
          field === "addresses" &&
          existingClients.addresses.some((addr) =>
            value.some((newAddr) => addr.link === newAddr.link)
          )
        ) {
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
        const clients = await Client.find({
            createdAt: { $gte: '2024-11-07T00:00:40.208Z' },
            "verify.status": "waitingVerification"
        }).populate("franchisee", "fullName")

        res.json({ clients })
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
        console.log(id);
        
        const clients = await Client.find({
            franchisee: id,
            createdAt: { $gte: '2024-11-07T00:00:40.208Z' },
            "verify.status": "denyVerification"
        })

        console.log("clients: ", clients);
        

        res.json({ clients })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}
