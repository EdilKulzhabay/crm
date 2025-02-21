import XLSX from "xlsx";
import Client from "./Models/Client.js"; 
import Notification from "./Models/Notification.js"; 

export const processExcelFile = async (filePath, id) => {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        for (const row of worksheet) {
            try {
                // Извлекаем данные из строки
                const fullName = row.fullName || "";
                const userName = row.userName || "";
                const phone = row.phone || "";
                const mail = row.mail || "";
                const franchisee = id;
                const addresses = [
                    {
                        street: row.adress || "",
                        house: row.house || ""
                    }
                ];
        
                // Условие для поиска существующего клиента
                let orConditions = [];

                if (fullName) {
                    orConditions.push({ fullName: fullName, franchisee: { $ne: franchisee } });
                }
                if (userName) {
                    orConditions.push({ userName: userName, franchisee: { $ne: franchisee } });
                }
                if (phone) {
                    orConditions.push({ phone: phone, franchisee: { $ne: franchisee } });
                }
                if (mail) {
                    orConditions.push({ mail: mail, franchisee: { $ne: franchisee } });
                }

                if (addresses.length > 0) {
                    addresses.forEach((address) => {
                        orConditions.push({
                            addresses: {
                                $elemMatch: {
                                    street: address.street,
                                    house: address.house,
                                },
                            },
                            franchisee: { $ne: franchisee },
                        });
                    });
                }
        
                const existingClient = await Client.findOne({ $or: orConditions });
        
                const encodedAddress = encodeURIComponent(row.adress);
        
                // Создаём нового клиента
                const newClient = {
                    fullName: row.fullName || "",
                    userName: row.userName || "",
                    phone: row.phone || "",
                    mail: row.mail || "",
                    region: row.region || "",
                    addresses: [
                        {
                            street: row.adress || "",
                            link: `https://2gis.kz/almaty/search/${encodedAddress}`,
                            house: row.house || "",
                        },
                    ],
                    price19: row.price19 || "",
                    price12: row.price12 || "",
                    status: row.status || "",
                    franchisee: id || "",
                    opForm: row.opForm || "",
                    type: row.type === "ЮЛ" ? false : true
                };
        
                await Client.create(newClient);
        
                if (existingClient) {
                    let matchedField = "";
        
                    if (existingClient.mail === mail && mail !== "")
                        matchedField = "mail ";
                    if (existingClient.fullName === fullName)
                        matchedField += "fullName ";
                    if (existingClient.userName === userName)
                        matchedField += "userName ";
                    if (existingClient.phone === phone) matchedField += "phone ";
        
                    const notDoc = new Notification({
                        first: existingClient.franchisee,
                        second: franchisee,
                        matchesType: "client",
                        matchedField,
                        firstObject: existingClient._id,
                        secondObject: newClient._id,
                    });
        
                    await notDoc.save();
        
                    const notification = {
                        message: "Есть совпадение клиентов",
                    };
        
                    global.io.emit("clientMatch", notification);
                }
            } catch (err) {
                console.error(`Error processing row for phone ${row.phone}:`, err.message);
            }
        }
        
    } catch (err) {
        console.error('Error reading the Excel file:', err.message);
        throw new Error('Failed to process Excel file');
    }
};
