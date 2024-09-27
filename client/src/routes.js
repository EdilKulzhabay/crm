import { createBrowserRouter, Navigate } from "react-router-dom";
import AddClient from "./Pages/AddClient";
import AdminMain from "./Pages/Admin/AdminMain";
import CourierMain from "./Pages/Courier/CourierMain";
import Login from "./Pages/Login";
import SuperAdmin from "./Pages/SuperAdmin/SuperAdmin";
import SuperAdminAddFranchisee from "./Pages/SuperAdmin/SuperAdminAddFranchisee";
import SuperAdminFranchiseeList from "./Pages/SuperAdmin/SuperAdminFranchiseeList";
import SuperAdminSubscription from "./Pages/SuperAdmin/SuperAdminSubscription";
import SuperAdminUpdateFranchisee from "./Pages/SuperAdmin/SuperAdminUpdateFranchisee";
import ClientPage from "./Pages/ClientPage";
import CourierPage from "./Pages/CourierPage";
import AddCourier from "./Pages/AddCourier";
import ClientList from "./Pages/ClientList";
import CourierList from "./Pages/CourierList";
import SuperAdminSettings from "./Pages/SuperAdmin/SuperAdminSettings";
import SuperAdminAddFranchizer from "./Pages/SuperAdmin/SuperAdminAddFranchizer";
import SuperAdminClientManagment from "./Pages/SuperAdmin/SuperAdminClientManagment";
import AddPromoCode from "./Pages/AddPromoCode";
import PromoCodeList from "./Pages/PromoCodeList";
import AddOrder from "./Pages/AddOrder";
import OrderList from "./Pages/OrderList";
import OrderPage from "./Pages/OrderPage";
import AdminSettings from "./Pages/Admin/AdminSettings";
import SuperAdminCoincidence from "./Pages/SuperAdmin/SuperAdminCoincidence";
import SuperAdminCoincidencePage from "./Pages/SuperAdmin/SuperAdminCoincidencePage";
import CompletedOrders from "./Pages/CompletedOrders";
import CourierSettings from "./Pages/Courier/CourierSettings";
import PrivateRoute from "./Components/PrivateRoute";

export const router = createBrowserRouter([
    { path: "/login", element: <Login /> },

    
    { path: "/addClinet", element: <PrivateRoute element={<AddClient />} />  },
    { path: "/ClientPage/:id", element: <ClientPage /> },
    { path: "/CourierPage/:id", element: <CourierPage /> },
    { path: "/addCourier", element: <AddCourier /> },
    { path: "/clients", element: <ClientList /> },
    { path: "/couriers", element: <CourierList /> },
    { path: "/addPromoCode", element: <AddPromoCode /> },
    { path: "/promoCodeList", element: <PromoCodeList /> },
    { path: "/addOrder", element: <AddOrder /> },
    { path: "/addOrder/:id", element: <AddOrder /> },
    { path: "/orderList", element: <OrderList /> },
    { path: "/orderPage/:id", element: <OrderPage /> },
    { path: "/completedOrders", element: <CompletedOrders /> },

    ////SUPERADMINLINKS
    { path: "/superAdmin", element: <SuperAdmin /> },
    { path: "/franchiseeList", element: <SuperAdminFranchiseeList /> },
    { path: "/addFranchisee", element: <SuperAdminAddFranchisee /> },
    { path: "/updateFranchisee/:id", element: <SuperAdminUpdateFranchisee /> },
    { path: "/subsciption", element: <SuperAdminSubscription /> },
    { path: "/superAdminSettings", element: <SuperAdminSettings /> },
    { path: "/superAdminAddFranchizer", element: <SuperAdminAddFranchizer /> },
    {
        path: "/superAdminClientManagment",
        element: <SuperAdminClientManagment />,
    },
    { path: "/superAdminCoincidence", element: <SuperAdminCoincidence /> },
    { path: "/superAdminCoincidencePage/:id", element: <SuperAdminCoincidencePage /> },

    ////ADMINLINKS
    { path: "/admin", element: <AdminMain /> },
    { path: "/adminSettings", element: <AdminSettings /> },
    

    ////COURIERLINKS
    { path: "/courier", element: <CourierMain /> },
    { path: "/courierSettings", element: <CourierSettings/> },
    { path: "*", element: <Navigate to="/login" replace /> },
]);
