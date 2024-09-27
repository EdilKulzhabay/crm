import { useCallback, useRef, useState, useEffect } from "react";
import api from "../api";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";

export default function ChooseClientModal(props) {
    const [search, setSearch] = useState("");
    const [clients, setClients] = useState([]);

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setClients([]);
            setPage(1);
            setHasMore(true);
        }
    };

    const searchClient = () => {
        setHasMore(false);
        api.post(
            "/searchClient",
            { search },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setClients(data);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const loadMoreClients = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        api.post(
            "/getClients",
            { page, status: "all" },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.clients.length === 0) {
                    setHasMore(false);
                } else {
                    setClients((prevClients) => [
                        ...prevClients,
                        ...data.clients,
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
            loadMoreClients();
        }
    }, [hasMore]);

    const observer = useRef();
    const lastClientElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreClients();
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreClients]
    );

    const choose = (client) => {
        props.chooseClient(client);
    };

    return (
        <div
            onClick={() => {
                props.closeClientsModal();
            }}
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80"
        >
            <div
                onClick={(e) => {
                    e.stopPropagation();
                }}
                className="relative px-8 py-4 border border-red rounded-md"
            >
                <div className="text-center">Выбор клиента</div>
                <Div>
                    <div>Поиск клиента:</div>
                </Div>
                <Div>
                    <div className="flex items-center flex-wrap gap-x-4">
                        <MyInput
                            value={search}
                            change={handleSearch}
                            color="white"
                        />
                        <MyButton click={searchClient}>Найти</MyButton>
                    </div>
                </Div>
                <Div />
                <Div>Список клиентов:</Div>
                <div className="max-h-[100px] overflow-scroll">
                    {clients.map((client, index) => {
                        if (clients.length === index + 1) {
                            return (
                                <div
                                    key={client._id}
                                    ref={lastClientElementRef}
                                >
                                    <Li>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-x-2 flex-wrap">
                                                <div>{client.userName}</div>
                                                <div>|</div>
                                                <div>{client.phone}</div>
                                            </div>
                                            <div className="min-w-max ml-5 lg:ml-10 flex items-center">
                                                <MyButton
                                                    click={() => {
                                                        choose(client);
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
                                <div key={client._id}>
                                    <Li>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-x-2 flex-wrap">
                                                <div>{client.userName}</div>
                                                <div>|</div>
                                                <div>{client.phone}</div>
                                            </div>
                                            <div className="min-w-max ml-5 lg:ml-10 flex items-center">
                                                <MyButton
                                                    click={() => {
                                                        choose(client);
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
