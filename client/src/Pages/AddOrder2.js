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
import clsx from "clsx";
import UpIcon from "../icons/UpIcon";
import DownIcon from "../icons/DownIcon";
import useScrollPosition from "../customHooks/useScrollPosition";
import useFetchUserData from "../customHooks/useFetchUserData";
import ChooseFranchiseeModal from "../Components/ChooseFranchiseeModal";

const getCurrentDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); 
    const year = today.getFullYear();
    
    return `${year}-${month}-${day}`; 
};

const adjustDateByDays = (dateStr, days) => {
    const currentDate = new Date(dateStr);
    currentDate.setDate(currentDate.getDate() + days);
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    return `${year}-${month}-${day}`;
};

export default function AddOrder2() {
    const scrollPosition = useScrollPosition();
    const userData = useFetchUserData();
    const navigate = useNavigate();
    const {id} = useParams()
    const [clientsModal, setClientsModal] = useState(false);
    const [client, setClient] = useState(null);
    const [franchiseeModal, setFranchiseeModal] = useState(false);
    const [franchisee, setFranchisee] = useState(null);
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
    const [comment, setComment] = useState("")
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
        setOpForm(chClient?.opForm)
        setClientsModal(false);
    };

    const closeFranchiseeModal = () => {
        setFranchiseeModal(false);
    };

    const chooseFranchisee = (chFranchisee) => {
        setFranchisee(chFranchisee);
        setFranchiseeModal(false);
    };

    const closeCouriersModal = () => {
        setCouriersModal(false);
    };

    const chooseCourier = (chCourier) => {
        setCourier(chCourier);
        setCouriersModal(false);
    };

    const incrementDate = () => {
        setDate({ ...date, d: adjustDateByDays(date.d, 1) });
    };

    const decrementDate = () => {
        setDate({ ...date, d: adjustDateByDays(date.d, -1) });
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
        setComment("")
    };

    const addOrder = () => {
        if (address === null) {
            setOpen(true);
            setStatus("error");
            setMessage("Добавьте адресс");
            return ;
        }
        if (date?.d?.length !== 10) {
            setOpen(true);
            setStatus("error");
            setMessage("Добавьте дату в формате ГГГГ-ММ-ДД");
            return ;
        }
        api.post(
            "/addOrder2",
            { franchisee, client, address, products, courier, date, clientNotes: [], opForm, comment },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.success) {
                    setOpen(true);
                    setStatus("success");
                    setMessage("Заказ успешно добавлен");
                    clear();
                } else {
                    setOpen(true);
                    setStatus("error");
                    setMessage("Такой заказ уже существует");
                }
            })
            .catch((e) => {
                console.log(e);
            });
    };

    return (
        <Container role={userData?.role}>
            {franchiseeModal && (
                <ChooseFranchiseeModal
                    closeFranchiseeModal={closeFranchiseeModal}
                    chooseFranchisee={chooseFranchisee}
                    scrollPosition={scrollPosition}
                />
            )}
            {clientsModal && (
                <ChooseClientModal
                    closeClientsModal={closeClientsModal}
                    chooseClient={chooseClient}
                    role={userData?.role}
                />
            )}
            {couriersModal && (
                <ChooseCourierModal
                    closeCouriersModal={closeCouriersModal}
                    chooseCourier={chooseCourier}
                    scrollPosition={scrollPosition}
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
                            <span className={clsx("", {
                                "text-green-400": client === null,
                                "text-red": client !== null
                            })}>
                                Выбрать
                            </span>
                        </MyButton>
                        {client && (
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div>|</div>{" "}
                                <div>
                                    {client.fullName}
                                </div>{" "}
                            </div>
                        )}
                    </div>
                </Li>
                {userData?.role === "superAdmin" && 
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>Выберите франчайзи:</div>
                            <MyButton
                                click={() => {
                                    setFranchiseeModal(true);
                                }}
                            >
                                <span className={clsx("", {
                                    "text-green-400": franchisee === null,
                                    "text-red": franchisee !== null
                                })}>
                                    Выбрать
                                </span>
                            </MyButton>
                            {franchisee && (
                                <div className="flex items-center gap-x-3 flex-wrap">
                                    <div>|</div> <div>{franchisee?.fullName}</div>{" "}
                                </div>
                            )}
                        </div>
                    </Li>
                }
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Выберите курьера:</div>
                        <MyButton
                            click={() => {
                                setCouriersModal(true);
                            }}
                        >
                            <span className={clsx("", {
                                "text-green-400": courier === null,
                                "text-red": courier !== null
                            })}>
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
                                            const actualAddress = adress.street + " " + (adress.house ? adress.house : "");
                                            setAddress({
                                                actual: actualAddress,
                                                link: adress.link,
                                                phone: adress.phone
                                            });
                                            setChooseAddress(index + 1);
                                        }}
                                    >
                                        <span className={clsx("", {
                                            "text-green-400": chooseAddress === null,
                                            "text-red": chooseAddress !== null,
                                            "text-yellow-300": chooseAddress === index + 1
                                        })}>
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
                            <div>12,5 л.;({client?.price12} тг):</div>
                            <div>
                                [{" "}
                                <input
                                    size={13}
                                    style={{ fontSize: '16px' }}
                                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                    name="b12"
                                    value={products.b12}
                                    inputMode="numeric"
                                    pattern="\d*"
                                    onKeyPress={(event) => {
                                        if (!/[0-9]/.test(event.key)) {
                                            event.preventDefault(); // блокирует ввод символов, кроме цифр
                                        }
                                    }}
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
                            <div>18,9 л.;({client?.price19} тг):</div>
                            <div>
                                [{" "}
                                <input
                                    size={13}
                                    style={{ fontSize: '16px' }}
                                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                    name="b19"
                                    value={products.b19}
                                    inputMode="numeric"
                                    pattern="\d*"
                                    onKeyPress={(event) => {
                                        if (!/[0-9]/.test(event.key)) {
                                            event.preventDefault(); // блокирует ввод символов, кроме цифр
                                        }
                                    }}
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
                            <div className="flex items-center gap-x-2">
                                <button onClick={incrementDate} className="w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1">
                                    <UpIcon className="w-6 h-6 text-white" />
                                </button>
                                <button onClick={decrementDate} className="w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1">
                                    <DownIcon className="w-6 h-6 text-white" />
                                </button>
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
                                    style={{ fontSize: '16px' }}
                                    name="time"
                                    inputMode="numeric"
                                    pattern="\d*"
                                    onKeyPress={(event) => {
                                        if (!/[0-9]/.test(event.key)) {
                                            event.preventDefault(); // блокирует ввод символов, кроме цифр
                                        }
                                    }}
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
                    <div>
                        Форма оплаты:{" "}
                        {opForm === "fakt" && "Нал_Карта_QR"}
                        {opForm === "credit" && "В долг"}
                        {opForm === "coupon" && "Талоны"}
                        {opForm === "postpay" && "Постоплата"}
                        {opForm === "mixed" && "Смешанная"}

                    </div>
                </Li>
                <div className="hidden lg:block">
                    <Li>
                        <div className="text-green-400 flex items-center gap-x-3">
                            [
                                <button className="hover:text-blue-500" onClick={() => {setOpForm("fakt")}}>Нал_Карта_QR</button> /
                                <button className="hover:text-blue-500" onClick={() => {setOpForm("coupon")}}>Талоны</button> /
                                <button className="hover:text-blue-500" onClick={() => {setOpForm("postpay")}}>Постоплата</button> /
                                <button className="hover:text-blue-500" onClick={() => {setOpForm("credit")}}>В долг</button> /
                                <button className="hover:text-blue-500" onClick={() => {setOpForm("mixed")}}>Смешанная</button>
                            ]
                        </div>
                    </Li>
                </div>
                <div className="lg:hidden">
                    <Li>
                        <div className="text-green-400">
                            [
                                <button className="hover:text-blue-500" onClick={() => {setOpForm("fakt")}}>Нал_Карта_QR</button>
                            ]
                        </div>
                    </Li>
                    <Li>
                        <div className="text-green-400">
                            [
                                <button className="hover:text-blue-500" onClick={() => {setOpForm("coupon")}}>Талоны</button> 
                            ]
                        </div>
                    </Li>
                    <Li>
                        <div className="text-green-400">
                            [
                                <button className="hover:text-blue-500" onClick={() => {setOpForm("postpay")}}>Постоплата</button>
                            ]
                        </div>
                    </Li>
                    <Li>
                        <div className="text-green-400">
                            [
                                <button className="hover:text-blue-500" onClick={() => {setOpForm("credit")}}>В долг</button>
                            ]
                        </div>
                    </Li>
                    <Li>
                        <div className="text-green-400">
                            [
                                <button className="hover:text-blue-500" onClick={() => {setOpForm("mixed")}}>Смешанная</button>
                            ]
                        </div>
                    </Li>
                </div>
                <Li>Комментарии к заказу:</Li>
                <Li2>
                    <textarea size={13} style={{ fontSize: '16px' }} value={comment} onChange={(e) => {setComment(e.target.value)}} className="bg-black text-white border border-white rounded-lg p-1 text-sm"></textarea>
                </Li2>
            </>

            <Div />
            <Div>Действия:</Div>
            <Div>
                <div className="flex items-center gap-x-3">
                    <MyButton click={addOrder}><span className="text-green-400">
                                    Сохранить
                                </span></MyButton>
                    <MyButton
                        click={() => {
                            navigate(-1);
                        }}
                    >
                        <span className="text-green-400">
                                    Отменить
                                </span>
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
