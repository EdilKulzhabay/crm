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
    OtherController,
    PromoCodeController,
    OrderController,
    MobileController,
    NotificationController,
    DepartmentController,
    AnalyticsController,
    CourierAggregatorController,
    AquaMarketController,
    FaqController,
    PaymentController,
} from "./Controllers/index.js";
import checkAuth from "./utils/checkAuth.js";
import multer from "multer";
import { processExcelFile } from "./excelProcessor.js";
import checkRole from "./utils/checkRole.js";
import checkAuthAggregator from "./utils/checkAuthAggregator.js";

// Импортируем функцию оптимизации маршрутов
// import { optimizedZoneBasedDistribution } from "./optimizeRoutesWithTSP.js";
// import queueOrTools, { getQueueStatus, clearQueue } from "./orToolsQueue.js";
// import testOrTools from "./testOrTools.js";

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
app.use(express.text());
app.use(express.urlencoded({ extended: true })); // Для поддержки URL-encoded данных
app.use(
    cors({
        origin: "*",
    })
);
app.use("/static", express.static("/home/ubuntu/crm"));


const upload = multer({ dest: "uploads/" });
const uploadAccessoriseImages = multer({ dest: "accessoriesImages/" });

app.post("/api/upload-excel", upload.single("file"), checkAuth, async (req, res) => {
    try {
        const id = req.userId;
        const filePath = req.file.path;
        await processExcelFile(filePath, id);
        res.json({ success: true, message: "File processed successfully" });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error processing file",
        });
    }
});

app.post("/api/upload-accessoriesImages", uploadAccessoriseImages.single("file"), checkAuth, async (req, res) => {
    try {
        const filePath = req.file.path;
        await processExcelFile(filePath, id);
        res.json({ success: true, message: "File processed successfully" });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error processing file",
        });
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

    socket.on("join", (id, userName) => {
        socket.join(id);
        console.log("user ", userName, " joined room ");
    });

    socket.on("leave", (userId) => {
        console.log(`User ${userId} left.`);
        socket.leave(userId); // Убираем клиента из комнаты
    });

    // Пример приёма сообщения от клиента
    socket.on("sendMessage", (message) => {
        console.log(message);
    });

    socket.on("disconnect", () => {
        console.log("User has disconnected");
    });
});

//////OTHER

app.get("/getAllUsersNCouriers", OtherController.getAllUsersNCouriers);
app.get("/getMainPageInfo", checkAuth, OtherController.getMainPageInfo);
app.get("/getMainPageInfoSA", checkAuth, OtherController.getMainPageInfoSA);
app.post("/deleteUser", checkAuth, OtherController.deleteUser);
app.post("/addPickup", OtherController.addPickup);
app.post("/getPickupInfo", OtherController.getPickupInfo)
app.post("/sendNotificationToClients", OtherController.sendNotificationToClients)
app.post("/sendNotification", OtherController.sendNotification)
app.post("/getClientsWithPushToken", OtherController.getClientsWithPushToken)
app.get("/getSupportContacts", OtherController.getSupportContacts)
app.post("/deleteSupportContact", OtherController.deleteSupportContact)
app.post("/getSupportMessagesAdmin", OtherController.getSupportMessagesAdmin)

/////USER
app.get("/getMe", checkAuth, UserController.getMe);
app.get("/getAllFranchisee", UserController.getAllFranchisee);
app.get("/getAllFranchiseeforChangeClientFranchisee", UserController.getAllFranchiseeforChangeClientFranchisee);
app.post("/register", UserController.register);
app.post("/login", UserController.login);
app.post("/getFranchiseeById", UserController.getFranchiseeById);
app.post("/updateFranchisee", UserController.updateFranchisee);
app.post("/deleteFranchisee", UserController.deleteFranchisee);
app.post("/searchFrinchisee", UserController.searchFrinchisee);
app.post("/changePassword", checkAuth, UserController.changePassword);
app.post(
    "/updateNotificationStatus",
    checkAuth,
    UserController.updateNotificationStatus
);
app.post(
    "/updateNotificationTypes",
    checkAuth,
    UserController.updateNotificationTypes
);
app.post("/getFranchiseeClients", UserController.getFranchiseeClients);
app.post("/updateFranchiseeDataB", UserController.updateFranchiseeDataB);

