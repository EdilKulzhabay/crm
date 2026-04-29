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
    InvoiceCounterController,
    MobileAppSettingsController,
    BussinessCenterController,
} from "./Controllers/index.js";
import checkAuth from "./utils/checkAuth.js";
import multer from "multer";
import paymentRoutes from "./paymentRoutes.js";
import { processExcelFile } from "./excelProcessor.js";
import checkRole from "./utils/checkRole.js";
import checkAuthAggregator from "./utils/checkAuthAggregator.js";
import {
    startWhatsAppWebClient,
    shutdownWhatsAppWeb,
} from "./whatsApp/waWebClient.js";

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
app.get("/getInvoiceGlobalCounter", checkAuth, InvoiceCounterController.getInvoiceGlobalCounter);
app.post("/setInvoiceGlobalCounter", checkAuth, InvoiceCounterController.setInvoiceGlobalCounter);
app.get("/getMobileOrderCutoffSettings", checkAuth, MobileAppSettingsController.getMobileOrderCutoffSettings);
app.post("/setMobileOrderCutoffSettings", checkAuth, MobileAppSettingsController.setMobileOrderCutoffSettings);

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
app.post("/generateInvoicePdfMobile", MobileController.generateInvoicePdfMobile);
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
app.post("/removeFcmToken", MobileController.removeFcmToken)
app.post("/getOrderDataMobile", MobileController.getOrderDataMobile)
app.post("/cancelOrderMobile", MobileController.cancelOrderMobile)
app.post("/updateOrderDataMobile", MobileController.updateOrderDataMobile)
app.post("/getLastOrderMobile", MobileController.getLastOrderMobile)
app.post("/requestMasterCallMobile", MobileController.requestMasterCallMobile)
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

///////PAYMENT (Pay Plus → API ventrapay.net)
app.use("/api/payment", paymentRoutes);
app.post(
    "/getClientPaymentsForSuperAdmin",
    checkAuth,
    PaymentController.getClientPaymentsForSuperAdmin
);


///////BUSSINESSCENTER
app.post("/getActiveCourierAggregatorsForBussinessCenter", BussinessCenterController.getActiveCourierAggregatorsForBussinessCenter)
app.post("/getActiveOrdersForBussinessCenter", BussinessCenterController.getActiveOrdersForBussinessCenter)
app.post("/getCompletedOrdersForBussinessCenter", BussinessCenterController.getCompletedOrdersForBussinessCenter)
app.post("/getCancelledOrdersForBussinessCenter", BussinessCenterController.getCancelledOrdersForBussinessCenter)

server.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);

    if (process.env.WHATSAPP_WEB_AUTOSTART !== "false") {
        console.log(
            "[WhatsApp OTP] Автозапуск WhatsApp Web-клиента (QR в консоли при первом входе)"
        );
        startWhatsAppWebClient().catch((e) =>
            console.error("[WhatsApp Web] Ошибка старта:", e?.message || e)
        );
    }
});

const gracefulShutdown = async () => {
    await shutdownWhatsAppWeb();
    process.exit(0);
};
process.once("SIGINT", gracefulShutdown);
process.once("SIGTERM", gracefulShutdown);