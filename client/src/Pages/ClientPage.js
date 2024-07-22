import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import MySnackBar from "../Components/MySnackBar";
import UpdateClientData from "../Components/UpdateClientData";

export default function ClientPage() {
    const { id } = useParams();
    const [role, setRole] = useState("");
    const [client, setClient] = useState({});

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

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
            <Div>Адреса:</Div>
            {client.addresses &&
                client.addresses.length > 0 &&
                client.addresses.map((adress, index) => {
                    return (
                        <Li key={adress._id}>
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div>
                                    Адрес{" "}
                                    <span className="text-red">
                                        {index + 1}
                                    </span>
                                    :
                                </div>
                                <div>
                                    {adress.street} {adress.house}
                                </div>
                                <a
                                    href={adress.link}
                                    target="_blank"
                                    className="text-blue-900 hover:text-blue-500"
                                >
                                    link%%{adress.street}
                                </a>
                                <MyButton
                                    click={() => {
                                        deleteAdress(adress._id);
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
                                    value={newAdress.street}
                                    change={(event) =>
                                        addressChangeHandler(event)
                                    }
                                    color="white"
                                />
                                <div>
                                    2GIS ссылка:{" "}
                                    <a
                                        className="text-blue-900 hover:text-blue-500"
                                        target="_blank"
                                        href={newAdress.link}
                                    >
                                        link%%{newAdress.street}
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
                        <div>Выбор времени доставки:</div>
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
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Подписка:</div>
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
                </Li>
            </>

            <Div />
            <Div>История заказов:</Div>
            <Div>---------------------</Div>

            <Div />
            <Div>Действия:</Div>
            <Div>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyButton click={() => {}}>Создать заказ</MyButton>
                    <MyButton click={() => {}}>
                        Выгрузить заказы в excel
                    </MyButton>
                    <MyButton click={() => {}}>Удлаить клиента</MyButton>
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
