import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import Li2 from "../../Components/Li2";
import MyButton from "../../Components/MyButton";
import MyInput from "../../Components/MyInput";
import MySnackBar from "../../Components/MySnackBar";

export default function SuperAdminClientManagment() {
    const [search, setSearch] = useState("");
    const [clients, setClients] = useState([]);
    const [modal, setModal] = useState(false);
    const [franchisees, setFranchisees] = useState([]);
    const [chooseF, setChooseF] = useState(null);
    const [chooseC, setChooseC] = useState(null);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [info, setInfo] = useState({});

    const closeSnack = () => {
        setOpen(false);
    };

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const getMe = () => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setInfo(data);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        getMe();
        api.get("/getAllFranchisee", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                console.log(data);
                setFranchisees(data.franchisees);
            })
            .catch((e) => {
                console.log(e);
            });
    }, []);

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

    const updateClientFranchisee = () => {
        api.post(
            "/updateClientFranchisee",
            { clientId: chooseC, franchiseeId: chooseF },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setOpen(true);
                setStatus(data.success ? "success" : "error");
                setMessage(data.message);
                setClients([]);
                setPage(1);
                setHasMore(true);
                setModal(false);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const updateNotificationTypes = (type) => {
        api.post(
            "/updateNotificationTypes",
            { type },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setOpen(true);
                setMessage(data.message);
                setStatus("success");
                getMe();
            })
            .catch((e) => {
                console.log(e);
            });
    };

    return (
        <Container role="superAdmin">
            {modal && (
                <div
                    onClick={() => {
                        setModal(false);
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80"
                >
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                        className="relative px-8 py-4 border border-red rounded-md"
                    >
                        <div className="text-center">Выберите франчайзи</div>
                        <div className="mt-5 flex flex-col gap-y-3">
                            {franchisees &&
                                franchisees.length > 0 &&
                                franchisees.map((item) => {
                                    return (
                                        <div
                                            key={item._id}
                                            className="flex items-center justify-between"
                                        >
                                            <div>{item.fullName}</div>
                                            <button
                                                onClick={() => {
                                                    setChooseF(item._id);
                                                }}
                                                className="flex items-center justify-center border border-red w-5 h-5 p-px rounded-full ml-5 lg:ml-10"
                                            >
                                                {chooseF === item._id && (
                                                    <div className="w-3 h-3 bg-red rounded-full"></div>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                        </div>

                        <div className="mt-5 flex justify-center">
                            <MyButton click={updateClientFranchisee}>
                                Перенести
                            </MyButton>
                        </div>
                    </div>
                </div>
            )}
            <Div>Управление клиентами</Div>
            <Div />
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
            <Div>Список клиентов</Div>
            <div className="max-h-[100px] overflow-scroll">
                {clients.map((client, index) => {
                    if (clients.length === index + 1) {
                        return (
                            <div key={client._id} ref={lastClientElementRef}>
                                <Li>
                                    <div className="flex items-center gap-x-3 flex-wrap">
                                        <div>Клиент:</div>
                                        <div>{client.fullName}</div>
                                        <div>|</div>
                                        <div>Текущий франчайзи:</div>
                                        <div>
                                            {client?.franchisee?.fullName}
                                        </div>
                                        <MyButton
                                            click={() => {
                                                setModal(true);
                                                setChooseC(client._id);
                                            }}
                                        >
                                            Перенести
                                        </MyButton>
                                    </div>
                                </Li>
                            </div>
                        );
                    } else {
                        return (
                            <div key={client._id}>
                                <Li>
                                    <div className="flex items-center gap-x-3 flex-wrap">
                                        <div>Клиент:</div>
                                        <div>{client.fullName}</div>
                                        <div>|</div>
                                        <div>Текущий франчайзи:</div>
                                        <div>
                                            {client?.franchisee?.fullName}
                                        </div>
                                        <MyButton
                                            click={() => {
                                                setModal(true);
                                                setChooseC(client._id);
                                            }}
                                        >
                                            Перенести
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
            <Div>Уведомлений:</Div>
            {/* <Li>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <div>
                        Получать уведомления о заказах, сделанных не своему
                        франчайзи:
                    </div>
                    <div>Включено</div>
                    <div className="flex items-center gap-x-2 flex-wrap text-red">
                        [
                        <button
                            className="text-red hover:text-blue-900"
                            onClick={() => {}}
                        >
                            Включить
                        </button>
                        <div>/</div>
                        <button
                            className="text-red hover:text-blue-900"
                            onClick={() => {}}
                        >
                            Отключить
                        </button>
                        ]
                    </div>
                </div>
            </Li> */}
            <Li>Критерий для уведомления:</Li>
            <Li2>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyButton
                        click={() => {
                            updateNotificationTypes("phone");
                        }}
                    >
                        {(info.notificationTypes || []).includes("phone")
                            ? "✓"
                            : "x"}
                    </MyButton>
                    <div>Телефонный номер клиента</div>
                </div>
            </Li2>
            <Li2>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyButton
                        click={() => {
                            updateNotificationTypes("address");
                        }}
                    >
                        {(info.notificationTypes || []).includes("address")
                            ? "✓"
                            : "x"}
                    </MyButton>
                    <div>Адрес доставки</div>
                </div>
            </Li2>
            <Li2>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyButton
                        click={() => {
                            updateNotificationTypes("mail");
                        }}
                    >
                        {(info.notificationTypes || []).includes("mail")
                            ? "✓"
                            : "x"}
                    </MyButton>
                    <div>Email клиента</div>
                </div>
            </Li2>
            <Li2>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyButton
                        click={() => {
                            updateNotificationTypes("fullName");
                        }}
                    >
                        {(info.notificationTypes || []).includes("fullName")
                            ? "✓"
                            : "x"}
                    </MyButton>
                    <div>ФИО клиента</div>
                </div>
            </Li2>

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
