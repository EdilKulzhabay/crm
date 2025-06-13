import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api"
import Container from "../../Components/Container"
import Div from "../../Components/Div"
import Li from "../../Components/Li"
import useFetchUserData from "../../customHooks/useFetchUserData"
import LinkButton from "../../Components/LinkButton"
import MyButton from "../../Components/MyButton"
import MyInput from "../../Components/MyInput"
import Info from "../../Components/Info"
import clsx from "clsx"

export default function SuperAdminAggregator() {
    const userData = useFetchUserData()
    const [allCouriers, setAllCouriers] = useState([])
    const [allOrders, setAllOrders] = useState([])
    const [couriers, setCouriers] = useState([])
    const [orders, setOrders] = useState([])
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [searchF, setSearchF] = useState("")
    const [totalCouriers, setTotalCouriers] = useState(0)
    const [totalOrders, setTotalOrders] = useState(0)
    const [isActive, setIsActive] = useState("all")
    const [orderStatus, setOrderStatus] = useState("all")

    const handleSearchF = (e) => {
        setSearchF(e.target.value)
        filterCouriers(e.target.value, isActive)
    }

    const filterCouriers = (search = searchF, active = isActive) => {
        let filtered = [...allCouriers]
        
        // Фильтрация по поиску
        if (search) {
            filtered = filtered.filter(courier => 
                courier.fullName.toLowerCase().includes(search.toLowerCase()) ||
                courier.phone.toLowerCase().includes(search.toLowerCase())
            )
        }
        
        // Фильтрация по активности
        if (isActive === "active") {
            filtered = filtered.filter(courier => courier.onTheLine === true)
        }

        if (isActive === "inActive") {
            filtered = filtered.filter(courier => courier.onTheLine === false)
        }
        
        setCouriers(filtered)
        setTotalCouriers(filtered.length)
    }

    const filterOrders = (status = orderStatus) => {
        let filtered = [...allOrders]
        
        // Фильтрация по статусу
        if (status) {
            filtered = filtered.filter(order => order.status === status)
        }
        
        setOrders(filtered)
        setTotalOrders(filtered.length)
    }

    const loadMoreCouriers = useCallback(async (page) => {
        if (loading || !hasMore) return
        setLoading(true)

        api.post(
            "/getCourierAggregators",
            {
                page,
                searchF: "",
                isActive
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.couriers.length === 0) {
                    setHasMore(false)
                } else {
                    if (page === 1) {
                        setAllCouriers([...data.couriers])
                    } else {
                        setAllCouriers((prevCouriers) => [...prevCouriers, ...data.couriers])
                    }
                    setPage(page + 1)
                    filterCouriers()
                }
            })
            .catch((e) => {
                console.log(e)
            })
        setLoading(false)
    }, [page, loading])

    const loadOrders = useCallback(async () => {
        api.post(
            "/getOrdersWithCourierAggregator",
            {orderStatus},
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setAllOrders(data.orders)
                filterOrders()
            })
            .catch((e) => {
                console.log(e)
            })
    }, [])

    useEffect(() => {
        if (hasMore) {
            loadMoreCouriers(page)
        }
        loadOrders()
    }, [hasMore])

    useEffect(() => {
        filterCouriers()
    }, [isActive, allCouriers])

    useEffect(() => {
        filterOrders()
    }, [orderStatus])

    const observer = useRef()
    const lastCourierElementRef = useCallback(
        (node) => {
            if (loading) return
            if (observer.current) observer.current.disconnect()
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreCouriers(page)
                }
            })
            if (node) observer.current.observe(node)
        },
        [loading, hasMore, loadMoreCouriers]
    )

    const updateCourierAggregatorData = (id, changeData) => {
        api.post("/updateCourierAggregatorData", {id, changeField: "onTheLine", changeData}, {
            headers: { "Content-Type": "application/json" },
        }).then()
    }

    return <Container role={userData?.role}>
        <Div>Агрегатор курьеров</Div>
        <Div />
        <Div>
            Фильтрация по курьерам:
        </Div>
        <Div>
            <div className="flex items-center flex-wrap gap-x-4">
                <MyInput
                    value={searchF}
                    change={handleSearchF}
                    color="white"
                />
                <MyButton click={() => {
                    const newIsActive = isActive === undefined ? true : isActive === true ? false : undefined
                    setIsActive(newIsActive)
                }}>
                    <span className={clsx("", {
                        "text-yellow-300": isActive === true,
                        "text-red-300": isActive === false
                    })}>
                        {isActive === undefined ? "Все" : isActive ? "Активные" : "Неактивные"}
                    </span>
                </MyButton>
            </div>
        </Div>
        <Div>
            <MyButton click={() => {setIsActive("all")}}>Все</MyButton>
            <MyButton click={() => {setIsActive("inActive")}}>Неактивные</MyButton>
            <MyButton click={() => {setIsActive("active")}}>Aктивные</MyButton>
        </Div>

        <Div />
        <Div>
            Количество курьеров: <Info>{totalCouriers}</Info>
        </Div>
        <div className="max-h-[400px] overflow-scroll bg-black">
            {couriers.map((courier, index) => {
                if (couriers.length === index + 1) {
                    return (
                        <div key={courier?._id} ref={lastCourierElementRef}>
                            <Li>
                                <div className="flex items-center gap-x-2 flex-wrap">
                                    <div>{courier.fullName}</div>
                                    <div>|</div>
                                    <div>{courier.phone}</div>
                                    <div>|</div>
                                    <div className={clsx("", {
                                        "text-green-500": courier.onTheLine,
                                        "text-red-500": !courier.onTheLine
                                    })}>
                                        {courier.onTheLine ? "Активен" : "Неактивен"}
                                    </div>
                                    <LinkButton
                                        color="green"
                                        href={`/CourierAggregatorPage/${courier._id}`}
                                    >
                                        Перейти
                                    </LinkButton>
                                    <MyButton click={() => {updateCourierAggregatorData(courier?.id, courier.onTheLine ? false : true)}}>{!courier.onTheLine ? "Активен" : "Неактивен"}</MyButton>
                                </div>
                            </Li>
                        </div>
                    )
                } else {
                    return (
                        <div key={courier._id}>
                            <Li>
                                <div className="flex items-center gap-x-2 flex-wrap">
                                    <div>{courier.fullName}</div>
                                    <div>|</div>
                                    <div>{courier.phone}</div>
                                    <div>|</div>
                                    <div className={clsx("", {
                                        "text-green-500": courier.onTheLine,
                                        "text-red-500": !courier.onTheLine
                                    })}>
                                        {courier.onTheLine ? "Активен" : "Неактивен"}
                                    </div>
                                    <LinkButton
                                        color="green"
                                        href={`/CourierAggregatorPage/${courier._id}`}
                                    >
                                        Перейти
                                    </LinkButton>
                                    <MyButton click={() => {updateCourierAggregatorData(courier?.id, courier.onTheLine ? false : true)}}>{!courier.onTheLine ? "Активен" : "Неактивен"}</MyButton>
                                </div>
                            </Li>
                        </div>
                    )
                }
            })}
        </div>

        <Div />
        <Div>Заказы с курьерами-агрегаторами</Div>
        <Div>
            <div className="flex items-center flex-wrap gap-x-4">
                <MyButton click={() => setOrderStatus("")}>
                    <span className={clsx("", {
                        "text-yellow-300": orderStatus === "all"
                    })}>Все</span>
                </MyButton>
                <MyButton click={() => setOrderStatus("awaitingOrder")}>
                    <span className={clsx("", {
                        "text-yellow-300": orderStatus === "awaitingOrder"
                    })}>В ожидании</span>
                </MyButton>
                <MyButton click={() => setOrderStatus("onTheWay")}>
                    <span className={clsx("", {
                        "text-yellow-300": orderStatus === "onTheWay"
                    })}>В пути</span>
                </MyButton>
                <MyButton click={() => setOrderStatus("delivered")}>
                    <span className={clsx("", {
                        "text-yellow-300": orderStatus === "delivered"
                    })}>Завершен</span>
                </MyButton>
                <MyButton click={() => setOrderStatus("cancelled")}>
                    <span className={clsx("", {
                        "text-yellow-300": orderStatus === "cancelled"
                    })}>Отменен</span>
                </MyButton>
            </div>
        </Div>
        <Div>
            Количество заказов: <Info>{totalOrders}</Info>
        </Div>
        <div className="max-h-[400px] overflow-scroll bg-black">
            {orders.map((order) => (
                <div key={order._id}>
                    <Li>
                        <div className="flex items-center gap-x-2 flex-wrap">
                            <div>Заказ #{order.orderNumber}</div>
                            <div>|</div>
                            <div>Курьер: {order.courierAggregator?.fullName}</div>
                            <div>|</div>
                            <div className={clsx("", {
                                "text-yellow-500": order.status === "awaitingOrder",
                                "text-blue-500": order.status === "onTheWay",
                                "text-green-500": order.status === "delivered",
                                "text-red-500": order.status === "cancelled"
                            })}>
                                {order.status === "awaitingOrder" && "В ожидании"}
                                {order.status === "onTheWay" && "В пути"}
                                {order.status === "delivered" && "Завершен"}
                                {order.status === "cancelled" && "Отменен"}
                            </div>
                            <LinkButton
                                color="green"
                                href={`/OrderPage/${order._id}`}
                            >
                                Редактировать
                            </LinkButton>
                        </div>
                    </Li>
                </div>
            ))}
        </div>

        <Div />
    </Container>
}