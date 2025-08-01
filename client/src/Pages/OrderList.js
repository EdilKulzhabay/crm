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
import clsx from "clsx";
import OrderInfo from "../Components/OrderInfo";
import useFetchUserData from "../customHooks/useFetchUserData";
import useScrollPosition from "../customHooks/useScrollPosition";
import DataInput from "../Components/DataInput";

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


export default function OrderList() {
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

        setDates({ ...dates, [e.target.name]: formattedValue });
    };

    const handleDate = () => {
        if (dates.startDate.length !== 10 || dates.endDate.length !== 10) {
            setOpen(true)
            setStatus("error")
            setMessage("Введите даты в формате ГГГГ-ММ-ДД")
            return
        }
        
        setOrders([]);
        setPage(1);
        setHasMore(true);
        setLoading(false)
        loadMoreOrders(1, dates, search, searchStatus, searchF, sa)
        getAdditionalOrders()
    }

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setOrders([]);
            setPage(1);
            setHasMore(true);
            setSearchStatus(false)
            setLoading(false)
            loadMoreOrders(1, dates, "", false, searchF, sa)
        }
    };

    const handleSearchF = (e) => {
        setSearchF(e.target.value);
        if (e.target.value === "") {
            setOrders([]);
            setPage(1);
            setHasMore(true);
            setLoading(false)
            loadMoreOrders(1, dates, search, searchStatus, "", sa)
        }
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

    const closeOrderTransfer = (id) => {
        api.post("/updateOrderTransfer", {orderId: id, change: "transferredFranchise", changeData: ""}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                setOpen(true)
                setMessage(data.message)
                setStatus("success")
                const temporaryOrders = [...orders]
                temporaryOrders.forEach((item) => {
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

    const loadMoreOrders = useCallback(async (page, dates, search, searchStatus, searchF, sa) => {
        if (loading || !hasMore) return;
        setLoading(true);

        api.post(
            "/getOrders",
            {
                page,
                ...dates,
                searchStatus,
                search,
                searchF, 
                sa
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
            loadMoreOrders(page, dates, search, searchStatus, searchF, sa);
        }
    }, [hasMore]);


    const observer = useRef();
    const lastOrderElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreOrders(page, dates, search, searchStatus, searchF, sa);
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
            <Container role={userData?.role}>
                
                <Div>Список заказов</Div>
                <Div />
                <Div>Действия:</Div>
                <Div>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <LinkButton color="green" href="/addOrder">Создать заказ</LinkButton>
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
                            loadMoreOrders(1, dates, search, true, searchF, sa)
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
                                loadMoreOrders(1, dates, search, searchStatus, searchF, sa)
                            }}>Найти</MyButton>
                            <MyButton click={() => {
                                const free = searchF === "empty" ? "" : "empty"
                                setOrders([]);
                                setPage(1);
                                setHasMore(true);
                                setLoading(false)
                                loadMoreOrders(1, dates, search, searchStatus, free, sa)
                                setSearchF(free)
                            }}>Свободные</MyButton>
                            <MyButton click={() => {
                                const saStatus = !sa
                                setOrders([]);
                                setPage(1);
                                setHasMore(true);
                                setLoading(false)
                                loadMoreOrders(1, dates, search, searchStatus, searchF, saStatus)
                                setSa(saStatus)
                            }}><span className={clsx("", {"text-yellow-300": sa})}>admin</span></MyButton>
                        </div>
                    </Div>
                </>
                }
                
                <Div />
                <Div>Фильтры:</Div>
                <>
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>Дата:</div>
                            <div className="text-red">
                                [
                                <DataInput
                                    color="red"
                                    value={dates.startDate}
                                    name="startDate"
                                    change={handleDateChange}
                                />
                                ]
                            </div>
                            <div> - </div>
                            <div className="text-red">
                                [
                                <DataInput
                                    color="red"
                                    value={dates.endDate}
                                    name="endDate"
                                    change={handleDateChange}
                                />
                                ]
                            </div>
                            <MyButton click={handleDate}>
                                <span className="text-green-400">
                                    Применить
                                </span>
                            </MyButton>
                        </div>
                    </Li>
                </>

                
                
                {userData?.role === "admin" && <>
                    <Div />
                    <Div>
                        <div>Доп. заказы: {additionalOrders.length}</div>
                        <div><LinkButton href={`/additionalOrdersWholeList`}>Полный список</LinkButton></div>
                    </Div>
                    <div className="max-h-[180px] overflow-scroll bg-black">
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
                                            <div>{item?.courier?.fullName}</div>
                                        </div>
                                    </Li>
                                </div>
                            )
                        })}
                    </div>
                </>}
                

                <Div />
                <Div>
                    <div>Заказы: {totalOrders}</div>
                    <div><LinkButton href={`/ordersWholeList`}>Полный список</LinkButton></div>
                </Div>
                <div className="max-h-[180px] overflow-scroll bg-black">
                    {orders.map((item, index) => {
                        if (orders.length === index + 1) {
                            return (
                                <div key={item?._id} ref={lastOrderElementRef}>
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
                                            <div>{item?.courier?.fullName}</div>
                                        </div>
                                    </Li>
                                </div>
                            );
                        } else {
                            return (
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
                                            {userData?.role === "superAdmin" && <>
                                                {item?.transferred && 
                                                <div className={clsx("", {
                                                    "text-white bg-red": new Date(item?.date?.d).toISOString().split('T')[0] < new Date().toISOString().split('T')[0],
                                                })}>
                                                    {item?.transferredFranchise}
                                                </div>}
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
        </div>
    );
}
