import { useEffect, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import api from "../api";
import LinkButton from "../Components/LinkButton";
import useFetchUserData from "../customHooks/useFetchUserData"
import ChooseCourierAggregatorModal from "../Components/ChooseCourierAggregatorModal";
import useScrollPosition from "../customHooks/useScrollPosition";
import MySnackBar from "../Components/MySnackBar";

export default function DistributeOrders() {
    const scrollPosition = useScrollPosition();
    const userData = useFetchUserData();
    const [couriers, setCouriers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [completedOrders, setCompletedOrders] = useState([]);
    const [cancelledOrders, setCancelledOrders] = useState([]);
    const [showCompletedOrders, setShowCompletedOrders] = useState(false);
    const [showCancelledOrders, setShowCancelledOrders] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showAssignOrderModal, setShowAssignOrderModal] = useState(false);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const openAssignOrderModal = (orderId) => {
        setSelectedOrder(orderId);
        setShowAssignOrderModal(true);
    }

    const closeAssignOrderModal = () => {
        setShowAssignOrderModal(false);
    }

    const getActiveCourierAggregatorsForBussinessCenter = () => {
        api.post('/getActiveCourierAggregatorsForBussinessCenter', { franchisee: userData?._id || "asdasd"}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setCouriers(data.couriers)
        }).catch((e) => {
            console.log(e);
        })
    }

    const getOrdersForBussinessCenter = () => {
        api.post('/getActiveOrdersForBussinessCenter', { franchisee: userData?._id || "asdasd"}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setOrders(data.orders)
        }).catch((e) => {
            console.log(e);
        })
    }

    const getCompletedOrdersForBussinessCenter = () => {
        api.post('/getCompletedOrdersForBussinessCenter', { franchisee: userData?._id || "asdasd"}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setCompletedOrders(data.orders)
        }).catch((e) => {
            console.log(e);
        })
    }

    const getCancelledOrdersForBussinessCenter = () => {
        api.post('/getCancelledOrdersForBussinessCenter', { franchisee: userData?._id || "asdasd"}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setCancelledOrders(data.orders)
        }).catch((e) => {
            console.log(e);
        })
    }
    useEffect(() => {
        if (userData?._id) {
            getActiveCourierAggregatorsForBussinessCenter()
            getOrdersForBussinessCenter()
            getCompletedOrdersForBussinessCenter()
            getCancelledOrdersForBussinessCenter()
        }
    }, [userData?._id])

    const chooseCourierAggregator = async (courierAggregator) => {
        const response = await api.post("/assignOrderToCourier", {
            orderId: selectedOrder._id,
            courierId: courierAggregator?._id
        });
        if (response.data.success) {
            getOrdersForBussinessCenter();
            setOpen(true);
            setStatus("success");
            setMessage("Заказ успешно назначен");
        } else {
            setOpen(true);
            setStatus("error");
            setMessage("Что то пошло не так");
        }
        setShowAssignOrderModal(false);
    }

    const closeSnack = () => {
        setOpen(false);
    }

    return <Container role={userData?.role}>
        {showAssignOrderModal && (
            <ChooseCourierAggregatorModal
                closeCourierAggregatorsModal={closeAssignOrderModal}
                chooseCourierAggregator={chooseCourierAggregator}
                franchisee={userData?._id}
                scrollPosition={scrollPosition}
            />
        )}
        <Div>Распределить заказы</Div>
        <Div />
        <Div>Список активных курьеров:</Div>
        {couriers && couriers.length > 0 && couriers.map((item) => {
            return <div key={item?._id}>
                <Li>
                    <div>{item?.fullName}</div>
                    <LinkButton color="green" href={`/BusinessCenterCourierAggregatorPage/${item?._id}`}>Перейти</LinkButton>
                </Li>
            </div>
        })}

        <Div />
        <Div>Активные заказы:</Div>
        {orders && orders.length > 0 && orders.map((item) => {
            return <div key={item?._id}>
                <Li>
                    <div>{item?.client?.fullName}</div>
                    <div>{item?.client?.userName}</div>
                    <div>{item?.client?.address?.actual}</div>
                    {item.products.b12 > 0 && <div>12.5л: {item.products.b12}</div>}
                    {item.products.b19 > 0 && <div>18.9л: {item.products.b19}</div>}
                    <LinkButton color="green" href={`/orderPage/${item?._id}`}>Перейти</LinkButton>
                    <MyButton color="green" click={() => {
                        setSelectedOrder(item);
                        setShowAssignOrderModal(true);
                    }}>Назначить</MyButton>
                    {item.courierAggregator && <div>Назначен: {item.courierAggregator.fullName}</div>}
                </Li>
            </div>
        })}

        <Div />
        <Div>Завершенные заказы:</Div>
        {completedOrders && completedOrders.length > 0 && completedOrders.map((item) => {
            return <div key={item?._id}>
                <Li>
                    <div>{item?.client?.fullName}</div>
                    <div>{item?.client?.userName}</div>
                    <div>{item?.client?.address?.actual}</div>
                    {item.products.b12 > 0 && <div>12.5л: {item.products.b12}</div>}
                    {item.products.b19 > 0 && <div>18.9л: {item.products.b19}</div>}
                    <LinkButton color="green" href={`/orderPage/${item?._id}`}>Перейти</LinkButton>
                </Li>
            </div>
        })}

        <Div />
        <Div>Отмененные заказы:</Div>
        {cancelledOrders && cancelledOrders.length > 0 && cancelledOrders.map((item) => {
            return <div key={item?._id}>
                <Li>
                    <div>{item?.client?.fullName}</div>
                    <div>{item?.client?.userName}</div>
                    <div>{item?.client?.address?.actual}</div>
                    {item.products.b12 > 0 && <div>12.5л: {item.products.b12}</div>}
                    {item.products.b19 > 0 && <div>18.9л: {item.products.b19}</div>}
                    <LinkButton color="green" href={`/orderPage/${item?._id}`}>Перейти</LinkButton>
                </Li>
            </div>
        })}

        <Div />
        <MySnackBar
            open={open}
            text={message}
            status={status}
            close={closeSnack}
        />
    </Container>
}