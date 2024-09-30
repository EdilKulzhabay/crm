import { useCallback, useEffect, useRef, useState } from "react"
import Container from "../Components/Container"
import Div from "../Components/Div"
import api from "../api"
import Li from "../Components/Li"
import LinkButton from "../Components/LinkButton"
import DataInput from "../Components/DataInput"
import MyButton from "../Components/MyButton"
import MyInput from "../Components/MyInput"

export default function CompletedOrders() {
    const [userData, setUserData] = useState({});
    const [completedOrders, setCompletedOrders] = useState([])
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [info, setInfo] = useState({
        totalB12: 0,
        totalB19: 0,
        totalSum: 0
    })

    const [search, setSearch] = useState("");
    const [searchStatus, setSearchStatus] = useState(false);
    const [dates, setDates] = useState({
        startDate: "",
        endDate: "",
    });

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

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setCompletedOrders([]);
            setPage(1);
            setHasMore(true);
            setSearchStatus(false)
            loadMoreCompletedOrders()
        }
    };

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setUserData(data);
        });
    }, []);

    const loadMoreCompletedOrders = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        
        api.post(
            "/getCompletedOrders",
            {
                page, ...dates, search, searchStatus
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setInfo({
                    totalB12: data.totalB12,
                    totalB19: data.totalB19,
                    totalSum: data.totalSum
                })
                if (data.orders.length === 0) {
                    setHasMore(false);
                } else {
                    setCompletedOrders((prevCompletedOrders) => [...prevCompletedOrders, ...data.orders]);
                    setPage(page + 1);
                }
            })
            .catch((e) => {
                console.log(e);
            });
        setLoading(false);
    }, [page, loading, hasMore]);

    useEffect(() => {
        if (hasMore) {
            loadMoreCompletedOrders();
        }
    }, [hasMore]);

    const observer = useRef();
    const lastOrderElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreCompletedOrders();
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreCompletedOrders]
    );

    return <Container role={userData?.role || ""}>
        <Div>Завершенные заказы</Div>
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
                    setCompletedOrders([]);
                    setPage(1);
                    setHasMore(true);
                    setSearchStatus(true)
                    setLoading(false)
                    loadMoreCompletedOrders()
                }}>Найти</MyButton>
            </div>
        </Div>
        <Div />
        <Div>Фильтры:</Div>
        <>
            <Li>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <div>Дата регистрации:</div>
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
                    <MyButton click={() => {
                        setCompletedOrders([])
                        setPage(1)
                        setLoading(false)
                        setHasMore(true)
                        loadMoreCompletedOrders()
                    }}>
                        Применить
                    </MyButton>
                </div>
            </Li>
        </>
        <Div />
        <Div>
            Сводная информация:
        </Div>
        <Li>
            12,5 литровая бутыль: <span className="text-red">[ {info.totalB12} ]</span>
        </Li>
        <Li>
            18,9 литровая бутыль: <span className="text-red">[ {info.totalB19} ]</span>
        </Li>
        <Li>
            Сумма: <span className="text-red">[ {info.totalSum} ]</span>
        </Li>
        
        <Div />
        <div className="max-h-[180px] overflow-scroll">
            {completedOrders.map((item, index) => {
                if (completedOrders.length === index + 1) {
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
                                        </>}
                                    <div>{item?.courier?.fullName}</div>
                                </div>
                            </Li>
                        </div>
                    );
                } else {
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
                                    {userData?.role === "superAdmin" && <>
                                        {item?.transferred && <div>{item?.transferredFranchise}</div>}
                                        </>}
                                    <div>{item?.courier?.fullName}</div>
                                </div>
                            </Li>
                        </div>
                    );
                }
            })}
        </div>
        <Div />
    </Container>
}