//////Subscriptions
app.get("/getAllSubscriptions", SubscriptionController.getAllSubscriptions);
app.post("/addSubscription", SubscriptionController.addSubscription);
app.post("/getSubscriptionById", SubscriptionController.getSubscriptionById);
app.post("/deleteSubscription", SubscriptionController.deleteSubscription);

///////CLIENT
app.get("/getFreeInfo", checkAuth, ClientController.getFreeInfo);
app.post("/getDenyVerfifcation", checkAuth, ClientController.getDenyVerfifcation);
app.post("/addClient", ClientController.addClient);
app.post("/getClients", checkAuth, ClientController.getClients);
app.post("/searchClient", checkAuth, ClientController.searchClient);
app.post("/deleteClient", ClientController.deleteClient);
app.post("/deleteClientAdmin", ClientController.deleteClientAdmin);
app.post("/getClientDataForId", ClientController.getClientDataForId);
app.post("/deleteClientAdress", ClientController.deleteClientAdress);
app.post("/updateClientData", ClientController.updateClientData);
app.post("/updateClientFranchisee", ClientController.updateClientFranchisee);
app.post("/getClientsForExcel", checkAuth, ClientController.getClientsForExcel);
app.post("/getNotVerifyClients", ClientController.getNotVerifyClients);
app.post("/clientAddPassword", ClientController.clientAddPassword);
app.get("/checkClientsCoincidences", ClientController.checkClientsCoincidences)
app.get("/addPhoneForAddress", ClientController.addPhoneForAddress)
app.post("/transferOrders", ClientController.transferOrders)

///////COURIER
app.get("/getFreeInfoCourier", checkAuth, CourierController.getFreeInfoCourier);
app.get("/getFirstOrderForToday", checkAuth, CourierController.getFirstOrderForToday);
app.get("/getCourierRating", checkAuth, CourierController.getCourierRating);
app.post("/updateOrderList", checkAuth, CourierController.updateOrderList);
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
app.post("/getActiveOrdersCourier", CourierController.getActiveOrdersCourier)
app.post("/getDeliveredOrdersCourier", CourierController.getDeliveredOrdersCourier)
app.post("/getDeliveredOrdersCourierTagCounts", CourierController.getDeliveredOrdersCourierTagCounts)
app.post("/updateCourierOrderStatus", checkAuth, CourierController.updateCourierOrderStatus)

///////PROMOCODE
app.post("/addPromoCode", PromoCodeController.addPromoCode);
app.post("/getPromoCodes", PromoCodeController.getPromoCodes);
app.post("/searchPromoCode", PromoCodeController.searchPromoCode);
app.post("/deletePromoCode", PromoCodeController.deletePromoCode);

///////ORDER
app.get("/getFreeInfoOrder", checkAuth, OrderController.getFreeInfoOrder);
app.get("/clearOrdersForAggregator", OrderController.clearOrdersForAggregator)
app.post("/getAdditionalOrders", checkAuth, OrderController.getAdditionalOrders);
app.get("/getActiveOrdersKol", checkAuth, OrderController.getActiveOrdersKol)
app.post("/addOrder", checkAuth, OrderController.addOrder);
app.post("/addOrder2", checkAuth, checkRole(["user"]), OrderController.addOrder2);
app.post("/getOrders", checkAuth, OrderController.getOrders);
app.post("/getClientOrders", OrderController.getClientOrders);
app.post("/getOrdersForExcel", checkAuth, OrderController.getOrdersForExcel);
app.post("/getClientOrdersForExcel", checkAuth, OrderController.getClientOrdersForExcel);
app.post("/getOrderDataForId", OrderController.getOrderDataForId);
app.post("/updateOrder", checkAuth, OrderController.updateOrder);
app.post("/updateOrderTransfer", OrderController.updateOrderTransfer);
app.post("/getCompletedOrders", checkAuth, OrderController.getCompletedOrders)
app.post("/deleteOrder", checkAuth, OrderController.deleteOrder)
app.post("/getOrdersForAggregator", OrderController.getOrdersForAggregator)
app.get("/fixRinat", OrderController.fixRinat)
app.post("/getCancelledOrders", OrderController.getCancelledOrders)
app.get("/getCancelledOrdersCount", OrderController.getCancelledOrdersCount)
app.get("/getResultForToday", OrderController.getResultForToday)
app.post("/toTomorrow", OrderController.toTomorrow)
app.post("/addOrderToAggregator", OrderController.addOrderToAggregator)
app.get("/getAllOrderForToday", OrderController.getAllOrderForToday)
app.get("/fixOrdersSum", OrderController.fixOrdersSum)
//////DEPARTMENT
app.get("/getDepartments", DepartmentController.getDepartments)
app.get("/getFirstQueue", DepartmentController.getFirstQueue)
app.get("/departmentSkip", DepartmentController.departmentSkip)
app.post("/addDepartment", DepartmentController.addDepartment)
app.post("/getDepartmentData", DepartmentController.getDepartmentData)
app.post("/updateDepartmentData", DepartmentController.updateDepartmentData)
app.post("/deleteDepartment", DepartmentController.deleteDepartment)
app.post("/departmentAction", DepartmentController.departmentAction)
app.post("/getDepartmentHistory", DepartmentController.getDepartmentHistory)
app.post("/getDepartmentInfo", DepartmentController.getDepartmentInfo)
app.post("/getDepartmentInfoFranchisee", DepartmentController.getDepartmentInfoFranchisee)
app.post("/deleteDepartmentHistory", DepartmentController.deleteDepartmentHistory)
app.post("/getReceivHistory", DepartmentController.getReceivHistory)
app.post("/syncFranchiseeCourierData", DepartmentController.syncFranchiseeCourierData)

