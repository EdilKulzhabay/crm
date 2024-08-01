import { useCallback, useRef, useState, useEffect } from "react";
import api from "../api";
import DataInput from "../Components/DataInput";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import Info from "../Components/Info";
import LinkButton from "../Components/LinkButton";
import MySnackBar from "../Components/MySnackBar";
import Container from "../Components/Container";
import ChooseCourierModal from "../Components/ChooseCourierModal";

export default function OrderList() {
    const [orders, setOrders] = useState([]);
    const [userData, setUserData] = useState({});
    const [search, setSearch] = useState("");
    const [dates, setDates] = useState({
        startDate: "",
        endDate: "",
    });
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterProduct, setFilterProduct] = useState("all");
    const [filterSort, setFilterSort] = useState("new");
    const [couriersModal, setCouriersModal] = useState(false);
    const [courier, setCourier] = useState(null);

    const [freeInfo, setFreeInfo] = useState({
        totalB12: 0,
        totalB19: 0,
        totalSum: 0,
        orderCount: 0,
    });

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const closeCouriersModal = () => {
        setCouriersModal(false);
    };

    const chooseCourier = (chCourier) => {
        setCourier(chCourier);
        setCouriersModal(false);
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

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            // setClients([]);
            // setPage(1);
            // setHasMore(true);
        }
    };

    // const getFreeInfo = () => {
    //     api.get("/getFreeInfo", {
    //         headers: { "Content-Type": "application/json" },
    //     })
    //         .then(({ data }) => {
    //             setFreeInfo({
    //                 activeTotal: data.activeTotal,
    //                 inActiveTotal: data.inActiveTotal,
    //                 total: data.total,
    //             });
    //         })
    //         .catch((e) => {
    //             console.log(e);
    //         });
    // };

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setUserData(data);
        });
        api.get("/getFreeInfoOrder", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setFreeInfo(data);
            //console.log(data);
        });
    }, []);

    const getOrdersWithFilter = () => {
        setOrders([]);
        setPage(1);
        setHasMore(true);
    };

    const loadMoreOrders = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        api.post(
            "/getOrders",
            {
                page,
                ...dates,
                status: filterStatus,
                product: filterProduct,
                sort: filterSort,
                courier: courier ? courier._id : "",
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
    }, [page, loading, hasMore]);

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
            {couriersModal && (
                <ChooseCourierModal
                    closeCouriersModal={closeCouriersModal}
                    chooseCourier={chooseCourier}
                />
            )}
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
                    <MyButton click={() => {}}>Найти</MyButton>
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
                        <MyButton click={getOrdersWithFilter}>
                            Применить
                        </MyButton>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Статус:</div>
                        <div className="flex items-center gap-x-2 flex-wrap text-red">
                            <div>[</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterStatus("all");
                                }}
                            >
                                Все статусы
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterStatus("awaitingOrder");
                                }}
                            >
                                Ожидает заказ
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterStatus("onTheWay");
                                }}
                            >
                                В пути
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterStatus("delivered");
                                }}
                            >
                                Доставлен
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterStatus("cancelled");
                                }}
                            >
                                Отменен
                            </button>
                            <div>]</div>
                        </div>
                        <MyButton click={getOrdersWithFilter}>
                            Применить
                        </MyButton>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Продукция:</div>
                        <div className="flex items-center gap-x-3 flex-wrap text-red">
                            <div>[</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterProduct("all");
                                }}
                            >
                                Все
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterProduct("b12");
                                }}
                            >
                                12,5 л
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterProduct("b19");
                                }}
                            >
                                19,8 л
                            </button>
                            <div>]</div>
                        </div>
                        <MyButton click={getOrdersWithFilter}>
                            Применить
                        </MyButton>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Курьер:</div>
                        <div className="flex items-center gap-x-2 flex-wrap text-red">
                            <div>[</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setCourier(null);
                                }}
                            >
                                Все
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setCouriersModal(true);
                                }}
                            >
                                Выбрать
                            </button>
                            <div>]</div>
                            <div className="text-white">
                                {courier && courier.fullName}
                            </div>
                        </div>
                        <MyButton click={getOrdersWithFilter}>
                            Применить
                        </MyButton>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Сортировка:</div>
                        <div className="flex items-center gap-x-2 flex-wrap text-red">
                            <div>[</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterSort("new");
                                }}
                            >
                                Новые
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterSort("old");
                                }}
                            >
                                Старые
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterSort("expensive");
                                }}
                            >
                                Дорогие
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-900"
                                onClick={() => {
                                    setFilterSort("cheap");
                                }}
                            >
                                Дешевые
                            </button>
                            <div>]</div>
                        </div>
                        <MyButton click={getOrdersWithFilter}>
                            Применить
                        </MyButton>
                    </div>
                </Li>
            </>

            <Div />
            <Div>Сводная информация:</Div>
            <Li>
                <div className="flex items-center flex-wrap">
                    <div>Общее количество заказов:</div>
                    <Info>{freeInfo.orderCount}</Info>
                </div>
            </Li>
            <Li>
                <div className="flex items-center flex-wrap">
                    <div>Количество 12,5-литровых бутылей:</div>
                    <Info>{freeInfo.totalB12}</Info>
                </div>
            </Li>
            <Li>
                <div className="flex items-center flex-wrap">
                    <div>Количество 18,9-литровых бутылей:</div>
                    <Info>{freeInfo.totalB19}</Info>
                </div>
            </Li>
            <Li>
                <div className="flex items-center flex-wrap">
                    <div>Общая сумма заказов:</div>
                    <Info>{freeInfo.totalSum}</Info>
                </div>
            </Li>

            <Div />
            <Div>Список заказов:</Div>
            <div className="max-h-[100px] overflow-scroll">
                {orders.map((item, index) => {
                    if (orders.length === index + 1) {
                        return (
                            <div key={item._id} ref={lastOrderElementRef}>
                                <Li>
                                    <div className="flex items-center gap-x-3 flex-wrap">
                                        <div>Заказ:</div>
                                        <div>{item.client.fullName}</div>
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
                                            {item.createdAt.slice(0, 10)})
                                        </div>
                                        <div>{item.client.fullName}</div>
                                        <div>
                                            {item.products.b12 && (
                                                <span>
                                                    12,5л - {item.products.b12}
                                                    шт{" "}
                                                </span>
                                            )}
                                            {item.products.b19 && (
                                                <span>
                                                    19,8л - {item.products.b19}
                                                    шт
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-red">
                                            ({item.date.d.slice(0, 10)}){" "}
                                            {item.date.time && item.date.time}
                                        </div>
                                        <LinkButton
                                            href={`/orderPage/${item._id}`}
                                        >
                                            Просмотр
                                        </LinkButton>
                                        <MyButton click={() => {}}>
                                            Назначить крьера
                                        </MyButton>
                                    </div>
                                </Li>
                            </div>
                        );
                    }
                })}
                {loading && <div>Загрузка...</div>}
            </div>

            <Div />
        </Container>
    );
}
