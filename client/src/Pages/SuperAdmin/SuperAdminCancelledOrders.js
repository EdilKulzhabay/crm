import { useCallback, useRef, useState, useEffect } from "react";
import api from "../../api";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import MyButton from "../../Components/MyButton";
import LinkButton from "../../Components/LinkButton";
import Container from "../../Components/Container";
import clsx from "clsx";
import OrderInfo from "../../Components/OrderInfo";
import useFetchUserData from "../../customHooks/useFetchUserData";
import ChooseFranchiseeModal from "../../Components/ChooseFranchiseeModal";

import useScrollPosition from "../../customHooks/useScrollPosition";

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


export default function SuperAdminCancelledOrders() {
    const scrollPosition = useScrollPosition();
    const userData = useFetchUserData();
    const [orders, setOrders] = useState([]);
    const [additionalOrders, setAdditionalOrders] = useState([])
    const [search, setSearch] = useState("");
    const [searchF, setSearchF] = useState("");
    const [sa, setSa] = useState(false)
    const [searchStatus, setSearchStatus] = useState(false);
    const [dates, setDates] = useState({
        startDate: getCurrentDate(),
        endDate: getCurrentDate(),
    });
    const [franchiseesModal, setFranchiseesModal] = useState(false);
    const [franchisee, setFranchisee] = useState(null);
    const [order, setOrder] = useState(null)
    const [totalOrders, setTotalOrders] = useState(0)

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const closeFranchiseeModal = () => {
        setFranchiseesModal(false);
    };

    const chooseFranchisee = (chFranchisee) => {
        setFranchisee(chFranchisee);
        setFranchiseesModal(false);
    };

    const getAdditionalOrders = () => {
        api.post("/getAdditionalOrders", {...dates}, {
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

    const updateOrderTransfer = () => {
        api.post("/updateOrderTransfer", {orderId: order, change: "transferredFranchise", changeData: franchisee?.fullName}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                setOpen(true)
                setMessage(data.message)
                setStatus("success")
                const temporaryOrders = [...orders]
                temporaryOrders.forEach((item) => {
                    if (item._id === order) {
                        item.transferred = true
                        item.transferredFranchise = franchisee?.fullName
                    }
                })
                setOrders(temporaryOrders)
            }
        }).catch((e) => {})
    }

    const addOrderToAggregator = (id) => {
        api.post("/addOrderToAggregator", {orderId: id}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            console.log(data);
            getCancelledOrders();
        })
    }

    const toTomorrow = (id) => {
        api.post("/toTomorrow", {orderId: id}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            console.log(data);
            getCancelledOrders();
        })
    }

    useEffect(() => {
        if (order && franchisee) {
            updateOrderTransfer()
        }
    }, [franchisee])

    const getCancelledOrders = () => {
        api.get("/getCancelledOrders", {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setOrders(data.orders)
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        getCancelledOrders()
    }, []);

    return (
        <div className="relative">
            {franchiseesModal && (
                    <ChooseFranchiseeModal
                        closeFranchiseeModal={closeFranchiseeModal}
                        chooseFranchisee={chooseFranchisee}
                        scrollPosition={scrollPosition}
                    />
                )}
            <Container role={userData?.role}>
                
                <Div>Список заказов</Div>
                <Div />
                <Div>
                    <div>Отмененные заказы:</div>
                </Div>

                {orders && orders.length > 0 && orders.map((item) => (
                    <div key={item._id}>
                        <Li icon={item?.franchisee?._id === "66f15c557a27c92d447a16a0"}>
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div className={clsx("", {
                                    "text-white bg-red": new Date(item?.date?.d).toISOString().split('T')[0] < new Date().toISOString().split('T')[0],
                                    "text-white bg-green-400": new Date(item?.date?.d).toISOString().split('T')[0] === new Date().toISOString().split('T')[0],
                                    "text-white bg-blue-600": new Date(item?.date?.d).toISOString().split('T')[0] > new Date().toISOString().split('T')[0],
                                })}>
                                    Заказ {userData?.role === "superAdmin" && item?.forAggregator && "Агрегатор"}: 
                                </div>
                                <div className={clsx("", {
                                    "text-yellow-300": new Date(item?.date?.d) > new Date()
                                })}>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                <div>{item?.client?.fullName}</div>
                                <a target="_blank" rel="noreferrer" href={item?.address?.link} className={clsx("", {
                                    "text-blue-500 hover:text-green-500": item?.address?.point?.lat && item?.address?.point?.lon,
                                    "text-red": !item?.address?.point?.lat || !item?.address?.point?.lon
                                })}>{item?.address?.actual}</a>
                                <div>{(item?.products?.b12 !== 0 && item?.products?.b12 !== null) && <span>12.5л: <OrderInfo>{item?.products?.b12}</OrderInfo></span>}; {(item?.products?.b19 !== 0 && item?.products?.b19 !== null) && <span>18.9л: <OrderInfo>{item?.products?.b19}</OrderInfo></span>}</div>
                                <div>{item?.comment && <span className="text-yellow-300">Есть комм.</span>}</div>
                                <LinkButton
                                    href={`/orderPage/${item?._id}`}
                                >
                                    Просмотр
                                </LinkButton>
                                <MyButton click={() => {addOrderToAggregator(item?._id)}}>Добавить в агрегатор</MyButton>
                                <MyButton click={() => {toTomorrow(item?._id)}}>На завтра</MyButton>
                                <div>Причина: <span className="text-red">{item?.reason}</span></div>
                                {/* {userData?.role === "superAdmin" && <>
                                    {item?.transferred && 
                                    <div className={clsx("", {
                                        "text-white bg-red": new Date(item?.date?.d).toISOString().split('T')[0] < new Date().toISOString().split('T')[0],
                                    })}>
                                        {item?.transferredFranchise}
                                    </div>}
                                    {!item?.transferred && <MyButton click={() => {setOrder(item?._id); setFranchiseesModal(true)}}>Перенести</MyButton>}
                                    {item?.transferred &&  <MyButton click={() => {closeOrderTransfer(item?._id)}}>
                                        <span className="text-green-400">
                                            Отменить
                                        </span></MyButton>}
                                    </>} */}
                                <div>{item?.courier?.fullName}</div>
                            </div>
                        </Li>
                    </div>
                ))}
            </Container>
        </div>
    );
}