////////NOTIFICATION
app.post("/getNotifications", NotificationController.getNotifications);
app.post("/getNotificationDataForId", NotificationController.getNotificationDataForId);
app.post("/deleteNotification", NotificationController.deleteNotification);


//////MOBILE
app.post("/sendMail", MobileController.sendMail);
app.post("/sendMailRecovery", MobileController.sendMailRecovery);
app.post("/codeConfirm", MobileController.codeConfirm);
app.post("/clientRegister", MobileController.clientRegister);
app.post("/clientLogin", MobileController.clientLogin);
app.post("/updateForgottenPassword", MobileController.updateForgottenPassword);
app.post("/addClientAddress", checkAuth, MobileController.addClientAddress);
app.post("/updateClientAddress", checkAuth, MobileController.updateClientAddress);
app.post("/getClientAddresses", checkAuth, MobileController.getClientAddresses);
app.post("/getClientDataMobile", MobileController.getClientDataMobile);
app.post("/updateClientDataMobile", MobileController.updateClientDataMobile);
app.post("/sendSupportMessage", MobileController.sendSupportMessage);
app.post("/getSupportMessages", MobileController.getSupportMessages);
app.post("/replyToSupportMessage", MobileController.replyToSupportMessage);
app.post("/deleteClientMobile", MobileController.deleteClientMobile);
app.post("/createTestAccount", MobileController.createTestAccount);
app.post("/refreshToken", MobileController.refreshToken);
app.post("/logOutClient", MobileController.logOutClient);
app.post("/addOrderClientMobile", MobileController.addOrderClientMobile);
app.post("/getActiveOrdersMobile", MobileController.getActiveOrdersMobile);
app.post("/getClientOrdersMobile", MobileController.getClientOrdersMobile);
app.post("/getCourierLocation", MobileController.getCourierLocation)
app.post("/saveFcmToken", MobileController.saveFcmToken)
app.post("/getOrderDataMobile", MobileController.getOrderDataMobile)
app.post("/cancelOrderMobile", MobileController.cancelOrderMobile)
app.post("/updateOrderDataMobile", MobileController.updateOrderDataMobile)
app.post("/getLastOrderMobile", MobileController.getLastOrderMobile)
app.post("/codeConfirmForgotPassword", MobileController.codeConfirmForgotPassword)
app.post("/sendMailForgotPassword", MobileController.sendMailForgotPassword)
////////ANALYTICS
app.post("/getAnalyticsData", AnalyticsController.getAnalyticsData)
app.post("/getChartByOp", AnalyticsController.getChartByOp)
app.post("/getClientsByOpForm", AnalyticsController.getClientsByOpForm)
app.post("/getAdditionalRevenue", AnalyticsController.getAdditionalRevenue)
app.post("/getFranchiseeAnalytics", AnalyticsController.getFranchiseeAnalytics)
app.post("/getSAGeneralInfo", AnalyticsController.getSAGeneralInfo)

