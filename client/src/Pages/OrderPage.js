import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import ChooseCourierModal from "../Components/ChooseCourierModal";
import Container from "../Components/Container";
import Div from "../Components/Div";
import Li from "../Components/Li";
import LinkButton from "../Components/LinkButton";
import MyButton from "../Components/MyButton";
import MySnackBar from "../Components/MySnackBar";
import clsx from "clsx"

export default function OrderPage() {
    const { id } = useParams();
    const [role, setRole] = useState("");
    const [order, setOrder] = useState(null);
    const [orderStatus, setOrderStatus] = useState("");
    const [orderCourier, setOrderCourier] = useState(null);
    const [couriersModal, setCouriersModal] = useState(false);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const closeCouriersModal = () => {
        setCouriersModal(false);
    };

    const chooseCourier = (chCourier) => {
        setOrderCourier(chCourier);
        setCouriersModal(false);
    };

    const getOrderData = () => {
        api.post(
            "/getOrderDataForId",
            { id },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                setOrder(data.order);
                setOrderStatus(data.order.status);
                setOrderCourier(data.order.courier);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setRole(data.role);
            })
            .catch((e) => {
                console.log(e);
            });

        getOrderData();
    }, []);

    const updateOrder = (change, changeData) => {
        api.post(
            "/updateOrder",
            { orderId: order._id, change, changeData },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                if (data.success) {
                    setMessage(data.message);
                    setStatus("success");
                    setOpen(true);
                }
                getOrderData();
            })
            .catch((e) => {
                console.log(e);
            });
    };

    return (
        <Container role={role}>
            {couriersModal && (
                <ChooseCourierModal
                    closeCouriersModal={closeCouriersModal}
                    chooseCourier={chooseCourier}
                />
            )}
            <Div>Детали заказа</Div>
            <Div />
            <Div>Клиент:</Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Имя:</div>
                        <div>{order?.client?.fullName || ""}</div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Телефон:</div>
                        <div>{order?.client?.phone || ""}</div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Адрес:</div>
                        <div>
                            {order?.address?.actual || ""}{" "}
                            <a
                                href={order?.address?.link || "/"}
                                className="text-blue-900 hover:text-blue-500"
                                target="_blank" rel="noreferrer"
                            >
                                %2gis%
                            </a>
                        </div>
                    </div>
                </Li>
            </>
            <Div />
            <Div>Продукты:</Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>12,5-литровая бутыль:</div>
                        <div>{order?.products?.b12} шт</div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>18,9-литровая бутыль:</div>
                        <div>{order?.products?.b19} шт</div>
                    </div>
                </Li>
            </>

            <Div />
            <Div>Дата и время заказа:</Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Дата:</div>
                        <div className="text-red">{order?.date?.d}</div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Время:</div>
                        <div className="text-red">{order?.date?.time}</div>
                    </div>
                </Li>
            </>

            <Div />
            <Div>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <div>Статус заказа:</div>
                    <div className="flex items-center gap-x-2 flex-wrap text-red">
                        [
                        <button
                            className={clsx("hover:text-blue-900", {
                                "text-red-500": orderStatus !== "awaitingOrder",
                                "text-blue-800": orderStatus === "awaitingOrder"
                            })}
                            onClick={() => {
                                setOrderStatus("awaitingOrder");
                            }}
                        >
                            Ожидает заказ
                        </button>
                        <div>/</div>
                        <button
                            className={clsx("hover:text-blue-900", {
                                "text-red-500": orderStatus !== "onTheWay",
                                "text-blue-800": orderStatus === "onTheWay"
                            })}
                            onClick={() => {
                                setOrderStatus("onTheWay");
                            }}
                        >
                            В пути
                        </button>
                        <div>/</div>
                        <button
                            className={clsx("hover:text-blue-900", {
                                "text-red-500": orderStatus !== "delivered",
                                "text-blue-800": orderStatus === "delivered"
                            })}
                            onClick={() => {
                                setOrderStatus("delivered");
                            }}
                        >
                            Доставлен
                        </button>
                        <div>/</div>
                        <button
                            className={clsx("hover:text-blue-900", {
                                "text-red-500": orderStatus !== "cancelled",
                                "text-blue-800": orderStatus === "cancelled"
                            })}
                            onClick={() => {
                                setOrderStatus("cancelled");
                            }}
                        >
                            Отменен
                        </button>
                        ]
                        <MyButton
                            click={() => {
                                updateOrder("status", orderStatus);
                            }}
                        >
                            Применить
                        </MyButton>
                    </div>
                </div>
            </Div>
            <Li>
                {order?.status === "awaitingOrder"
                    ? "Ожидает заказ"
                    : order?.status === "onTheWay"
                    ? "В пути"
                    : order?.status === "delivered"
                    ? "Доставлен"
                    : "Отменен"}
            </Li>

            <Div />
            <Div>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <div>Курьер:</div>
                    <div>{order?.courier?.fullName}</div>
                </div>
            </Div>
            <Li>
                <div className="flex items-center gap-x-3 flex-wrap">
                    {order?.courier?._id && <LinkButton href={`/CourierPage/${order?.courier?._id}`}>
                        Просмотр
                    </LinkButton>
                    }
                    
                    <MyButton
                        click={() => {
                            setCouriersModal(true);
                        }}
                    >
                        {order?.courier?._id ? "Изменить " : "Назначить " }курьера
                    </MyButton>

                    {orderCourier &&
                        orderCourier?._id !== order?.courier?._id && (
                            <MyButton
                                click={() => {
                                    updateOrder("courier", orderCourier);
                                }}
                            >
                                Применить
                            </MyButton>
                        )}
                    {orderCourier &&
                        orderCourier?._id !== order?.courier?._id && (
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div>|</div> <div>{orderCourier.fullName}</div>{" "}
                            </div>
                        )}
                </div>
            </Li>

            <Div />
            <Div>История изменений:</Div>
            {order?.history &&
                order?.history.length > 0 &&
                order?.history.map((item, index) => {
                    return (
                        <div key={index}>
                            <Li>{item}</Li>
                        </div>
                    );
                })}

            <Div />
            <Div>Отзыв клиента:</Div>
            <Li>
                Отзыв:{" "}
                {order?.clientNotes
                    ? order.clientNotes
                    : "Клиент не оставил отзыва"}
            </Li>

            {/* <Div />
            <Div>Действия:</Div>
            <Div>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyButton click={() => {}}>
                        Отправить уведомление клиенту
                    </MyButton>
                    <MyButton click={() => {}}>
                        Отправить уведомление курьеру
                    </MyButton>
                </div>
            </Div> */}
            <Div />
            <MySnackBar
                open={open}
                text={message}
                status={status}
                close={closeSnack}
            />
        </Container>
    );
}
