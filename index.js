import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import "dotenv/config";

import {
    UserController,
    SubscriptionController,
    ClientController,
    CourierController,
} from "./Controllers/index.js";
import checkAuth from "./utils/checkAuth.js";
import multer from "multer";
import { processExcelFile } from "./excelProcessor.js";

mongoose
    .connect(process.env.MONGOURL)
    .then(() => {
        console.log("Mongodb OK");
    })
    .catch((err) => {
        console.log("Mongodb Error", err);
    });

const app = express();
app.use(express.json());
app.use(
    cors({
        origin: "*",
    })
);

const upload = multer({ dest: "uploads/" });

app.post("/api/upload-excel", upload.single("file"), async (req, res) => {
    try {
        console.log("WEHERE");
        const filePath = req.file.path;
        await processExcelFile(filePath);
        res.status(200).json({ message: "File processed successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error processing file" });
    }
});

// const allowedOrigins = ["http://example.com", "http://anotherexample.com"];

// app.use(
//     cors({
//         origin: function (origin, callback) {
//             if (!origin || allowedOrigins.indexOf(origin) !== -1) {
//                 callback(null, true);
//             } else {
//                 callback(new Error("Not allowed by CORS"));
//             }
//         },
//     })
// );

// Создайте сервер на основе вашего приложения Express
const server = http.createServer(app);
// Передайте созданный сервер в Socket.IO
global.io = new Server(server, {
    cors: {
        origin: "*", // или укажите конкретные домены
    },
});

io.on("connection", (socket) => {
    console.log("New WebSocket connection");

    // Пример отправки сообщения клиенту
    socket.emit("message", "Welcome to the WebSocket server!");

    // Пример приёма сообщения от клиента
    socket.on("sendMessage", (message) => {
        console.log(message);
    });

    socket.on("disconnect", () => {
        console.log("User has disconnected");
    });
});

app.get("/getMe", checkAuth, UserController.getMe);
app.get("/getAllFranchisee", UserController.getAllFranchisee);
app.post("/register", UserController.register);
app.post("/login", UserController.login);
app.post("/getFranchiseeById", UserController.getFranchiseeById);
app.post("/updateFranchisee", UserController.updateFranchisee);
app.post("/deleteFranchisee", UserController.deleteFranchisee);
app.post("/searchFrinchisee", UserController.searchFrinchisee);

app.get("/getAllSubscriptions", SubscriptionController.getAllSubscriptions);
app.post("/addSubscription", SubscriptionController.addSubscription);
app.post("/getSubscriptionById", SubscriptionController.getSubscriptionById);
app.post("/deleteSubscription", SubscriptionController.deleteSubscription);

app.get("/getFreeInfo", checkAuth, ClientController.getFreeInfo);
app.post("/addClient", ClientController.addClient);
app.post("/getClients", checkAuth, ClientController.getClients);
app.post("/searchClient", checkAuth, ClientController.searchClient);
app.post("/deleteClient", ClientController.deleteClient);
app.post("/getClientDataForId", ClientController.getClientDataForId);
app.post("/deleteClientAdress", ClientController.deleteClientAdress);
app.post("/updateClientData", ClientController.updateClientData);

app.get("/getFreeInfoCourier", checkAuth, CourierController.getFreeInfoCourier);
app.post("/addCourier", CourierController.addCourier);
app.post("/getCouriers", checkAuth, CourierController.getCouriers);
app.post("/searchCourier", checkAuth, CourierController.searchCourier);
app.post(
    "/getCourierDataForId",
    checkAuth,
    CourierController.getCourierDataForId
);
app.post("/updateCourierData", CourierController.updateCourierData);
app.post("/deleteCourier", CourierController.deleteCourier);

server.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
