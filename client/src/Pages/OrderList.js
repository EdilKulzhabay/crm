import { useCallback, useRef, useState, useEffect } from "react";
import api from "../api";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import LinkButton from "../Components/LinkButton";
import Container from "../Components/Container";
import ChooseFranchiseeModal from "../Components/ChooseFranchiseeModal";
import MySnackBar from "../Components/MySnackBar";

export default function OrderList() {
    const [orders, setOrders] = useState([]);
    const [additionalOrders, setAdditionalOrders] = useState([])
    const [userData, setUserData] = useState({});
    const [search, setSearch] = useState("");
    const [searchStatus, setSearchStatus] = useState(false);
    const [dates, setDates] = useState({
        startDate: "",
        endDate: "",
    });
    const [franchiseesModal, setFranchiseesModal] = useState(false);
    const [franchisee, setFranchisee] = useState(null);
    const [order, setOrder] = useState(null)


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

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setOrders([]);
            setPage(1);
            setHasMore(true);
            setSearchStatus(false)
        }
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
        if (order && franchisee) {
            updateOrderTransfer()
        }
    }, [franchisee])

    const loadMoreOrders = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        api.post(
            "/getOrders",
            {
                page,
                ...dates,
                searchStatus,
                search
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                console.log(data);
                
                if (data.orders.length === 0) {
                    setHasMore(false);
                } else {
                    setOrders((prevOrders) => [...prevOrders, ...data.orders]);
                    setPage(page + 1);
                }
            })
            .catch((e) => {
                console.log(e);
            });
        setLoading(false);
    }, [page, loading, hasMore, searchStatus]);

    useEffect(() => {
        if (hasMore) {
            loadMoreOrders();
        }
    }, [hasMore]);

    const observer = useRef();
    const lastOrderElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreOrders();
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreOrders]
    );

    return (
        <Container role={userData.role || "admin"}>
            {franchiseesModal && (
                <ChooseFranchiseeModal
                    closeFranchiseeModal={closeFranchiseeModal}
                    chooseFranchisee={chooseFranchisee}
                />
            )}
            <Div>Список заказов</Div>
            <Div />
            <Div>Действия:</Div>
            <Div>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <LinkButton href="/addOrder">Создать заказ</LinkButton>
                </div>
            </Div>


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
                        console.log("userData", userData.role);
                        
                    }}>Найти</MyButton>
                </div>
            </Div>
            
            {userData?.role === "admin" && <>
                <Div />
                <Div>Доп. заказы</Div>
                <div className="max-h-[180px] overflow-scroll bg-black">
                    {additionalOrders.map((item) => {
                        return (
                            <div key={item?._id}>
                                <Li>
                                    <div className="flex items-center gap-x-3 flex-wrap">
                                    <div>
                                            Заказ: (
                                            {item?.createdAt.slice(0, 10)})
                                        </div>
                                        <div>{item?.client?.userName}</div>
                                        <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                        <div>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                        <div>{item?.products?.b12 !== 0 && `12.5л: ${item?.products?.b12}`}; {item?.products?.b19 !== 0 && `18.9л: ${item?.products?.b19}`}</div>
                                        <LinkButton
                                            href={`/orderPage/${item?._id}`}
                                        >
                                            Просмотр
                                        </LinkButton>
                                        <div>{item?.courier?.fullName}</div>
                                    </div>
                                </Li>
                            </div>
                        )
                    })}
                </div>
            </>}
            

            <Div />
            <Div>Активные заказы:</Div>
            <div className="max-h-[180px] overflow-scroll bg-black">
                {orders.map((item, index) => {
                    if (orders.length === index + 1) {
                        return (
                            <div key={item?._id} ref={lastOrderElementRef}>
                                <Li>
                                    <div className="flex items-center gap-x-3 flex-wrap">
                                        <div>
                                            Заказ: (
                                            {item?.createdAt.slice(0, 10)})
                                        </div>
                                        <div>{item?.client?.userName}</div>
                                        <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                        <div>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                        <div>{item?.products?.b12 !== 0 && `12.5л: ${item?.products?.b12}`}; {item?.products?.b19 !== 0 && `18.9л: ${item?.products?.b19}`}</div>
                                        <LinkButton
                                            href={`/orderPage/${item?._id}`}
                                        >
                                            Просмотр
                                        </LinkButton>
                                        {userData?.role === "superAdmin" && <>
                                            {item?.transferred && <div>{item?.transferredFranchise}</div>}
                                            {!item?.transferred && <MyButton click={() => {setOrder(item?._id); setFranchiseesModal(true)}}>Перенести</MyButton>}
                                            {item?.transferred &&  <MyButton click={() => {closeOrderTransfer(item?._id)}}>
                                                <span className="text-green-400">
                                                    Отменить
                                                </span></MyButton>}
                                            </>}
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
                                        <div>
                                            Заказ: (
                                            {item?.createdAt.slice(0, 10)})
                                        </div>
                                        <div>{item?.client?.userName}</div>
                                        <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                        <div>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                        <div>{item?.products?.b12 !== 0 && `12.5л: ${item?.products?.b12}`}; {item?.products?.b19 !== 0 && `18.9л: ${item?.products?.b19}`}</div>
                                        <LinkButton
                                            href={`/orderPage/${item?._id}`}
                                        >
                                            Просмотр
                                        </LinkButton>
                                        {userData?.role === "superAdmin" && <>
                                            {item?.transferred && <div>{item?.transferredFranchise}</div>}
                                            {!item?.transferred && <MyButton click={() => {setOrder(item?._id); setFranchiseesModal(true)}}>Перенести</MyButton>}
                                            {item?.transferred &&  <MyButton click={() => {closeOrderTransfer(item?._id)}}><span className="text-green-400">
                                    Отменить
                                </span></MyButton>}
                                        </>}
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
            <Div>
                <LinkButton href="/completedOrders">Завершенные заказы</LinkButton>
            </Div>

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
