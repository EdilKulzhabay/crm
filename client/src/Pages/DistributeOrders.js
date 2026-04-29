import { useEffect, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import api from "../api";
import LinkButton from "../Components/LinkButton";
import useFetchUserData from "../customHooks/useFetchUserData"

export default function DistributeOrders() {
    const userData = useFetchUserData();
    const [couriers, setCouriers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [completedOrders, setCompletedOrders] = useState([]);
    const [cancelledOrders, setCancelledOrders] = useState([]);
    const [showCompletedOrders, setShowCompletedOrders] = useState(false);
    const [showCancelledOrders, setShowCancelledOrders] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showAssignOrderModal, setShowAssignOrderModal] = useState(false);

    const openAssignOrderModal = (orderId) => {
        setSelectedOrder(orderId);
        setShowAssignOrderModal(true);
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

    return <Container role={userData?.role}>
        <Div>Распределить заказы</Div>
        <Div />
        {showAssignOrderModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white text-black p-6 rounded-lg max-w-md w-full mx-4">
                    <h3 className="text-lg font-bold mb-4">
                        Назначить заказ курьеру
                    </h3>
                </div>
            </div>
        )}
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
                    <div>{item?.client?.address?.actual}</div>
                    {item.products.b12 > 0 && <div>12.5л: {item.products.b12}</div>}
                    {item.products.b19 > 0 && <div>18.9л: {item.products.b19}</div>}
                    <LinkButton color="green" href={`/orderPage/${item?._id}`}>Перейти</LinkButton>
                    <MyButton color="green" onClick={() => {
                        setSelectedOrder(item);
                        setShowAssignOrderModal(true);
                    }}>Назначить</MyButton>
                    {item.courierAggregator && <div>Назначен: {item.courierAggregator.fullName}</div>}
                </Li>
            </div>
        })}

        <Div />
    </Container>
}