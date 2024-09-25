import XLSX from "xlsx";
import Client from "./Models/Client.js"; // путь к вашей модели Client

export const processExcelFile = async (filePath, id) => {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (const row of worksheet) {
        const existingClient = await Client.findOne({ phone: row.phone });

        if (!existingClient) {
            const encodedAddress = encodeURIComponent(row.adress);
            const newClient = {
                fullName: row.fullName,
                userName: row.userName,
                phone: row.phone || "",
                mail: row.mail,
                addresses: [
                    {
                        street: row.adress || "",
                        link: `https://2gis.kz/almaty/search/${encodedAddress}`,
                        house: row.house || "",
                    },
                ],
                price19: row.price19,
                price12: row.price12,
                status: row.status,
                franchisee: id,
                opForm: row.opForm
            };

            await Client.create(newClient);
        } else {
            console.log(
                `Клиент с номером телефона ${row.phone} уже существует`
            );
        }
    }
};
