import { useState, useEffect } from "react";
import api from "../api";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import LinkButton from "../Components/LinkButton";
import Container from "../Components/Container";
import MySnackBar from "../Components/MySnackBar";
import clsx from "clsx";
import OrderInfo from "../Components/OrderInfo";
import useFetchUserData from "../customHooks/useFetchUserData";

export default function SuperAdminAggregatorOrders() {
    const userData = useFetchUserData();
    const [orders, setOrders] = useState([]);
    const [courierFullName, setCourierFullName] = useState("");
    const [totalOrders, setTotalOrders] = useState(0)

    const [loading, setLoading] = useState(false);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const handleSearchForCourier = (e) => {
        setCourierFullName(e.target.value);
        if (e.target.value === "") {
            getOrdersForAggregator()
        }
    };

    const getOrdersForAggregator = async () => {
        setLoading(true)
        const response = await api.post("/getOrdersForAggregatorMoreDetails", {
            courierFullName
        },
        {
            headers: { "Content-Type": "application/json" },
        })

        if (response.success) {
            setOrders(response.orders)
            setTotalOrders(response.orders.length)
        } else {
            setMessage(response.message)
            setStatus("error")
        }
        setLoading(false)
    }

    useEffect(() => {
        getOrdersForAggregator()
    }, [])

    return (
        <div className="relative">
            <Container role={userData?.role}>
                
                <Div>Список заказов агрегатора</Div>
                <Div />

                <Div>
                    Фильтрация по курьеру:
                </Div>
                <Div>
                    <div className="flex items-center flex-wrap gap-x-4">
                        <MyInput
                            value={courierFullName}
                            change={handleSearchForCourier}
                            color="white"
                        />
                        <MyButton click={() => {
                            getOrdersForAggregator()
                        }}>Найти</MyButton>
                    </div>
                </Div>

                <Div />

                <Div>
                    <div>Заказы: {totalOrders}</div>
                </Div>
                <div className=" bg-black">
                    {orders.map((item) => {
                        <div key={item?._id}>
                            <Li icon={item?.franchisee?._id === "66f15c557a27c92d447a16a0"}>
                                <div className="flex items-center gap-x-3 flex-wrap">
                                    <div className={clsx("", {
                                        "text-white bg-red": item.courierAggregator === null,
                                        "text-white bg-green-400": item.status === "onTheWay",
                                        "text-white bg-blue-600": item.status === "awaitingOrder",
                                    })}>
                                        Заказ Агрегатор {item.courierAggregator === null ? "Не назначен" : item.courierAggregator?.fullName}: 
                                    </div>
                                    <div className={clsx("", {
                                        "text-yellow-300": new Date(item?.date?.d) > new Date()
                                    })}>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                    <div>{item?.client?.fullName}</div>
                                    <a target="_blank" rel="noreferrer" href={item?.address?.link} className={clsx("", {
                                        "text-blue-500 hover:text-green-500": item?.address?.point?.lat && item?.address?.point?.lon,
                                        "text-red": !item?.address?.point?.lat || !item?.address?.point?.lon
                                    })}>{item?.address?.actual}</a>
                                    <div>
                                        {(item?.products?.b12 !== 0 && item?.products?.b12 !== null) && <>12.5л: <OrderInfo>{item?.products?.b12}</OrderInfo> {(userData?.role === "admin" || userData?.role === "superAdmin") && <span>({item?.client?.price12}тг)</span>};</>}
                                        {(item?.products?.b19 !== 0 && item?.products?.b19 !== null) && <>{" "}18.9л: <OrderInfo>{item?.products?.b19}</OrderInfo> {(userData?.role === "admin" || userData?.role === "superAdmin") && <span>({item?.client?.price19}тг)</span>};</>}
                                    </div>
                                    <div>{item?.comment && <span className="text-yellow-300">Есть комм.</span>}</div>
                                    <LinkButton
                                        href={`/orderPage/${item?._id}`}
                                    >
                                        Просмотр
                                    </LinkButton>
                                </div>
                            </Li>
                        </div>
                    })}
                    {loading && <div>Загрузка...</div>}
                </div>

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