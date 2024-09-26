import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import MySnackBar from "../Components/MySnackBar";
import UpdateClientData from "../Components/UpdateClientData";
import LinkButton from "../Components/LinkButton";
import * as XLSX from "xlsx";

export default function ClientPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [role, setRole] = useState("");
    const [client, setClient] = useState({});

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [orders, setOrders] = useState([])

    const closeSnack = () => {
        setOpen(false);
    };

    const [updates, setUpdates] = useState({
        fullNameOpen: false,
        fullNameStr: "",
        phoneOpen: false,
        phoneStr: "",
        mailOpen: false,
        mailStr: "",
        price12Open: false,
        price12Str: "",
        price19Open: false,
        price19Str: "",
    });

    const [addAdress, setAddAdress] = useState(false);

    const [newAdress, setNewAdress] = useState({
        street: "",
        link: "",
        house: "",
    });

    const addressChangeHandler = (event) => {
        const streetValue = event.target.value;
        setNewAdress({
            ...newAdress,
            street: streetValue,
            link: generate2GISLink(streetValue),
        });
    };

    const addressChangeHandlerHouse = (event) => {
        setNewAdress({ ...newAdress, ["house"]: event.target.value });
    };

    const generate2GISLink = (address) => {
        const encodedAddress = encodeURIComponent(address);
        return `https://2gis.kz/almaty/search/${encodedAddress}`;
    };

    const handleChangesUpdates = (title, value) => {
        setUpdates({
            ...updates,
            [title]: value,
        });
    };

    const getClientData = () => {
        api.post(
            "/getClientDataForId",
            { id },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                setClient(data);
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

        getClientData();
    }, []);

    const deleteAdress = (id) => {
        api.post(
            "/deleteClientAdress",
            { clientId: client._id, adressId: id },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.success) {
                    setOpen(true);
                    setStatus("success");
                    setMessage(data.message);
                    getClientData();
                }
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const updateClientData = (field, value) => {
        api.post(
            "/updateClientData",
            { clientId: client._id, field, value },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.success) {
                    if (field === "addresses") {
                        setAddAdress(false);
                    }
                    setOpen(true);
                    setStatus("success");
                    setMessage(data.message);
                    getClientData(); // обновляем данные клиента после успешного обновления
                }
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const deleteClient = () => {
        api.post(
            "/deleteClient",
            { id: client._id },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.success) {
                    navigate(-1)
                }
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const loadMoreOrders = useCallback(async () => {
        if (loading || !hasMore || Object.keys(client).length === 0) return;
        setLoading(true);
        api.post(
            "/getClientOrders",
            {
                page,
                clientId: client?._id
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
    }, [page, loading, hasMore, client]);

    useEffect(() => {
        if (hasMore && Object.keys(client).length > 0) {
            loadMoreOrders();
        }
    }, [client, hasMore]);

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

    const getClientOrdersForExcel = () => {
        api.post(
            "/getClientOrdersForExcel",
            {
                clientId: client._id
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                const type = "orders";
                const orders = data.orders;

                const mappedData = orders.map((item) => {
                    return {
                        "Имя Клиента": item?.client?.userName,
                        Адрес: item.address.actual,
                        Кол19: item.products.b19,
                        Кол12: item.products.b12,
                        Сумма: item.sum,
                        Курьер: item?.courier?.fullName,
                        Статус:
                            item?.status === "awaitingOrder"
                                ? "Ожидает заказ"
                                : item?.status === "onTheWay"
                                ? "В пути"
                                : item?.status === "delivered"
                                ? "Доставлен"
                                : "Отменен",
                        "Дата добавления": item.date.d,
                    };
                });

                const workbook = XLSX.utils.book_new();
                const worksheet = XLSX.utils.json_to_sheet(mappedData);
                XLSX.utils.book_append_sheet(
                    workbook,
                    worksheet,
                    type === "clients" ? "Clients" : "Orders"
                );
                const clientName = client.fullName
                const fileName = `${clientName}.xlsx`; // Убедитесь, что функция formatDate определена и возвращает строку

                XLSX.writeFile(workbook, fileName);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    return (
        <Container role={role}>
            <Div>Карточка клиента</Div>
            <Div />
            <Div>Личные данные:</Div>
            <>
                <UpdateClientData
                    title="Имя"
                    open={updates.fullNameOpen}
                    str={updates.fullNameStr}
                    name="fullName"
                    handleChange={handleChangesUpdates}
                    client={client}
                    updateClientData={updateClientData}
                />
                <UpdateClientData
                    title="Телефон"
                    open={updates.phoneOpen}
                    str={updates.phoneStr}
                    name="phone"
                    handleChange={handleChangesUpdates}
                    client={client}
                    updateClientData={updateClientData}
                />
                <UpdateClientData
                    title="Email"
                    open={updates.mailOpen}
                    str={updates.mailStr}
                    name="mail"
                    handleChange={handleChangesUpdates}
                    client={client}
                    updateClientData={updateClientData}
                />
            </>

            <Div />
            <Div>
                <div>Форма оплаты: {client?.opForm === "cash" && "наличные"}{client?.opForm === "postpay" && "постоплата"}{client?.opForm === "transfer" && "перевод"}{client?.opForm === "card" && "карта"}{client?.opForm === "coupon" && "талон"}</div>
            </Div>
            <Div>
                <div className="text-red flex items-center gap-x-3">
                    [
                        <button className="text-red hover:text-blue-500" onClick={() => {updateClientData("opForm", "cash")}}>Наличные</button> /
                        <button className="text-red hover:text-blue-500" onClick={() => {updateClientData("opForm", "transfer")}}>Перевод</button> /
                        <button className="text-red hover:text-blue-500" onClick={() => {updateClientData("opForm", "card")}}>Карта</button> /
                        <button className="text-red hover:text-blue-500" onClick={() => {updateClientData("opForm", "coupon")}}>Талон</button> /
                        <button className="text-red hover:text-blue-500" onClick={() => {updateClientData("opForm", "postpay")}}>Постоплата</button>
                    ]
                </div>
            </Div>

            <Div />
            <Div>Адреса:</Div>
            {client.addresses &&
                client.addresses.length > 0 &&
                client.addresses.map((adress, index) => {
                    return (
                        <Li key={adress?._id}>
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div>
                                    Адрес{" "}
                                    <span className="text-red">
                                        {index + 1}
                                    </span>
                                    :
                                </div>
                                <div>
                                    {adress?.street} {adress?.house}
                                </div>
                                <a
                                    href={adress?.link}
                                    target="_blank" rel="noreferrer"
                                    className="text-blue-500 hover:text-blue-500"
                                >
                                    link%%{adress?.street}
                                </a>
                                <MyButton
                                    click={() => {
                                        deleteAdress(adress?._id);
                                    }}
                                >
                                    Удалить
                                </MyButton>
                            </div>
                        </Li>
                    );
                })}
            <>
                {addAdress ? (
                    <>
                        <Li>
                            <div className="flex items-center gap-x-3 flex-wrap gap-y-2">
                                <div>Улица, дом, под:</div>
                                <MyInput
                                    value={newAdress?.street}
                                    change={(event) =>
                                        addressChangeHandler(event)
                                    }
                                    color="white"
                                />
                                <div>
                                    2GIS ссылка:{" "}
                                    <a
                                        className="text-blue-500 hover:text-green-500"
                                        target="_blank" rel="noreferrer"
                                        href={newAdress?.link}
                                    >
                                        link%%{newAdress?.street}
                                    </a>
                                </div>
                            </div>
                        </Li>
                        <Li>
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div>Кв. этаж:</div>
                                <MyInput
                                    value={newAdress.house}
                                    change={(event) =>
                                        addressChangeHandlerHouse(event)
                                    }
                                    color="white"
                                />
                            </div>
                        </Li>
                        <Li>
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <MyButton
                                    click={() => {
                                        updateClientData("addresses", [
                                            ...client.addresses,
                                            newAdress,
                                        ]);
                                    }}
                                >
                                    Сохранить
                                </MyButton>
                                <MyButton
                                    click={() => {
                                        setAddAdress(false);
                                    }}
                                >
                                    Отменить
                                </MyButton>
                            </div>
                        </Li>
                    </>
                ) : (
                    <Li>
                        <MyButton
                            click={() => {
                                setAddAdress(true);
                            }}
                        >
                            Добавить
                        </MyButton>
                    </Li>
                )}
            </>

            <Div />
            <Div>Цены товаров:</Div>
            <>
                <UpdateClientData
                    title="12,5-литровая бутыль"
                    open={updates.price12Open}
                    str={updates.price12Str}
                    name="price12"
                    handleChange={handleChangesUpdates}
                    client={client}
                    updateClientData={updateClientData}
                />
                <UpdateClientData
                    title="19,8-литровая бутыль"
                    open={updates.price19Open}
                    str={updates.price19Str}
                    name="price19"
                    handleChange={handleChangesUpdates}
                    client={client}
                    updateClientData={updateClientData}
                />
            </>

            <Div />
            <Div>Сводная информация:</Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Общее количество заказов:</div>
                        <div className="text-red"></div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>
                            Количество <span className="text-red">12.5</span>
                            -литровых бутылей:
                        </div>
                        <div className="text-red"></div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>
                            Количество <span className="text-red">18.9</span>
                            -литровых бутылей:
                        </div>
                        <div className="text-red"></div>
                    </div>
                </Li>
            </>

            <Div />
            <Div>Настройки клиента:</Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Выбор времени доставки: {client?.chooseTime ? "Включено" : "Отключено"}</div>
                        <div className="flex items-center gap-x-2 flex-wrap text-red">
                            [
                            <button
                                className="text-red hover:text-blue-500"
                                onClick={() => {updateClientData("chooseTime", true)}}
                            >
                                Включить
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-500"
                                onClick={() => {updateClientData("chooseTime", false)}}
                            >
                                Отключить
                            </button>
                            ]
                        </div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Подписка: {client?.subscription ? "Включено" : "Отключено"}</div>
                        <div className="flex items-center gap-x-2 flex-wrap text-red">
                            [
                            <button
                                className="text-red hover:text-blue-500"
                                onClick={() => {updateClientData("subscription", true)}}
                            >
                                Включить
                            </button>
                            <div>/</div>
                            <button
                                className="text-red hover:text-blue-500"
                                onClick={() => {updateClientData("subscription", false)}}
                            >
                                Отключить
                            </button>
                            ]
                        </div>
                    </div>
                </Li>
            </>

            <Div />
            <Div>История заказов:</Div>
            <div className="max-h-[100px] overflow-scroll">
                {orders.map((item, index) => {
                    if (orders.length === index + 1) {
                        return (
                            <div key={item?._id} ref={lastOrderElementRef}>
                                <Li>
                                    <div className="flex items-center gap-x-3 flex-wrap">
                                    <div>
                                            Заказ: (
                                            {item.createdAt.slice(0, 10)})
                                        </div>
                                        <div>{item?.client?.fullName}</div>
                                        <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                        <div>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                        <div>{item?.products?.b12 !== 0 && `12.5л: ${item?.products?.b12}`}; {item?.products?.b19 !== 0 && `18.9л: ${item?.products?.b19}`}</div>
                                        <LinkButton
                                            href={`/orderPage/${item?._id}`}
                                        >
                                            Просмотр
                                        </LinkButton>
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
                                            {item.createdAt.slice(0, 10)})
                                        </div>
                                        <div>{item?.client?.fullName}</div>
                                        <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                        <div>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                        <div>{item?.products?.b12 !== 0 && `12.5л: ${item?.products?.b12}`}; {item?.products?.b19 !== 0 && `18.9л: ${item?.products?.b19}`}</div>
                                        <LinkButton
                                            href={`/orderPage/${item?._id}`}
                                        >
                                            Просмотр
                                        </LinkButton>
                                    </div>
                                </Li>
                            </div>
                        );
                    }
                })}
                {loading && <div>Загрузка...</div>}
            </div>

            <Div />
            <Div>Действия:</Div>
            <Div>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <LinkButton href={`/addOrder/${client?._id}`}>Создать заказ</LinkButton>
                    <MyButton click={getClientOrdersForExcel}>
                        Выгрузить заказы в excel
                    </MyButton>
                    <MyButton click={deleteClient}>Удалить клиента</MyButton>
                </div>
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