/////////////COURIERAGGREGATOR
app.post("/courierAggregatorTestLog", CourierAggregatorController.courierAggregatorTestLog)
app.get("/getCourierAggregatorData", checkAuthAggregator, CourierAggregatorController.getCourierAggregatorData)
app.get("/appointmentFranchisee", CourierAggregatorController.appointmentFranchisee)
app.get("/getCourierAggregatorIncome", checkAuthAggregator, CourierAggregatorController.getCourierAggregatorIncome)
app.post("/createCourierAggregator", CourierAggregatorController.createCourierAggregator)
app.post("/courierAggregatorSendCode", CourierAggregatorController.courierAggregatorSendCode)
app.post("/getCourierAggregatorDataForAdmin", CourierAggregatorController.getCourierAggregatorDataForAdmin)
app.post("/courierAggregatorCodeConfirm", CourierAggregatorController.courierAggregatorCodeConfirm)
app.post("/courierAggregatorLogin", CourierAggregatorController.courierAggregatorLogin)
app.post("/courierAggregatorRegister", CourierAggregatorController.courierAggregatorRegister)
app.post("/updateCourierAggregatorData", CourierAggregatorController.updateCourierAggregatorData)
app.post("/updateCourierAggregatorDataFull", CourierAggregatorController.updateCourierAggregatorDataFull)
app.post("/completeOrderCourierAggregator", checkAuthAggregator, CourierAggregatorController.completeOrderCourierAggregator)
app.post("/getCourierAggregatorOrdersHistory", checkAuthAggregator, CourierAggregatorController.getCourierAggregatorOrdersHistory)
app.post("/cancelOrderCourierAggregator", checkAuthAggregator, CourierAggregatorController.cancelOrderCourierAggregator)
app.post("/getCourierAggregators", CourierAggregatorController.getCourierAggregators)
app.post("/getOrdersWithCourierAggregator", CourierAggregatorController.getOrdersWithCourierAggregator)
app.post("/getCompletedOrCancelledOrdersFromCourierAggregator", CourierAggregatorController.getCompletedOrCancelledOrdersFromCourierAggregator)
app.post("/clearCourierAggregatorOrders", CourierAggregatorController.clearCourierAggregatorOrders)
app.get("/getActiveCourierAggregators", CourierAggregatorController.getActiveCourierAggregators)
app.get("/getAllCouriersWithOrderCount", CourierAggregatorController.getAllCouriersWithOrderCount)
app.post("/assignOrderToCourier", CourierAggregatorController.assignOrderToCourier)
app.post("/removeOrderFromCourier", CourierAggregatorController.removeOrderFromCourier)
app.post("/resendNotificationToCourier", CourierAggregatorController.resendNotificationToCourier)
app.post("/updateCourierOrdersSequence", CourierAggregatorController.updateCourierOrdersSequence)
app.post("/resetCourierOrders", CourierAggregatorController.resetCourierOrders)
app.post("/needToGiveTheOrderToCourier", CourierAggregatorController.needToGiveTheOrderToCourier)
app.post("/testPushNotificationClient", CourierAggregatorController.testPushNotificationClient)
/////////////AQUAMARKET
app.post("/addAquaMarket", AquaMarketController.addAquaMarket)
app.post("/getAquaMarkets", AquaMarketController.getAquaMarkets)
app.post("/getAquaMarketData", AquaMarketController.getAquaMarketData)
app.post("/updateAquaMarketData", AquaMarketController.updateAquaMarketData)
app.post("/deleteAquaMarket", AquaMarketController.deleteAquaMarket)
app.post("/getAquaMarketHistory", AquaMarketController.getAquaMarketHistory)
app.post("/aquaMarketAction", AquaMarketController.aquaMarketAction)
app.post("/aquaMarketFill", AquaMarketController.aquaMarketFill)
app.post("/aquaMarketLogin", AquaMarketController.aquaMarketLogin)

///////FAQ
app.post("/addFaq", FaqController.addFaq);
app.get("/getFaq", FaqController.getFaq);
app.post("/updateFaq", FaqController.updateFaq);
app.post("/deleteFaq", FaqController.deleteFaq);

