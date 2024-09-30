import XLSX from "xlsx";
import Client from "./Models/Client.js"; // path to your Client model

export const processExcelFile = async (filePath, id) => {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        for (const row of worksheet) {
            try {
                let orConditions = [
                    { fullName: fullName, franchisee: { $ne: franchisee } },
                    { userName: userName, franchisee: { $ne: franchisee } },
                    { phone: phone, franchisee: { $ne: franchisee } },
                    { mail: mail, franchisee: { $ne: franchisee } },
                ];

                if (addresses && addresses.length > 0) {
                    addresses.forEach((address) => {
                        orConditions.push({
                            addresses: {
                                $elemMatch: {
                                    street: address.street,
                                    house: address.house,
                                    link: address.link,
                                },
                            },
                            franchisee: { $ne: franchisee },
                        });
                    });
                }

                const existingClient = await Client.findOne({ $or: orConditions });
                

                if (!existingClient) {
                    const encodedAddress = encodeURIComponent(row.adress);
                    const newClient = {
                        fullName: row.fullName,
                        userName: row.userName,
                        phone: row.phone || "",
                        mail: row.mail,
                        region: row.region,
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
                    console.log(`Client with phone number ${row.phone} already exists`);
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
