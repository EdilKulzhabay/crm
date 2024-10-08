import { useState, useEffect } from "react";
import api from "../api";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import LinkButton from "../Components/LinkButton";
import Container from "../Components/Container";
import ChooseFranchiseeModal from "../Components/ChooseFranchiseeModal";
import MySnackBar from "../Components/MySnackBar";
import clsx from "clsx";
import ChooseCourierModal from "../Components/ChooseCourierModal";

export default function AdditionalOrdersWholeList() {
    const [additionalOrders, setAdditionalOrders] = useState([])
    const [userData, setUserData] = useState({});
    const [orderCourier, setOrderCourier] = useState(null);
    const [couriersModal, setCouriersModal] = useState(false);
    const [orderCourierChange, setOrderCourierChange] = useState(null)

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

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
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setUserData(data);
        });
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
        <Container role={userData.role || "admin"}>
            {couriersModal && (
                <ChooseCourierModal
                    closeCouriersModal={closeCouriersModal}
                    chooseCourier={chooseCourier}
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
                <div className="max-h-[180px] overflow-scroll bg-black">
                    {additionalOrders.map((item) => {
                        return (
                            <div key={item?._id}>
                                <Li>
                                    <div className="flex items-center gap-x-3 flex-wrap">
                                    <div>
                                            Заказ: 
                                        </div>
                                        <div>{item?.client?.userName}</div>
                                        <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                        <div className={clsx("", {
                                            "text-yellow-300": new Date(item?.date?.d) > new Date()
                                        })}>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                        <div>{item?.products?.b12 !== 0 && `12.5л: ${item?.products?.b12}`}; {item?.products?.b19 !== 0 && `18.9л: ${item?.products?.b19}`}</div>
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
