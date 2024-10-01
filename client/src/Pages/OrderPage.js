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
import DataInput from "../Components/DataInput";

export default function OrderPage() {
    const { id } = useParams();
    const [role, setRole] = useState("");
    const [order, setOrder] = useState(null);
    const [orderStatus, setOrderStatus] = useState("");
    const [orderCourier, setOrderCourier] = useState(null);
    const [couriersModal, setCouriersModal] = useState(false);
    const [products, setProducts] = useState({
        b12: "",
        b19: "",
    });
    const [date, setDate] = useState({
        d: "",
        time: "",
    });
    const [changeDate, setChangeDate] = useState(false)

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const handleDateChange = (e) => {
        setChangeDate(true)
        let input = e.target.value.replace(/\D/g, ""); // Remove all non-digit characters
        if (input.length > 8) input = input.substring(0, 8); // Limit input to 8 digits

        const year = input.substring(0, 4);
        const month = input.substring(4, 6);
        const day = input.substring(6, 8);

        let formattedValue = year;
        if (input.length >= 5) {
            formattedValue += "-" + month;
        }
        if (input.length >= 7) {
            formattedValue += "-" + day;
        }

        setDate({ ...date, [e.target.name]: formattedValue });
    };

    const handleTimeChange = (e) => {
        setChangeDate(true)
        let input = e.target.value.replace(/\D/g, ""); // Remove all non-digit characters
        if (input.length > 13) input = input.substring(0, 13); // Limit input to 8 digits

        const h1 = input.substring(0, 2);
        const m1 = input.substring(2, 4);
        const h2 = input.substring(4, 6);
        const m2 = input.substring(6, 8);

        let formattedValue = h1;
        if (input.length >= 3) {
            formattedValue += ":" + m1;
        }
        if (input.length >= 5) {
            formattedValue += " - " + h2;
        }
        if (input.length >= 7) {
            formattedValue += ":" + m2;
        }

        setDate({ ...date, [e.target.name]: formattedValue });
    };

    const handleProductsChange = (event) => {
        setProducts({ ...products, [event.target.name]: event.target.value });
    };

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
                setDate({
                    d: data.order.date.d,
                    time: data.order.date.time
                })
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
                    if (change === "products") {
                        setProducts({
                            b12: "",
                            b19: ""
                        })
                    }
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
                                className="text-blue-500 hover:text-blue-500"
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
                        <div>
                            [{" "}
                            <input
                                className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                name="b12"
                                value={products.b12}
                                inputMode="numeric"
                                pattern="\d*"
                                onKeyPress={(event) => {
                                    if (!/[0-9]/.test(event.key)) {
                                        event.preventDefault(); // блокирует ввод символов, кроме цифр
                                    }
                                }}
                                onChange={(event) => {
                                    handleProductsChange(event);
                                }}
                            />{" "}
                            ] шт
                        </div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>18,9-литровая бутыль:</div>
                        <div>{order?.products?.b19} шт</div>
                        <div>
                            [{" "}
                            <input
                                className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                name="b19"
                                value={products.b19}
                                inputMode="numeric"
                                pattern="\d*"
                                onKeyPress={(event) => {
                                    if (!/[0-9]/.test(event.key)) {
                                        event.preventDefault(); // блокирует ввод символов, кроме цифр
                                    }
                                }}
                                onChange={(event) => {
                                    handleProductsChange(event);
                                }}
                            />{" "}
                            ] шт
                        </div>
                    </div>
                </Li>
                {(products.b12 !== ""  || products.b19 !== "") && <Div>
                    <MyButton click={() => {
                        if (products.b12 === "") {
                            products.b12 = order?.products?.b12
                        }
                        if (products.b19 === "") {
                            products.b19 = order?.products?.b19
                        }
                        updateOrder("products", products)
                    }}>Применить</MyButton>
                </Div>}
            </>

            <Div />
            <Div>Дата и время заказа:</Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Дата:</div>
                        <div className="text-red">
                            [
                            <DataInput
                                color="red"
                                value={date.d}
                                name="d"
                                change={handleDateChange}
                            />
                            ]
                        </div>
                        {/* <div className="text-red">{order?.date?.d}</div> */}
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Время:</div>
                        <div className="text-red">
                            [
                            <input
                                className="bg-black outline-none border-b border-red border-dashed text-sm lg:text-base placeholder:text-xs placeholder:lg:text-sm"
                                value={date.time}
                                size={13}
                                name="time"
                                inputMode="numeric"
                                pattern="\d*"
                                onKeyPress={(event) => {
                                    if (!/[0-9]/.test(event.key)) {
                                        event.preventDefault(); // блокирует ввод символов, кроме цифр
                                    }
                                }}
                                onChange={(event) => {
                                    handleTimeChange(event);
                                }}
                                placeholder=" HH:MM - HH:MM"
                            />
                            ]
                        </div>
                        {/* <div className="text-red">{order?.date?.time}</div> */}
                    </div>
                </Li>
                {changeDate && <Div><MyButton click={() => {updateOrder("date", date)}}>Применить</MyButton></Div>}
            </>

            <Div />
            <Div>
                <div>Форма оплаты: {order?.opForm === "cash" && "наличные"}{order?.opForm === "postpay" && "постоплата"}{order?.opForm === "transfer" && "перевод"}{order?.opForm === "card" && "карта"}{order?.opForm === "coupon" && "талон"}</div>
            </Div>
            <Div>
                <div className="text-red flex items-center gap-x-3">
                    [
                        <button className="text-red hover:text-blue-500" onClick={() => {updateOrder("opForm", "cash")}}>Наличные</button> /
                        <button className="text-red hover:text-blue-500" onClick={() => {updateOrder("opForm", "transfer")}}>Перевод</button> /
                        <button className="text-red hover:text-blue-500" onClick={() => {updateOrder("opForm", "card")}}>Карта</button> /
                        <button className="text-red hover:text-blue-500" onClick={() => {updateOrder("opForm", "coupon")}}>Талон</button> /
                        <button className="text-red hover:text-blue-500" onClick={() => {updateOrder("opForm", "postpay")}}>Постоплата</button>
                    ]
                </div>
            </Div>

            <Div />
            <Div>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <div>Статус заказа:</div>
                    <div className="flex items-center gap-x-2 flex-wrap text-red">
                        [
                        <button
                            className={clsx("hover:text-blue-500", {
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
                            className={clsx("hover:text-blue-500", {
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
                            className={clsx("hover:text-blue-500", {
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
                            className={clsx("hover:text-blue-500", {
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
                            <span className="text-green-400">
                            Применить
                            </span>
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
                                <span className="text-green-400">
                                Применить
                                </span>
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
