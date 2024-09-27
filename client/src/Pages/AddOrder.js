import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import ChooseClientModal from "../Components/ChooseClientModal";
import ChooseCourierModal from "../Components/ChooseCourierModal";
import Container from "../Components/Container";
import DataInput from "../Components/DataInput";
import Div from "../Components/Div";
import Li from "../Components/Li";
import Li2 from "../Components/Li2";
import MyButton from "../Components/MyButton";
import MySnackBar from "../Components/MySnackBar";

const getCurrentDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); 
    const year = today.getFullYear();
    
    return `${year}-${month}-${day}`; 
};

export default function AddOrder() {
    const navigate = useNavigate();
    const {id} = useParams()
    const [userData, setUserData] = useState({});
    const [clientsModal, setClientsModal] = useState(false);
    const [client, setClient] = useState(null);
    const [address, setAddress] = useState(null);
    const [chooseAddress, setChooseAddress] = useState(null);
    const [products, setProducts] = useState({
        b12: "",
        b19: "",
    });
    const [date, setDate] = useState({
        d: getCurrentDate(),
        time: "",
    });
    const [couriersModal, setCouriersModal] = useState(false);
    const [courier, setCourier] = useState(null);
    const [opForm, setOpForm] = useState("");

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const changeProducts = (event) => {
        setProducts({ ...products, [event.target.name]: event.target.value });
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

        setDate({ ...date, [e.target.name]: formattedValue });
    };

    const handleTimeChange = (e) => {
        let input = e.target.value.replace(/\D/g, ""); // Remove all non-digit characters
        if (input.length > 13) input = input.substring(0, 13); // Limit input to 8 digits

        const h1 = input.substring(0, 2);
        const m1 = input.substring(2, 4);
        const h2 = input.substring(4, 6);
        const m2 = input.substring(6, 8);

        let formattedValue = h1;
        if (input.length >= 3) {
            formattedValue += ":" + m1;
        }
        if (input.length >= 5) {
            formattedValue += " - " + h2;
        }
        if (input.length >= 7) {
            formattedValue += ":" + m2;
        }

        setDate({ ...date, [e.target.name]: formattedValue });
    };

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setUserData(data);
        });
        if (id && id !== "") {
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
        }
    }, []);

    const closeClientsModal = () => {
        setClientsModal(false);
    };

    const chooseClient = (chClient) => {
        setClient(chClient);
        setClientsModal(false);
    };

    const closeCouriersModal = () => {
        setCouriersModal(false);
    };

    const chooseCourier = (chCourier) => {
        setCourier(chCourier);
        setCouriersModal(false);
    };

    const clear = () => {
        setClient(null);
        setAddress(null);
        setChooseAddress(null);
        setCourier(null);
        setProducts({
            b12: "",
            b19: "",
        });
        setDate({
            d: getCurrentDate(),
            time: "",
        });
    };

    const addOrder = () => {
        const op = opForm ? opForm : client?.opForm
        if (address === null) {
            setOpen(true);
            setStatus("error");
            setMessage("Добавьте адресс");
            return ;
        }
        api.post(
            "/addOrder",
            { client, address, products, courier, date, clientNotes: "", opForm: op },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setOpen(true);
                setStatus("success");
                setMessage("Заказ успешно добавлен");
                clear();
            })
            .catch((e) => {
                console.log(e);
            });
    };

    return (
        <Container role={userData.role}>
            {clientsModal && (
                <ChooseClientModal
                    closeClientsModal={closeClientsModal}
                    chooseClient={chooseClient}
                />
            )}
            {couriersModal && (
                <ChooseCourierModal
                    closeCouriersModal={closeCouriersModal}
                    chooseCourier={chooseCourier}
                />
            )}
            <Div>Добавление нового заказа</Div>
            <Div />
            <Div>Данные заказа:</Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Выберите клиента:</div>
                        <MyButton
                            click={() => {
                                setClientsModal(true);
                            }}
                        >
                            <span className="text-green-400">
                                Выбрать
                            </span>
                        </MyButton>
                        {client && (
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div>|</div>{" "}
                                <div>
                                    {client.fullName} {client.phone}
                                </div>{" "}
                            </div>
                        )}
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Выберите адрес:</div>
                        <div>
                            {chooseAddress && (
                                <span>Адрес {chooseAddress}</span>
                            )}
                        </div>
                    </div>
                </Li>
                {client &&
                    client.addresses &&
                    client.addresses.length > 0 &&
                    client.addresses.map((adress, index) => {
                        return (
                            <Li2 key={adress._id}>
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
                                        target="_blank" rel="noreferrer"
                                        className="text-blue-500 hover:text-blue-500"
                                    >
                                        link%%{adress.street}
                                    </a>
                                    <MyButton
                                        click={() => {
                                            setAddress({
                                                actual:
                                                    adress.street + ", " +
                                                    adress.house,
                                                link: adress.link,
                                            });
                                            setChooseAddress(index + 1);
                                        }}
                                    >
                                        <span className="text-green-400">
                                Выбрать
                            </span>
                                    </MyButton>
                                </div>
                            </Li2>
                        );
                    })}
                <Li>
                    <div>Товары:</div>
                </Li>
                <>
                    <Li2>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>12,5-литровая бутыль:</div>
                            <div>
                                [{" "}
                                <input
                                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                    name="b12"
                                    value={products.b12}
                                    onChange={(event) => {
                                        changeProducts(event);
                                    }}
                                />{" "}
                                ] шт
                            </div>
                        </div>
                    </Li2>
                    <Li2>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>18,9-литровая бутыль:</div>
                            <div>
                                [{" "}
                                <input
                                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                    name="b19"
                                    value={products.b19}
                                    onChange={(event) => {
                                        changeProducts(event);
                                    }}
                                />{" "}
                                ] шт
                            </div>
                        </div>
                    </Li2>
                </>
                <Li>Дата и время доставки:</Li>
                <>
                    <Li2>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>Дата:</div>
                            <div className="text-red">
                                [
                                <DataInput
                                    color="red"
                                    value={date.d}
                                    name="d"
                                    change={handleDateChange}
                                />
                                ]
                            </div>
                        </div>
                    </Li2>
                    <Li2>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>Время:</div>
                            <div className="text-red">
                                [
                                <input
                                    className="bg-black outline-none border-b border-red border-dashed text-sm lg:text-base placeholder:text-xs placeholder:lg:text-sm"
                                    value={date.time}
                                    size={13}
                                    name="time"
                                    onChange={(event) => {
                                        handleTimeChange(event);
                                    }}
                                    placeholder=" HH:MM - HH:MM"
                                />
                                ]
                            </div>
                        </div>
                    </Li2>
                </>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Выберите курьера:</div>
                        <MyButton
                            click={() => {
                                setCouriersModal(true);
                            }}
                        >
                            <span className="text-green-400">
                                Выбрать
                            </span>
                        </MyButton>
                        {courier && (
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div>|</div> <div>{courier.fullName}</div>{" "}
                            </div>
                        )}
                    </div>
                </Li>
                <Li>
                <div>
                    Форма оплаты:{" "}
                    {(opForm || client?.opForm) === "cash" && "наличные"}
                    {(opForm || client?.opForm) === "transfer" && "перевод"}
                    {(opForm || client?.opForm) === "card" && "карта"}
                    {(opForm || client?.opForm) === "coupon" && "талон"}
                    {(opForm || client?.opForm) === "postpay" && "постоплата"}
                </div>
                </Li>
                <Li2>
                    <div className="text-red flex items-center gap-x-3">
                        [
                            <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("cash")}}>Наличные</button> /
                            <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("transfer")}}>Перевод</button> /
                            <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("card")}}>Карта</button> /
                            <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("coupon")}}>Талон</button> /
                            <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("postpay")}}>Постоплата</button>
                        ]
                    </div>
                </Li2>
            </>

            <Div />
            <Div>Действия:</Div>
            <Div>
                <div className="flex items-center gap-x-3">
                    <MyButton click={addOrder}>Сохранить</MyButton>
                    <MyButton
                        click={() => {
                            navigate(-1);
                        }}
                    >
                        Отменить
                    </MyButton>
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
