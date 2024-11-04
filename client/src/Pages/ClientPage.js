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
import useScrollPosition from "../customHooks/useScrollPosition";
import ConfirmDeleteModal from "../Components/ConfirmDeleteModal";
import useFetchUserData from "../customHooks/useFetchUserData";
import DataInput from "../Components/DataInput";

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function ClientPage() {
    const scrollPosition = useScrollPosition();
    const { id } = useParams();
    const navigate = useNavigate();
    const userData = useFetchUserData();
    const [client, setClient] = useState({});
    const [modal, setModal] = useState(false)
    const [dates, setDates] = useState({
        startDate: "2024-01-01", // Начало месяца
        endDate: getCurrentDate()     // Сегодняшняя дата
    });

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [orders, setOrders] = useState([])

    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteModalClient, setDeleteModalClient] = useState(false)
    const [deleteObject, setDeleteObject] = useState(null)

    const closeSnack = () => {
        setOpen(false);
    };

    const [updates, setUpdates] = useState({
        fullNameOpen: false,
        fullNameStr: "",
        userNameOpen: false,
        userNameStr: "",
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

    const addressChangeHandler = (event) => {
        const streetValue = event.target.value;
        setNewAdress({
            ...newAdress,
            street: streetValue,
            link: generate2GISLink(streetValue),
        });
    };

    const closeConfirmModalAdd = () => {
        setModal(false)
    }

    const confirmDeleteAdd = () => {
        setAddAdress(true)
        setModal(false)
    }

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
                setUpdates({
                    fullNameOpen: false,
                    fullNameStr: data?.fullName,
                    userNameOpen: false,
                    userNameStr: data?.userName,
                    phoneOpen: false,
                    phoneStr: data?.phone,
                    mailOpen: false,
                    mailStr: data?.mail,
                    price12Open: false,
                    price12Str: data?.price12,
                    price19Open: false,
                    price19Str: data?.price19,
                })
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
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
                    setDeleteModalClient(false)
                    navigate(-1)
                }
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const loadMoreOrders = useCallback(async (page, dates) => {
        if (dates.startDate.length !== 10 || dates.endDate.length !== 10) {
            setOpen(true);
            setStatus("error");
            setMessage("Введите даты в формате ГГГГ-ММ-ДД");
            return;
        }
        setLoading(true);
        try {
            const { data } = await api.post(
                "/getClientOrders",
                {
                    page,
                    clientId: client?._id,
                    ...dates
                },
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
    
            if (data.orders.length === 0) {
                setHasMore(false);
            } else {
                setOrders((prevOrders) => {
                    const existingOrderIds = new Set(prevOrders.map(order => order._id));
                    const newOrders = data.orders.filter(order => !existingOrderIds.has(order._id));
                    return [...prevOrders, ...newOrders];
                });
                setPage(page + 1);
            }
        } catch (e) {
            console.log(e);
        }
        setLoading(false);
    }, [page, loading, hasMore, client]);

    useEffect(() => {
        console.log("useEffect triggered with hasMore:", hasMore);
        if (hasMore && Object.keys(client).length > 0) {
            loadMoreOrders(page, dates);
        }
    }, [client, hasMore]);

    const observer = useRef();
    const lastOrderElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreOrders(page, dates);
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
                clientId: client._id,
                ...dates
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
                        "Имя Клиента": item?.client?.fullName,
                        "Имя Пользователя": item?.client?.userName,
                        Адрес: item?.address?.actual,
                        "Кол18,9": item?.products?.b19 && item?.products?.b19 !== 0 ? item?.products?.b19 : "",
                        "Кол12,5": item?.products?.b12 && item?.products?.b12 !== 0 ? item?.products?.b12 : "",
                        Сумма: item?.sum,
                        Курьер: item?.courier?.fullName,
                        Статус: "Доставлен",
                        "Дата доставки": item.date.d,
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

    const confirmDelete = () => {
        deleteAdress(deleteObject)
        setDeleteModal(false)
        setDeleteObject(null)
    }

    const confirmDeleteClient = () => {
        deleteClient()
    }

    const closeConfirmModal = () => {
        setDeleteModal(false)
        setDeleteObject(null)
    }

    const closeConfirmModalClient = () => {
        setDeleteModalClient(false)
    }

    return (
        <div className="relative">
            {deleteModal && <ConfirmDeleteModal
                closeConfirmModal={closeConfirmModal}
                confirmDelete={confirmDelete}
                scrollPosition={scrollPosition}
            />}
            {deleteModalClient && <ConfirmDeleteModal
                closeConfirmModal={closeConfirmModalClient}
                confirmDelete={confirmDeleteClient}
                scrollPosition={scrollPosition}
            />}
            {modal && <ConfirmDeleteModal
                closeConfirmModal={closeConfirmModalAdd}
                confirmDelete={confirmDeleteAdd}
                scrollPosition={scrollPosition}
                add={true}
            />}
            <Container role={userData?.role}>
                <Div>Карточка клиента</Div>
                <Div />
                <Div>Личные данные:</Div>
                <>
                    <UpdateClientData
                        title="Наименование"
                        open={updates.fullNameOpen}
                        str={updates.fullNameStr}
                        name="fullName"
                        handleChange={handleChangesUpdates}
                        client={client}
                        updateClientData={updateClientData}
                    />
                    <UpdateClientData
                        title="Контактное лицо"
                        open={updates.userNameOpen}
                        str={updates.userNameStr}
                        name="userName"
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
                    <div>Форма оплаты: <span className="text-yellow-300">{client?.opForm === "fakt" && "Нал_Карта_QR"}{client?.opForm === "postpay" && "Постоплата"}{client?.opForm === "credit" && "В долг"}{client?.opForm === "coupon" && "Талоны"}{client?.opForm === "mixed" && "Смешанная"}</span></div>
                </Div>
                <div className="hidden lg:block">
                    <Div>
                        <div className="text-green-400 flex items-center gap-x-3">
                            [
                                <button className="text-green-400 hover:text-blue-500" onClick={() => {updateClientData("opForm", "fakt")}}>Нал_Карта_QR</button> /
                                <button className="text-green-400 hover:text-blue-500" onClick={() => {updateClientData("opForm", "coupon")}}>Талоны</button> /
                                <button className="text-green-400 hover:text-blue-500" onClick={() => {updateClientData("opForm", "postpay")}}>Постоплата</button> /
                                <button className="text-green-400 hover:text-blue-500" onClick={() => {updateClientData("opForm", "credit")}}>В долг</button> /
                                <button className="text-green-400 hover:text-blue-500" onClick={() => {updateClientData("opForm", "mixed")}}>Смешанная</button>
                            ]
                        </div>
                    </Div>
                </div>

                <div className="lg:hidden">
                    <Div>
                        <button className="text-green-400 hover:text-blue-500" onClick={() => {updateClientData("opForm", "fakt")}}>Нал_Карта_QR</button>
                    </Div>
                    <Div>
                        <button className="text-green-400 hover:text-blue-500" onClick={() => {updateClientData("opForm", "coupon")}}>Талоны</button> 
                    </Div>
                    <Div>
                        <button className="text-green-400 hover:text-blue-500" onClick={() => {updateClientData("opForm", "postpay")}}>Постоплата</button> 
                    </Div>
                    <Div>
                        <button className="text-green-400 hover:text-blue-500" onClick={() => {updateClientData("opForm", "credit")}}>В долг</button>
                    </Div>
                    <Div>
                        <button className="text-green-400 hover:text-blue-500" onClick={() => {updateClientData("opForm", "mixed")}}>Смешанная</button>
                    </Div>
                </div>

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
                                            setDeleteObject(adress?._id)
                                            setDeleteModal(true)
                                            // deleteClient(client._id);
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
                                            setNewAdress({
                                                street: "",
                                                house: ""
                                            })
                                        }}
                                    >
                                        <span className="text-green-400">
                                        Сохранить
                                    </span>
                                    </MyButton>
                                    <MyButton
                                        click={() => {
                                            setAddAdress(false);
                                            setNewAdress({
                                                street: "",
                                                house: ""
                                            })
                                        }}
                                    >
                                        <span className="text-green-400">
                                        Отменить
                                    </span>
                                    </MyButton>
                                </div>
                            </Li>
                        </>
                    ) : (
                        <Li>
                            <MyButton
                                click={() => {
                                    setModal(true)
                                }}
                            >
                                Добавить еще один адрес
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
                            <div className="flex items-center gap-x-2 flex-wrap text-green-400">
                                [
                                <button
                                    className="text-green-400 hover:text-blue-500"
                                    onClick={() => {updateClientData("chooseTime", true)}}
                                >
                                    Включить
                                </button>
                                <div>/</div>
                                <button
                                    className="text-green-400 hover:text-blue-500"
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
                            <div className="flex items-center gap-x-2 flex-wrap text-green-400">
                                [
                                <button
                                    className="text-green-400 hover:text-blue-500"
                                    onClick={() => {updateClientData("subscription", true)}}
                                >
                                    Включить
                                </button>
                                <div>/</div>
                                <button
                                    className="text-green-400 hover:text-blue-500"
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
                            <MyButton click={() => {
                                setOrders([]);
                                setPage(1);
                                setHasMore(true);
                                setLoading(false)                                
                                loadMoreOrders(1, dates)
                            }}>
                                <span className="text-green-400">
                                    Применить
                                </span>
                            </MyButton>
                        </div>
                    </Li>
                </>
                <Div>История заказов:</Div>
                <div className="max-h-[100px] overflow-scroll">
                    {orders.map((item, index) => {
                        if (orders.length === index + 1) {
                            return (
                                <div key={item?._id} ref={lastOrderElementRef}>
                                    <Li>
                                        <div className="flex items-center gap-x-3 flex-wrap">
                                            <div className="bg-red">
                                                Заказ: 
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
                                            <div className="bg-red">
                                                Заказ: 
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
                        <LinkButton color="green" href={`/addOrder/${client?._id}`}>Создать заказ</LinkButton>
                        <MyButton click={getClientOrdersForExcel}>
                            Выгрузить заказы в excel
                        </MyButton>
                        {userData?.role === "superAdmin" && 
                            <MyButton click={() => {setDeleteModalClient(true)}}>Удалить клиента</MyButton>
                        }
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
        </div>
    );
}
