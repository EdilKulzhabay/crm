import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import Li from "../Components/Li";
import LinkButton from "../Components/LinkButton";
import MyButton from "../Components/MyButton";
import Info from "../Components/Info";
import clsx from "clsx";
import useFetchUserData from "../customHooks/useFetchUserData";

export default function CourierAggregatorPage() {
    const userData = useFetchUserData()
    const { id } = useParams();
    const [courier, setCourier] = useState(null);
    const [completedOrders, setCompletedOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadCourierData = async () => {
        try {
            const { data } = await api.post(
                "/getCourierAggregatorDataForAdmin",
                { id },
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
            setCourier(data.userData);
        } catch (error) {
            console.error("Ошибка при загрузке данных курьера:", error);
        }
    };

    const getCompletedOrCancelledOrdersFromCourierAggregator = async () => {
        try {
            const { data } = await api.post(
                "/getCompletedOrCancelledOrdersFromCourierAggregator",
                { courierId: id },
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
            setCompletedOrders(data.orders);
        } catch (error) {
            console.error("Ошибка при получении данных о завершенных или отменных заказов курьера:", error);
        }
    }


    useEffect(() => {
        loadCourierData();
        getCompletedOrCancelledOrdersFromCourierAggregator()
        setLoading(false)
    }, [id]);

    if (loading) {
        return (
            <Container role={userData?.role}>
                <Div>Загрузка...</Div>
            </Container>
        );
    }

    if (!courier) {
        return (
            <Container role={userData?.role}>
                <Div>Курьер не найден</Div>
            </Container>
        );
    }

    return (
        <Container role={userData?.role}>
            <Div className="text-2xl font-bold">Информация о курьере</Div>
            <Div />
            <Li>
                <div className="flex items-center gap-x-2 flex-wrap">
                    <div>Имя: {courier.fullName}</div>
                    <div>|</div>
                    <div>Телефон: {courier.phone}</div>
                    <div>|</div>
                    <div>Email: {courier.email}</div>
                    <div>|</div>
                    <div className={clsx("", {
                        "text-green-500": courier.onTheLine,
                        "text-red-500": !courier.onTheLine
                    })}>
                        Статус: {courier.onTheLine ? "Активен" : "Неактивен"}
                    </div>
                </div>
            </Li>

            <Div />
            <Div className="text-xl font-bold">Активный заказ</Div>
            {courier?.order ? (
                <Li>
                    <div className="flex flex-col gap-y-2">
                        <div className="flex items-center gap-x-2 flex-wrap">
                            <div>Заказ #{courier?.order?.clientAddress}</div>
                            <div>|</div>
                            <div>Статус: В пути</div>
                            <LinkButton
                                color="green"
                                href={`/OrderPage/${courier?.order?.orderId}`}
                            >Перейти на заказ</LinkButton>
                        </div>
                    </div>
                </Li>
            ) : (
                <Div>Нет активных заказов</Div>
            )}

            <Div />
            <Div className="text-xl font-bold">Заказы в ожидании</Div>
            {courier?.orders?.length > 0 ? (
                courier?.orders.map(order => (
                    <Li key={order._id}>
                        {order.orderId !== courier?.order?.orderid && <div className="flex flex-col gap-y-2">
                            <div>Заказ #{order?.clientAddress}</div>
                            <LinkButton
                                color="green"
                                href={`/OrderPage/${order?.orderId}`}
                            >Перейти на заказ</LinkButton>
                        </div>}
                    </Li>
                ))
            ) : (
                <Div>Нет заказов в ожидании</Div>
            )}

            <Div />
            <Div className="text-xl font-bold">Завершенные заказы</Div>
            {completedOrders.length > 0 ? (
                completedOrders.map(order => (
                    <Li key={order._id}>
                        <div className="flex items-center gap-x-2 flex-wrap">
                            <div>Заказ #{order?.address.actual}</div>
                            <div>|</div>
                            
                            <div className={clsx("", {
                                "text-green-500": order?.status === "delivered",
                                "text-red-500": order?.status === "cancelled"
                            })}>
                                Статус: {order?.status === "delivered" ? "Завершен" : "Отменен"}
                            </div>
                            <LinkButton
                                color="green"
                                href={`/OrderPage/${order?._id}`}
                            >Перейти на заказ</LinkButton>
                            {order?.reason && (
                                <>
                                    <div>|</div>
                                    <div>Причина: {order.reason}</div>
                                </>
                            )}
                        </div>
                    </Li>
                ))
            ) : (
                <Div>Нет завершенных заказов</Div>
            )}
            <Div />
        </Container>
    );
}
