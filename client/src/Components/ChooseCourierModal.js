import { useCallback, useRef, useState, useEffect } from "react";
import api from "../api";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";

export default function ChooseCourierModal(props) {
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

    const choose = (courier) => {
        props.chooseCourier(courier);
    };

    return (
        <div
            onClick={() => {
                props.closeCouriersModal();
            }}
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80"
        >
            <div
                onClick={(e) => {
                    e.stopPropagation();
                }}
                className="relative px-8 py-4 border border-red rounded-md"
            >
                <div className="text-center">Выбор курьера</div>
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
                <Div>Список курьеров:</Div>
                <div className="max-h-[100px] overflow-scroll">
                    {couriers.map((item, index) => {
                        if (couriers.length === index + 1) {
                            return (
                                <div key={item._id} ref={lastCourierElementRef}>
                                    <Li>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-x-2 flex-wrap">
                                                <div>{item.fullName}</div>
                                            </div>
                                            <div className="min-w-max ml-5 lg:ml-10 flex items-center">
                                                <MyButton
                                                    click={() => {
                                                        choose(item);
                                                    }}
                                                >
                                                    <span className="text-green-400">
                                Выбрать
                            </span>
                                                </MyButton>
                                            </div>
                                        </div>
                                    </Li>
                                </div>
                            );
                        } else {
                            return (
                                <div key={item._id}>
                                    <Li>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-x-2 flex-wrap">
                                                <div>{item.fullName}</div>
                                            </div>
                                            <div className="min-w-max ml-5 lg:ml-10 flex items-center">
                                                <MyButton
                                                    click={() => {
                                                        choose(item);
                                                    }}
                                                >
                                                    <span className="text-green-400">
                                Выбрать
                            </span>
                                                </MyButton>
                                            </div>
                                        </div>
                                    </Li>
                                </div>
                            );
                        }
                    })}
                    {loading && <div>Загрузка...</div>}
                </div>
            </div>
        </div>
    );
}
