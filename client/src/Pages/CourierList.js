import { useEffect, useState, useCallback, useRef } from "react";
import Div from "../Components/Div";
import Info from "../Components/Info";
import Li from "../Components/Li";
import Li2 from "../Components/Li2";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import LinkButton from "../Components/LinkButton";
import api from "../api";
import Container from "../Components/Container";

export default function CourierList() {
    const [search, setSearch] = useState("");
    const [total, setTotal] = useState(0);
    const [couriers, setCouriers] = useState([]);
    const [role, setRole] = useState("superAdmin");

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setCouriers([]);
            setPage(1);
            setHasMore(true);
        }
    };

    const searchCourier = () => {
        setHasMore(false);
        api.post(
            "/searchCourier",
            { search },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setCouriers(data);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const updateCouriserStatus = (id, status) => {
        let value = "active"
        if (status === "active") {
            value = "inActive"
        }
        api.post("/updateCourierData", {courierId: id, field: "status", value}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                const updatedCouriers = couriers.map(courier => 
                    courier._id === id ? { ...courier, status: value } : courier
                );
                setCouriers(updatedCouriers);
            }
        }).catch((e) => {
            console.log(e);
        })
    }

    const getFreeInfo = () => {
        api.get("/getFreeInfoCourier", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setTotal(data.total);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setRole(data.role);
            })
            .catch((e) => {
                console.log(e);
            });
        getFreeInfo();
    }, []);

    const loadMoreCoriers = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        api.post(
            "/getCouriers",
            { page },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                // console.log(data);
                if (data.couriers.length === 0) {
                    setHasMore(false);
                } else {
                    setCouriers((prevCouriers) => [
                        ...prevCouriers,
                        ...data.couriers,
                    ]);
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
            loadMoreCoriers();
        }
    }, [hasMore]);

    const observer = useRef();
    const lastCourierElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreCoriers();
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreCoriers]
    );

    return (
        <Container role={role}>
            <Div>
                <div>Курьеры</div>
            </Div>
            <Div />

            <Div>
                <div>Поиск курьера:</div>
            </Div>
            <Div>
                <div className="flex items-center flex-wrap gap-x-4">
                    <MyInput
                        value={search}
                        change={handleSearch}
                        color="white"
                    />
                    <MyButton click={searchCourier}>Найти</MyButton>
                </div>
            </Div>
            <Div />
            <Div>Сводная информация:</Div>
            <Li>
                <div className="flex items-center flex-wrap">
                    <div>Общее количество курьеров:</div>
                    <Info>{total}</Info>
                </div>
            </Li>
            <Div />
            <Div>Список курьеров:</Div>
            <div className="max-h-[100px] overflow-scroll">
                {couriers &&
                    couriers.length > 0 &&
                    couriers.map((item, index) => {
                        if (couriers.length === index + 1) {
                            return (
                                <div key={item?._id} ref={lastCourierElementRef}>
                                    <Li>
                                        <div className="flex items-center gap-x-2 flex-wrap">
                                            <div>Имя:</div>
                                            <div>{item?.fullName}</div>
                                            <div>|</div>
                                            <div>Статус:</div>
                                            <div>
                                                {item?.status === "active"
                                                    ? "Активен"
                                                    : "Неактивен"}
                                            </div>
                                            <LinkButton
                                                href={`/CourierPage/${item?._id}`}
                                            >
                                                Просмотр
                                            </LinkButton>
                                            <MyButton click={() => {updateCouriserStatus(item?._id, item?.status)}}>
                                                {item?.status === "active"
                                                    ? "Блокировать"
                                                    : "Разблокировать"}
                                            </MyButton>
                                        </div>
                                    </Li>
                                    <Li2>
                                        <div className="flex items-center gap-x-3 flex-wrap">
                                            <div>
                                                Количество выполненных заказов: {item?.completedOrders}
                                            </div>
                                        </div>
                                    </Li2>
                                </div>
                            );
                        } else {
                            return (
                                <div key={item?._id}>
                                    <Li>
                                        <div className="flex items-center gap-x-2 flex-wrap">
                                            <div>Имя:</div>
                                            <div>{item?.fullName}</div>
                                            <div>|</div>
                                            <div>Статус:</div>
                                            <div>
                                                {item?.status === "active"
                                                    ? "Активен"
                                                    : "Неактивен"}
                                            </div>
                                            <LinkButton
                                                href={`/CourierPage/${item?._id}`}
                                            >
                                                Просмотр
                                            </LinkButton>
                                            <MyButton click={() => {}}>
                                                {item?.status === "active"
                                                    ? "Блокировать"
                                                    : "Разблокировать"}
                                            </MyButton>
                                        </div>
                                    </Li>
                                    <Li2>
                                        <div className="flex items-center gap-x-3 flex-wrap">
                                            <div>
                                                Количество выполненных заказов: {item?.completedOrders}
                                            </div>
                                        </div>
                                    </Li2>
                                </div>
                            );
                        }
                    })}
                {loading && <div>Загрузка...</div>}
            </div>

            <Div />
            <Div>
                <LinkButton href="/addCourier">Добавить курьера</LinkButton>
            </Div>
            <Div />
        </Container>
    );
}
