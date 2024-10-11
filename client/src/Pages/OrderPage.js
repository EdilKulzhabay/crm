import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import UpIcon from "../icons/UpIcon";
import DownIcon from "../icons/DownIcon";
import useScrollPosition from "../customHooks/useScrollPosition";
import ConfirmDeleteModal from "../Components/ConfirmDeleteModal";

const adjustDateByDays = (dateStr, days) => {
    const currentDate = new Date(dateStr);
    currentDate.setDate(currentDate.getDate() + days);
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    return `${year}-${month}-${day}`;
};

export default function OrderPage() {
    const scrollPosition = useScrollPosition();
    const { id } = useParams();
    const navigate = useNavigate();
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
    const [comment, setComment] = useState("")

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteObject, setDeleteObject] = useState(null)

    const confirmDelete = () => {
        deleteOrder()
        setDeleteModal(false)
        setDeleteObject(null)
    }

    const closeConfirmModal = () => {
        setDeleteModal(false)
        setDeleteObject(null)
    }

    const handleDateChange = (e) => {
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

    const incrementDate = () => {
        setDate({ ...date, d: adjustDateByDays(date.d, 1) });
    };

    const decrementDate = () => {
        setDate({ ...date, d: adjustDateByDays(date.d, -1) });
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
                setComment(data.order?.comment)
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

    const deleteOrder = () => {
        api.post("/deleteOrder", {orderId: id}, {
            headers: { "Content-Type": "application/json" }
        }).then(({data}) => {
            if (data.success) {
                navigate(-1)
            } else {
                setOpen(true)
                setStatus("error")
                setMessage("Не удалось удалить заказ")
            }
        })
    }

    return (
        <div className="relative">
            {deleteModal && <ConfirmDeleteModal
                    closeConfirmModal={closeConfirmModal}
                    confirmDelete={confirmDelete}
                    scrollPosition={scrollPosition}
                />}
            <Container role={role}>
                {couriersModal && (
                    <ChooseCourierModal
                        closeCouriersModal={closeCouriersModal}
                        chooseCourier={chooseCourier}
                        scrollPosition={scrollPosition}
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
                                    size={13}
                                    style={{ fontSize: '16px' }}
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
                                    size={13}
                                    style={{ fontSize: '16px' }}
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
                            <div className="flex items-center gap-x-2">
                                <button onClick={incrementDate} className="w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1">
                                    <UpIcon className="w-6 h-6 text-white" />
                                </button>
                                <button onClick={decrementDate} className="w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1">
                                    <DownIcon className="w-6 h-6 text-white" />
                                </button>
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
                                    style={{ fontSize: '16px' }}
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
                    {(date?.d !== order?.date?.d || date?.time !== order?.date?.time) && <Div><MyButton click={() => {updateOrder("date", date)}}>Применить</MyButton></Div>}
                </>

                <Div />
                <Div>
                    <div>Форма оплаты: {order?.opForm === "fakt" && "Нал_Карта_QR"}{order?.opForm === "postpay" && "Постоплата"}{order?.opForm === "credit" && "В долг"}{order?.opForm === "coupon" && "Талоны"}{order?.opForm === "mixed" && "смешанно"}</div>
                </Div>

                <Div />
                <Div>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Статус заказа:</div>
                        <div className="flex items-center gap-x-2 flex-wrap text-red">
                            [
                            <button
                                className={clsx("", {
                                    "text-red-500": orderStatus !== "awaitingOrder",
                                    "text-yellow-300": orderStatus === "awaitingOrder"
                                })}
                            >
                                Ожидает заказ
                            </button>
                            <div>/</div>
                            <button
                                className={clsx("", {
                                    "text-red-500": orderStatus !== "onTheWay",
                                    "text-yellow-300": orderStatus === "onTheWay"
                                })}
                            >
                                В пути
                            </button>
                            <div>/</div>
                            <button
                                className={clsx("", {
                                    "text-red-500": orderStatus !== "delivered",
                                    "text-yellow-300": orderStatus === "delivered"
                                })}
                            >
                                Доставлен
                            </button>
                            <div>/</div>
                            <button
                                className={clsx("", {
                                    "text-red-500": orderStatus !== "cancelled",
                                    "text-yellow-300": orderStatus === "cancelled"
                                })}
                                // onClick={() => {
                                //     setOrderStatus("cancelled");
                                // }}
                            >
                                Отменен
                            </button>
                            ]
                            {/* <MyButton
                                click={() => {
                                    updateOrder("status", orderStatus);
                                }}
                            >
                                <span className="text-green-400">
                                Применить
                                </span>
                            </MyButton> */}
                        </div>
                    </div>
                </Div>
                {/* <Li>
                    {order?.status === "awaitingOrder"
                        ? "Ожидает заказ"
                        : order?.status === "onTheWay"
                        ? "В пути"
                        : order?.status === "delivered"
                        ? "Доставлен"
                        : "Отменен"}
                </Li> */}

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
                <Div>Комментарии к заказу:</Div>
                <Li>
                    <textarea value={comment} onChange={(e) => {setComment(e.target.value)}} className="bg-black text-white border border-white rounded-lg p-1 text-sm"></textarea>
                </Li>
                {order?.comment !== comment && <Div>
                    <MyButton click={() => {updateOrder("comment", comment)}}><span className="text-green-500">Применить</span></MyButton>
                    </Div>
                }

                <Div />
                <Div>Отзыв клиента:</Div>
                <Li>
                    Отзыв:{" "}
                    {order?.clientNotes
                        ? order.clientNotes
                        : "Клиент не оставил отзыва"}
                </Li>

                {role === "superAdmin" && <>
                    <Div />
                    <Div>Действия:</Div>
                    <Div>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <MyButton click={() => {
                                setDeleteModal(true)
                            }}>
                                Удалить заказ
                            </MyButton>
                        </div>
                    </Div>
                </>}
                <Div />
                <MySnackBar
                    open={open}
                    text={message}
                    status={status}
                    close={closeSnack}
                />
            </Container>
        </div>
    );
}
