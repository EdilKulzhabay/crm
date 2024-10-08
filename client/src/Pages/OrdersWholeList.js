import { useCallback, useRef, useState, useEffect } from "react";
import api from "../api";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import LinkButton from "../Components/LinkButton";
import Container from "../Components/Container";
import ChooseFranchiseeModal from "../Components/ChooseFranchiseeModal";
import ChooseCourierModal from "../Components/ChooseCourierModal";
import MySnackBar from "../Components/MySnackBar";
import clsx from "clsx";

export default function OrdersWholeList() {
    const [orders, setOrders] = useState([]);
    const [userData, setUserData] = useState({});
    const [search, setSearch] = useState("");
    const [searchF, setSearchF] = useState("");
    const [searchStatus, setSearchStatus] = useState(false);
    const [dates, setDates] = useState({
        startDate: "",
        endDate: "",
    });
    const [franchiseesModal, setFranchiseesModal] = useState(false);
    const [franchisee, setFranchisee] = useState(null);
    const [order, setOrder] = useState(null)
    const [totalOrders, setTotalOrders] = useState(0)
    const [orderCourier, setOrderCourier] = useState(null);
    const [couriersModal, setCouriersModal] = useState(false);
    const [orderCourierChange, setOrderCourierChange] = useState(null)

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

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

    const closeFranchiseeModal = () => {
        setFranchiseesModal(false);
    };

    const chooseFranchisee = (chFranchisee) => {
        console.log(chFranchisee);
        
        setFranchisee(chFranchisee);
        setFranchiseesModal(false);
    };

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setOrders([]);
            setPage(1);
            setHasMore(true);
            setSearchStatus(false)
            setLoading(false)
            loadMoreOrders(1, dates, "", false, searchF)
        }
    };

    const handleSearchF = (e) => {
        setSearchF(e.target.value);
        if (e.target.value === "") {
            setOrders([]);
            setPage(1);
            setHasMore(true);
            setLoading(false)
            loadMoreOrders(1, dates, search, searchStatus, "")
        }
    };

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setUserData(data);
        });
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
                temporaryOrders.map((item) => {
                    if (item._id === order) {
                        item.transferred = true
                        item.transferredFranchise = franchisee?.fullName
                    }
                })
                setOrders(temporaryOrders)
            }
        }).catch((e) => {})
    }

    const closeOrderTransfer = (id) => {
        api.post("/updateOrderTransfer", {orderId: id, change: "transferredFranchise", changeData: ""}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                setOpen(true)
                setMessage(data.message)
                setStatus("success")
                const temporaryOrders = [...orders]
                temporaryOrders.map((item) => {
                    if (item._id === id) {
                        item.transferred = false
                        item.transferredFranchise = ""
                    }
                })
                setOrders(temporaryOrders)
            }
        }).catch((e) => {})
    }

    useEffect(() => {
        if (orderCourier !== null && orderCourierChange !== null) {
            api.post("/updateOrder", {orderId: orderCourierChange, change: "courier", changeData: orderCourier}, {
                headers: { "Content-Type": "application/json" },
            }).then(({data}) => {
                orders.map((item) => {
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

    useEffect(() => {
        if (order && franchisee) {
            updateOrderTransfer()
        }
    }, [franchisee])

    const loadMoreOrders = useCallback(async (page, dates, search, searchStatus, searchF) => {
        if (loading || !hasMore) return;
        setLoading(true);

        api.post(
            "/getOrders",
            {
                page,
                ...dates,
                searchStatus,
                search,
                searchF
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setTotalOrders(data.totalOrders)
                if (data.orders.length === 0) {
                    setHasMore(false);
                } else {
                    if (page === 1) {
                        setOrders([...data.orders])
                    } else {
                        setOrders((prevOrders) => [...prevOrders, ...data.orders]);
                    }
                    setPage(page + 1);
                }
            })
            .catch((e) => {
                console.log(e);
            });
        setLoading(false);
    }, [page, loading]);

    useEffect(() => {
        console.log("useEffect triggered with hasMore:", hasMore);
        if (hasMore) {
            loadMoreOrders(page, dates, search, searchStatus, searchF);
        }
    }, [hasMore]);


    const observer = useRef();
    const lastOrderElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreOrders(page, dates, search, searchStatus, searchF);
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreOrders]
    );

    return (
        <div className="relative">
            {franchiseesModal && (
                <ChooseFranchiseeModal
                    closeFranchiseeModal={closeFranchiseeModal}
                    chooseFranchisee={chooseFranchisee}
                    scrollPosition={scrollPosition}
                />
            )}
            {couriersModal && (
                <ChooseCourierModal
                    closeCouriersModal={closeCouriersModal}
                    chooseCourier={chooseCourier}
                    scrollPosition={scrollPosition}
                />
            )}
            <Container role={userData.role || "admin"}>
                
                <Div>Список заказов</Div>
                <Div />
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
                </Div>

                {userData?.role === "superAdmin" && <>
                    <Div />
                    <Div>
                        Фильтрация по франчайзи:
                    </Div>
                    <Div>
                        <div className="flex items-center flex-wrap gap-x-4">
                            <MyInput
                                value={searchF}
                                change={handleSearchF}
                                color="white"
                            />
                            <MyButton click={() => {
                                setOrders([]);
                                setPage(1);
                                setHasMore(true);
                                setLoading(false)
                                loadMoreOrders(1, dates, search, searchStatus, searchF)
                            }}>Найти</MyButton>
                        </div>
                    </Div>
                </>
                }

                <Div />
                <Div>
                    <div>Заказы: {totalOrders}</div>
                </Div>
                <div className=" bg-black">
                    {orders.map((item, index) => {
                        if (orders.length === index + 1) {
                            return (
                                <div key={item?._id} ref={lastOrderElementRef}>
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
                                                {(item?.products?.b12 !== 0 && item?.products?.b12 !== null) && <>12.5л: {item?.products?.b12} {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.client?.price12}тг)</span>};</>}
                                                {(item?.products?.b19 !== 0 && item?.products?.b19 !== null) && <>{" "}18.9л: {item?.products?.b19} {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.client?.price19}тг)</span>};</>}
                                            </div>
                                            {/* <div>{item?.products?.b12 !== 0 && `12.5л: ${item?.products?.b12}`}; {item?.products?.b19 !== 0 && `18.9л: ${item?.products?.b19}`}</div> */}
                                            <div>{item?.comment && <span className="text-yellow-300">Есть комм.</span>}</div>
                                            <LinkButton
                                                href={`/orderPage/${item?._id}`}
                                            >
                                                Просмотр
                                            </LinkButton>
                                            
                                            {userData?.role === "superAdmin" && <>
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
                                                </>}
                                            <MyButton click={() => {
                                            setOrderCourierChange(item._id)
                                            setCouriersModal(true)
                                            }}>Курьер</MyButton>
                                            <div>{item?.courier?.fullName}</div>
                                        </div>
                                    </Li>
                                </div>
                            );
                        } else {
                            return (
                                <div key={item._id}>
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
                                            <div>{item?.products?.b12 !== 0 && `12.5л: ${item?.products?.b12}`}; {item?.products?.b19 !== 0 && `18.9л: ${item?.products?.b19}`}</div>
                                            <div>{item?.comment && <span className="text-yellow-300">Есть комм.</span>}</div>
                                            <LinkButton
                                                href={`/orderPage/${item?._id}`}
                                            >
                                                Просмотр
                                            </LinkButton>
                                            {userData?.role === "superAdmin" && <>
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
                                            </>}
                                            <MyButton click={() => {
                                                setOrderCourierChange(item._id)
                                                setCouriersModal(true)
                                                }}>Курьер</MyButton>
                                            <div>{item?.courier?.fullName}</div>
                                        </div>
                                    </Li>
                                </div>
                            );
                        }
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