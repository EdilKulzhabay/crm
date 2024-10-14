import { useState, useEffect, useCallback } from "react";
import api from "../api";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import LinkButton from "../Components/LinkButton";
import Container from "../Components/Container";
import MySnackBar from "../Components/MySnackBar";
import clsx from "clsx";
import ChooseCourierModal from "../Components/ChooseCourierModal";
import OrderInfo from "../Components/OrderInfo";
import useFetchUserData from "../customHooks/useFetchUserData";

export default function AdditionalOrdersWholeList() {
    const userData = useFetchUserData();
    const [additionalOrders, setAdditionalOrders] = useState([])
    const [orderCourier, setOrderCourier] = useState(null);
    const [couriersModal, setCouriersModal] = useState(false);
    const [orderCourierChange, setOrderCourierChange] = useState(null)

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const [scrollPosition, setScrollPosition] = useState(0);

    const handleScroll = useCallback(() => {
        setScrollPosition(window.scrollY);
        console.log("Scroll Y position:", window.scrollY);
    }, []);

    useEffect(() => {
        window.addEventListener("scroll", handleScroll);
        
        // Удаление обработчика при размонтировании компонента
        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, [handleScroll]);

    const closeCouriersModal = () => {
        setCouriersModal(false);
    };

    const chooseCourier = (chCourier) => {
        setOrderCourier(chCourier);
        setCouriersModal(false);
    };

    const closeSnack = () => {
        setOpen(false);
    };

    const getAdditionalOrders = () => {
        api.get("/getAdditionalOrders", {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setAdditionalOrders(data.orders)
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        getAdditionalOrders()
    }, []);

    useEffect(() => {
        if (orderCourier !== null && orderCourierChange !== null) {
            api.post("/updateOrder", {orderId: orderCourierChange, change: "courier", changeData: orderCourier}, {
                headers: { "Content-Type": "application/json" },
            }).then(({data}) => {
                additionalOrders.map((item) => {
                    if (item._id === orderCourierChange) {
                        item.courier = orderCourier
                    }
                })
                setOpen(true)
                setStatus("success")
                setMessage(data.message)
                setOrderCourier(null)
                setOrderCourierChange(null)
            }).catch((e) => {

            })
        }
    }, [orderCourier])

    return (
        <Container role={userData?.role}>
            {couriersModal && (
                <ChooseCourierModal
                    closeCouriersModal={closeCouriersModal}
                    chooseCourier={chooseCourier}
                    scrollPosition={scrollPosition}
                />
            )}
            <Div>Список заказов</Div>


            {/* <Div />
            <Div>
                <div>Поиск заказа:</div>
            </Div>
            <Div>
                <div className="flex items-center flex-wrap gap-x-4">
                    <MyInput
                        value={search}
                        change={handleSearch}
                        color="white"
                    />
                    <MyButton click={() => {
                        setOrders([]);
                        setPage(1);
                        setHasMore(true);
                        setSearchStatus(true)
                        setLoading(false)
                        loadMoreOrders(1, dates, search, true, searchF)
                    }}>Найти</MyButton>
                </div>
            </Div> */}
            
            {userData?.role === "admin" && <>
                <Div />
                <Div>Доп. заказы: {additionalOrders.length}</Div>
                <div className="bg-black">
                    {additionalOrders.map((item) => {
                        return (
                            <div key={item?._id}>
                                <Li>
                                    <div className="flex items-center gap-x-3 flex-wrap">
                                        <div className={clsx("", {
                                                "text-white bg-red": new Date(item?.date?.d).toISOString().split('T')[0] < new Date().toISOString().split('T')[0],
                                                "text-white bg-green-400": new Date(item?.date?.d).toISOString().split('T')[0] === new Date().toISOString().split('T')[0],
                                                "text-white bg-blue-600": new Date(item?.date?.d).toISOString().split('T')[0] > new Date().toISOString().split('T')[0],
                                            })}>
                                            Заказ: 
                                        </div>
                                        <div>{item?.client?.userName}</div>
                                        <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                        <div className={clsx("", {
                                            "text-yellow-300": new Date(item?.date?.d) > new Date()
                                        })}>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                        <div>
                                            {(item?.products?.b12 !== 0 && item?.products?.b12 !== null) && <>12.5л: <OrderInfo>{item?.products?.b12}</OrderInfo> {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.client?.price12}тг)</span>};</>}
                                            {(item?.products?.b19 !== 0 && item?.products?.b19 !== null) && <>{" "}18.9л: <OrderInfo>{item?.products?.b19}</OrderInfo> {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.client?.price19}тг)</span>};</>}
                                        </div>
                                        {/* <div>{item?.products?.b12 !== 0 && `12.5л: ${item?.products?.b12}`}; {item?.products?.b19 !== 0 && `18.9л: ${item?.products?.b19}`}</div> */}
                                        <div>{item?.comment && <span className="text-yellow-300">Есть комм.</span>}</div>
                                        <LinkButton
                                            href={`/orderPage/${item?._id}`}
                                        >
                                            Просмотр
                                        </LinkButton>
                                        <MyButton click={() => {
                                        setOrderCourierChange(item._id)
                                        setCouriersModal(true)
                                        }}>Курьер</MyButton>
                                        <div>{item?.courier?.fullName}</div>
                                    </div>
                                </Li>
                            </div>
                        )
                    })}
                </div>
            </>}

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
