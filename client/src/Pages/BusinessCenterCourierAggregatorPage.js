import { useParams } from "react-router-dom";
import Container from "../Components/Container";
import { useEffect, useState } from "react";
import api from "../api";
import Div from "../Components/Div";
import MySnackBar from "../Components/MySnackBar";
import useFetchUserData from "../customHooks/useFetchUserData";
import LinkButton from "../Components/LinkButton";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";

export default function BusinessCenterCourierAggregatorPage() {
    const userData = useFetchUserData();
    const { id } = useParams();
    const [courierAggregator, setCourierAggregator] = useState({});

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const getCourierAggregatorData = () => {
        api.post(`/getCourierAggregatorDataForAdmin`, {
            id: id
        }, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setCourierAggregator(data.userData);
        }).catch((e) => {
            console.log(e);
        })
    }

    const removeOrderFromCourier = (orderId, courierId) => {
        api.post("/removeOrderFromCourier", {
            orderId: orderId,
            courierId: courierId
        }).then(({data}) => {
            if (data.success) {
                setOpen(true);
                setStatus("success");
                setMessage("Заказ успешно убран у курьера");
            } else {
                setOpen(true);
                setStatus("error");
                setMessage("Что то пошло не так");
            }
        }).catch((e) => {
            setOpen(true);
            setStatus("error");
            setMessage("Что то пошло не так");
        }).finally(() => {
            getCourierAggregatorData();
        })
    }

    useEffect(() => {
        if (userData?._id) {
            getCourierAggregatorData();
        }
    }, [userData?._id])

    return (
        <div className="relative">
            <Container role={userData?.role}>

                <Div>Информация о курьере:</Div>
                <Div />
                <Div>
                    <div>Имя: {courierAggregator?.fullName}</div>
                    <div>Email: {courierAggregator?.email}</div>
                    <div>Телефон: {courierAggregator?.phone}</div>
                </Div>

                <Div />
                <Div>Активный заказ:</Div>
                {courierAggregator?.order ? (
                    <Li>
                        <div>Заказ #{courierAggregator?.order?.clientAddress}</div>
                        <div>Статус: {courierAggregator?.order?.status === "awaitingOrder" ? "В ожидании" : courierAggregator?.order?.status === "onTheWay" ? "В пути" : courierAggregator?.order?.status === "delivered" ? "Завершен" : courierAggregator?.order?.status === "cancelled" ? "Отменен" : "Неизвестно"}</div>
                        <LinkButton color="green" href={`/orderPage/${courierAggregator?.order?.orderId}`}>Перейти</LinkButton>
                    </Li>
                ) : (
                    <Div>Нет активных заказов</Div>
                )}
                <Div />

                <Div>Заказы в ожидании:</Div>
                {courierAggregator?.orders?.length > 0 ? (
                    <Li>
                        <div>Заказ #{courierAggregator?.order?.clientAddress}</div>
                        <div>Статус: {courierAggregator?.order?.status === "awaitingOrder" ? "В ожидании" : courierAggregator?.order?.status === "onTheWay" ? "В пути" : courierAggregator?.order?.status === "delivered" ? "Завершен" : courierAggregator?.order?.status === "cancelled" ? "Отменен" : "Неизвестно"}</div>
                        <LinkButton color="green" href={`/orderPage/${courierAggregator?.order?.orderId}`}>Перейти</LinkButton>
                        <MyButton color="green" click={() => {
                            removeOrderFromCourier(courierAggregator?.order?.orderId, courierAggregator?._id);
                        }}>Убрать у курьера</MyButton>
                    </Li>
                ) : (
                    <Div>Нет заказов в ожидании</Div>
                )}

                <MySnackBar
                    open={open}
                    text={message}
                    status={status}
                    close={closeSnack}
                />
                <Div />
            </Container>
        </div>
    )
}