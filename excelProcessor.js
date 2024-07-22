import XLSX from "xlsx";
import Client from "./Models/Client.js"; // путь к вашей модели Client

export const processExcelFile = async (filePath) => {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    console.log(worksheet);

    // const clients = worksheet.map((row) => ({
    //     fullName: row.fullName,
    //     phone: row.phone,
    //     mail: row.mail,
    //     addresses: [
    //         {
    //             street: row.street,
    //             link: row.link,
    //             house: row.house,
    //         },
    //     ],
    //     price19: row.price19,
    //     price12: row.price12,
    //     status: row.status || "active",
    //     franchisee: row.franchisee, // assuming you have ObjectId values in your Excel file
    // }));

    await Client.insertMany(clients);
};