///////PAYMENT (Hillstarpay)
// Создание ссылки для оплаты заказа
app.post("/api/payment/create", PaymentController.createPaymentLink);
app.post("/api/payment/get-client-by-email", PaymentController.getClientByEmail);
app.post("/api/payment/charge-saved-card", PaymentController.chargeWithSavedCard);
// Конфигурация для JS-виджета оплаты
app.post("/api/payment/widget-config", PaymentController.getWidgetConfig);
// Страница виджета (HTML с origin api.tibetskayacrm.kz)
app.get("/api/payment/widget-page", PaymentController.getWidgetPage);
// Callback URL для обработки результата платежа (без авторизации)
// Поддерживаем URL-encoded, form-data и JSON форматы
// Для form-data используем multer().none(), для остальных - express.urlencoded() и express.json()
app.post("/api/payment/callback", multer().none(), PaymentController.handlePaymentCallback);
// Success URL - перенаправление после успешного платежа
app.get("/api/payment/success", PaymentController.handlePaymentSuccess);
// Error URL - перенаправление после неуспешного платежа
app.get("/api/payment/error", PaymentController.handlePaymentError);

// app.get("/testOrTools", async (req, res) => {
//     try {
//         // Сначала отправляем ответ клиенту
//         res.json({ success: true, message: "orTools запущен в фоновом режиме" }); 
        
//         // Затем запускаем orTools в фоне
//         try {
//             await testOrTools();
//         } catch (queueError) {
//             console.error("Ошибка в очереди orTools:", queueError);
//         }
//     } catch (error) {
//         // Если ответ еще не отправлен, отправляем ошибку
//         if (!res.headersSent) {
//             res.status(500).json({
//                 success: false,
//                 message: "Error executing Python script",
//                 error: error.message
//             });
//         } else {
//             console.error("Ошибка в orTools:", error);
//         }
//     }
// });

/////////////ORTOOLS
// app.get("/orTools", async (req, res) => {
//     try {
//         // Сначала отправляем ответ клиенту
//         res.json({ success: true, message: "orTools запущен в фоновом режиме" }); 
        
//         // Затем запускаем orTools в фоне
//         try {
//             await queueOrTools('api_request');
//         } catch (queueError) {
//             console.error("Ошибка в очереди orTools:", queueError);
//         }
//     } catch (error) {
//         // Если ответ еще не отправлен, отправляем ошибку
//         if (!res.headersSent) {
//             res.status(500).json({
//                 success: false,
//                 message: "Error executing Python script",
//                 error: error.message
//             });
//         } else {
//             console.error("Ошибка в orTools:", error);
//         }
//     }
// });

// app.get("/orTools/status", async (req, res) => {
//     try {
//         const status = getQueueStatus();
//         res.json({ success: true, status });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "Error getting queue status",
//             error: error.message
//         });
//     }
// });

// app.get("/orTools/clear", async (req, res) => {
//     try {
//         clearQueue();
//         res.json({ success: true, message: "Queue cleared" });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "Error clearing queue",
//             error: error.message
//         });
//     }
// });

/////////////ROUTE OPTIMIZATION - TSP
// Endpoint для запуска оптимизации маршрутов
// app.get("/optimizeRoutes", async (req, res) => {
//     try {
//         console.log("🚀 Запуск оптимизации маршрутов через API");
        
//         const result = await optimizedZoneBasedDistribution("2025-07-01", false);
        
//         res.json({
//             success: true,
//             message: "Оптимизация маршрутов завершена",
//             data: result
//         });
//     } catch (error) {
//         console.error("❌ Ошибка при оптимизации маршрутов:", error);
//         res.status(500).json({
//             success: false,
//             message: "Ошибка при оптимизации маршрутов",
//             error: error.message
//         });
//     }
// });

// // Endpoint для получения статуса оптимизации (без авторизации для тестирования)
// app.get("/optimizeRoutes/status", async (req, res) => {
//     try {
//         const { date } = req.query;
        
//         // Здесь можно добавить логику проверки статуса оптимизации
//         res.json({
//             success: true,
//             message: "Сервис оптимизации маршрутов доступен",
//             currentDate: date || new Date().toISOString().split('T')[0]
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "Ошибка сервиса оптимизации",
//             error: error.message
//         });
//     }
// });

server.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
    
});