import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Info from "../../Components/Info";
import Li from "../../Components/Li";
import MyButton from "../../Components/MyButton";
import MySnackBar from "../../Components/MySnackBar";
import UpdateFranchiseeData from "../../Components/UpdateFranchiseeData";
import useScrollPosition from "../../customHooks/useScrollPosition";
import ConfirmDeleteModal from "../../Components/ConfirmDeleteModal";
import useFetchUserData from "../../customHooks/useFetchUserData";

export default function SuperAdminUpdateFranchisee() {
    const scrollPosition = useScrollPosition();
    const userData = useFetchUserData();
    const navigate = useNavigate();

    const { id } = useParams();
    const [clients, setClients] = useState([])

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [info, setInfo] = useState({})
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [bottles, setBottles] = useState({
        b121kol: "",
        b191kol: "",
        b197kol: ""
    })

    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteObject, setDeleteObject] = useState(null)

    const confirmDelete = () => {
        deleteFranchisee()
        setDeleteModal(false)
        setDeleteObject(null)
    }

    const closeConfirmModal = () => {
        setDeleteModal(false)
        setDeleteObject(null)
    }

    const handleBottlesChange = (event) => {
        setBottles({ ...bottles, [event.target.name]: event.target.value });
    };

    const closeSnack = () => {
        setOpen(false);
    };

    const [franchisee, setFranchisee] = useState({});

    const getFranchiseeById = () => {
        api.post(
            "/getFranchiseeById",
            { id },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setInfo({
                    totalSum: data.totalSum,
                    totalOrders: data.totalOrders,
                    clientsKol: data.clientsKol
                })
                setFranchisee(data.franchisee);
            })
            .catch((e) => {
                setOpen(true);
                setMessage(e.response.data.message);
                setStatus("error");
            });
    };

    useEffect(() => {
        getFranchiseeById();
    }, []);

    const toggleStatus = () => {
        if (franchisee.status === "active") {
            return "inActive";
        } else {
            return "active";
        }
    };

    const updateFranchiseeStatus = () => {
        franchisee.status = toggleStatus();
        api.post(
            "/updateFranchisee",
            { ...franchisee },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setFranchisee(data.franchisee);
            })
            .catch((e) => {
                setOpen(true);
                setMessage(e.response.data.message);
                setStatus("error");
            });
    };

    const deleteFranchisee = () => {
        api.post(
            "/deleteFranchisee",
            { id: franchisee._id },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.success) {
                    navigate(-1);
                }
            })
            .catch((e) => {
                setOpen(true);
                setMessage(e.response.data.message);
                setStatus("error");
            });
    };

    const loadMoreClients = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        api.post(
            "/getFranchiseeClients",
            { id, page },
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

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) {
            return "0 тенге"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} тенге`;
    };

    const updateFranchiseeData = (change, changeData) => {
        api.post("/updateFranchiseeData", {userId: id, change, changeData}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                setOpen(true);
                setMessage(data.message);
                setStatus("success");
                getFranchiseeById()
                setBottles({
                    b121kol: "",
                    b191kol: "",
                    b197kol: ""
                })
            }
        }).catch((e) => {
            console.log(e);
        })
    }

    return (
        <div className="relative">
            {deleteModal && <ConfirmDeleteModal
                closeConfirmModal={closeConfirmModal}
                confirmDelete={confirmDelete}
                scrollPosition={scrollPosition}
            />}
            <Container role={userData?.role}>
                <Div>
                    <div>Франчайзи: {franchisee.fullName}</div>
                </Div>
                <Div />

                <Div>
                    <div>Личные данные:</div>
                </Div>

                <UpdateFranchiseeData
                    franchisee={franchisee}
                    property="userName"
                    getFranchiseeById={getFranchiseeById}
                />
                <UpdateFranchiseeData
                    franchisee={franchisee}
                    property="fullName"
                    getFranchiseeById={getFranchiseeById}
                />
                <UpdateFranchiseeData
                    franchisee={franchisee}
                    property="phone"
                    getFranchiseeById={getFranchiseeById}
                />
                <UpdateFranchiseeData
                    franchisee={franchisee}
                    property="mail"
                    getFranchiseeById={getFranchiseeById}
                />

                <Div />

                <Div>
                    <div>Сводные данные:</div>
                </Div>

                <>
                    <Li>
                        <div className="flex items-center flex-wrap">
                            <div>Количество клиентов:</div>
                            <Info>{info?.clientsKol}</Info>
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center flex-wrap">
                            <div>Количество заказов:</div>
                            <Info>{info?.totalOrders}</Info>
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center flex-wrap">
                            <div>Прибыль:</div>
                            <Info>{formatCurrency(info?.totalSum)}</Info>
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center flex-wrap">
                            <div>Количество 12,5 л.:</div>
                            <Info>{franchisee.b121kol}</Info>
                            <div>
                            {" "}[{" "}
                                <input
                                    size={13}
                                    style={{ fontSize: '16px' }}
                                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                    name="b121kol"
                                    value={bottles.b121kol}
                                    inputMode="numeric"
                                    pattern="-?\d*" // обновленный паттерн для поддержки минуса
                                    onKeyPress={(event) => {
                                        // Разрешаем ввод только цифр и знака минуса
                                        const key = event.key;
                                        const value = event.target.value;

                                        if (!/[0-9]/.test(key) && key !== '-' || (key === '-' && value.length > 0)) {
                                            event.preventDefault(); // блокирует ввод символов, кроме цифр и минуса в начале
                                        }
                                    }}
                                    onChange={(event) => {
                                        handleBottlesChange(event);
                                    }}
                                />{" "}
                                ] шт
                            </div>
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center flex-wrap">
                            <div>Количество 18,9 л. (1):</div>
                            <Info>{franchisee.b191kol}</Info>
                            <div>
                            {" "}[{" "}
                                <input
                                    size={13}
                                    style={{ fontSize: '16px' }}
                                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                    name="b191kol"
                                    value={bottles.b191kol}
                                    inputMode="numeric"
                                    pattern="-?\d*" // обновленный паттерн для поддержки минуса
                                    onKeyPress={(event) => {
                                        // Разрешаем ввод только цифр и знака минуса
                                        const key = event.key;
                                        const value = event.target.value;

                                        if (!/[0-9]/.test(key) && key !== '-' || (key === '-' && value.length > 0)) {
                                            event.preventDefault(); // блокирует ввод символов, кроме цифр и минуса в начале
                                        }
                                    }}
                                    onChange={(event) => {
                                        handleBottlesChange(event);
                                    }}
                                />{" "}
                                ] шт
                            </div>
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center flex-wrap">
                            <div>Количество 18,9 л. (7):</div>
                            <Info>{franchisee.b197kol}</Info>
                            <div>
                            {" "}[{" "}
                                <input
                                    size={13}
                                    style={{ fontSize: '16px' }}
                                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                    name="b197kol"
                                    value={bottles.b197kol}
                                    inputMode="numeric"
                                    pattern="-?\d*" // обновленный паттерн для поддержки минуса
                                    onKeyPress={(event) => {
                                        // Разрешаем ввод только цифр и знака минуса
                                        const key = event.key;
                                        const value = event.target.value;

                                        if (!/[0-9]/.test(key) && key !== '-' || (key === '-' && value.length > 0)) {
                                            event.preventDefault(); // блокирует ввод символов, кроме цифр и минуса в начале
                                        }
                                    }}
                                    onChange={(event) => {
                                        handleBottlesChange(event);
                                    }}
                                />{" "}
                                ] шт
                            </div>
                        </div>
                    </Li>
                    {(bottles.b121kol !== ""  || bottles.b191kol !== ""  || bottles.b197kol !== "") && <Div>
                        <MyButton click={() => {
                            if (bottles.b121kol === "") {
                                bottles.b121kol = franchisee?.b121kol
                            }
                            if (bottles.b191kol === "") {
                                bottles.b191kol = franchisee?.b191kol
                            }
                            if (bottles.b197kol === "") {
                                bottles.b197kol = franchisee?.b197kol
                            }
                            updateFranchiseeData("bottles", bottles)
                        }}>Применить</MyButton>
                    </Div>}
                </>

                <Div />

                <Div>
                    <div className="flex items-center flex-wrap">
                        <div>Статус заказа:</div>
                        <Info>
                            {franchisee.status === "active"
                                ? "Активен"
                                : "Заблокирован"}
                        </Info>
                        <div className="ml-3">
                            <MyButton click={updateFranchiseeStatus}>
                                Изменить статус
                            </MyButton>
                        </div>
                    </div>
                </Div>

                <Div />
                <Div>Список клиентов:</Div>
                <div className="max-h-[180px] overflow-scroll">
                    {clients.map((client, index) => {
                        if (clients.length === index + 1) {
                            return (
                                <div key={client._id} ref={lastClientElementRef}>
                                    <Li>
                                        <div className="flex items-center gap-x-2 flex-wrap">
                                            <div>{client.userName}</div>
                                            <div>|</div>
                                            <div>{client.phone}</div>
                                            <div>|</div>
                                            <div>
                                                {client.status === "active"
                                                    ? "Активен"
                                                    : "Неактивен"}
                                            </div>
                                        </div>
                                    </Li>
                                </div>
                            );
                        } else {
                            return (
                                <div key={client._id}>
                                    <Li>
                                        <div className="flex items-center gap-x-2 flex-wrap">
                                            <div>{client.userName}</div>
                                            <div>|</div>
                                            <div>{client.phone}</div>
                                            <div>|</div>
                                            <div>
                                                {client.status === "active"
                                                    ? "Активен"
                                                    : "Неактивен"}
                                            </div>
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
                    <MyButton click={() => {setDeleteModal(true)}}>Удалить франчайзи</MyButton>
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
