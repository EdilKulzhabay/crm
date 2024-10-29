import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import Li from "../Components/Li";
import Li2 from "../Components/Li2";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import MySnackBar from "../Components/MySnackBar";
import useFetchUserData from "../customHooks/useFetchUserData";
import useScrollPosition from "../customHooks/useScrollPosition";
import ConfirmDeleteModal from "../Components/ConfirmDeleteModal";

export default function AddClient() {
    const navigate = useNavigate();
    const userData = useFetchUserData();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const scrollPosition = useScrollPosition()
    const [modal, setModal] = useState(false)

    const closeSnack = () => {
        setOpen(false);
    };

    const [form, setForm] = useState({
        fullName: "",
        userName: "",
        phone: "",
        mail: "",
        price19: "",
        price12: "",
        opForm: ""
    });
    const [addresses, setAddresses] = useState([
        {
            street: "",
            link: "",
            house: "",
        },
    ]);

    const confirmDelete = () => {
        setAddresses([
            ...addresses,
            { street: "", link: "", house: "" },
        ]);
        setModal(false)
    }

    const closeConfirmModal = () => {
        setModal(false)
    }

    const changeHandler = (event) => {
        setForm({ ...form, [event.target.name]: event.target.value });
    };

    const updateOpForm = (op) => {
        setForm({...form, opForm: op})
    }

    const addressChangeHandler = (index, event) => {
        const newAddresses = [...addresses];
        newAddresses[index].street = event.target.value;
        newAddresses[index].link = generate2GISLink(newAddresses[index].street);
        setAddresses(newAddresses);
    };

    const addressChangeHandlerHouse = (index, event) => {
        const newAddresses = [...addresses];
        newAddresses[index].house = event.target.value;
        setAddresses(newAddresses);
    };

    const generate2GISLink = (address) => {
        const encodedAddress = encodeURIComponent(address);
        return `https://2gis.kz/almaty/search/${encodedAddress}`;
    };

    const addClient = () => {
        const { mail, ...formWithoutMail } = form;
        
        const formComplete = Object.values(formWithoutMail).every(
            (value) => value.trim() !== ""
        );

        if (
            !formComplete ||
            addresses[0].street === ""
        ) {
            setOpen(true);
            setStatus("error");
            setMessage("Заполните все поля");
            return;
        }

        api.post(
            "/addClient",
            { ...form, addresses, franchisee: userData._id },
            {
                headers: { "Content-Type": "application/json" },
            }
        ).then(({ data }) => {
            if (data.success) {
                setOpen(true);
                setStatus("success");
                setMessage("Вы успешно добавили клиента");
                setForm({
                    fullName: "",
                    userName: "",
                    phone: "",
                    mail: "",
                    price19: "",
                    price12: "",
                });
                setAddresses([
                    {
                        street: "",
                        link: "",
                        house: "",
                    },
                ]);
            }
        });
    };

    const cancel = () => {
        navigate(-1);
    };

    return (
        <div className="relative">
            {modal && <ConfirmDeleteModal
                closeConfirmModal={closeConfirmModal}
                confirmDelete={confirmDelete}
                scrollPosition={scrollPosition}
                add={true}
            />}
            <Container role={userData?.role}>
                <Div>
                    <div>Добавление нового клиента</div>
                </Div>
                <Div />
                <Div>
                    <div>Личные данные:</div>
                </Div>
                <>
                    <Li>
                        <div className="flex items-center gap-x-3">
                            <div>Наименование:</div>
                            <div>
                                [{" "}
                                <MyInput
                                    name="fullName"
                                    value={form.fullName}
                                    change={changeHandler}
                                    color="white"
                                />{" "}
                                ]
                            </div>
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center gap-x-3">
                            <div>Контактное лицо:</div>
                            <div>
                                [{" "}
                                <MyInput
                                    name="userName"
                                    value={form.userName}
                                    change={changeHandler}
                                    color="white"
                                />{" "}
                                ]
                            </div>
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center gap-x-3">
                            <div>Телефон:</div>
                            <div>
                                [{" "}
                                <MyInput
                                    name="phone"
                                    value={form.phone}
                                    change={changeHandler}
                                    color="white"
                                />{" "}
                                ]
                            </div>
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center gap-x-3">
                            <div>Email:</div>
                            <div>
                                [{" "}
                                <MyInput
                                    name="mail"
                                    value={form.mail}
                                    change={changeHandler}
                                    color="white"
                                />{" "}
                                ]
                            </div>
                        </div>
                    </Li>
                </>
                <Div />
                <Div>
                    <div>Форма оплаты: <span className="text-yellow-300">{form.opForm === "fakt" && "Нал_Карта_QR"}{form.opForm === "postpay" && "Постоплата"}{form.opForm === "credit" && "В долг"}{form.opForm === "coupon" && "Талоны"}{form.opForm === "mixed" && "Смешанная"}</span></div>
                </Div>
                <div className="hidden lg:block">
                    <Div>
                        <div className="text-green-400 flex items-center gap-x-3">
                            [
                                <button className="hover:text-blue-500" onClick={() => {updateOpForm("fakt")}}>Нал_Карта_QR</button> /
                                <button className="hover:text-blue-500" onClick={() => {updateOpForm("coupon")}}>Талоны</button> /
                                <button className="hover:text-blue-500" onClick={() => {updateOpForm("postpay")}}>Постоплата</button> /
                                <button className="hover:text-blue-500" onClick={() => {updateOpForm("credit")}}>В долг</button> /
                                <button className="hover:text-blue-500" onClick={() => {updateOpForm("mixed")}}>Смешанная</button>
                            ]
                        </div>
                    </Div>
                </div>
                <div className="lg:hidden">
                    <Div>
                        <div className="text-green-400">
                            [
                                <button className="hover:text-blue-500" onClick={() => {updateOpForm("fakt")}}>Нал_Карта_QR</button>
                            ]
                        </div>
                    </Div>
                    <Div>
                        <div className="text-green-400">
                            [
                                <button className="hover:text-blue-500" onClick={() => {updateOpForm("coupon")}}>Талоны</button> 
                            ]
                        </div>
                    </Div>
                    <Div>
                        <div className="text-green-400">
                            [
                                <button className="hover:text-blue-500" onClick={() => {updateOpForm("postpay")}}>Постоплата</button>
                            ]
                        </div>
                    </Div>
                    <Div>
                        <div className="text-green-400">
                            [
                                <button className="hover:text-blue-500" onClick={() => {updateOpForm("credit")}}>В долг</button>
                            ]
                        </div>
                    </Div>
                    <Div>
                        <div className="text-green-400">
                            [
                                <button className="hover:text-blue-500" onClick={() => {updateOpForm("mixed")}}>Смешанная</button>
                            ]
                        </div>
                    </Div>
                </div>
                <Div />
                <Div>
                    <div>Цена товаров:</div>
                </Div>
                <>
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>12,5-литровая бутыль:</div>
                            <div>
                                [{" "}
                                <MyInput
                                    name="price12"
                                    value={form.price12}
                                    change={changeHandler}
                                    format="numeric"
                                    color="white"
                                />{" "}
                                ] тенге
                            </div>
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>18,9-литровая бутыль:</div>
                            <div>
                                [{" "}
                                <MyInput
                                    name="price19"
                                    value={form.price19}
                                    change={changeHandler}
                                    format="numeric"
                                    color="white"
                                />{" "}
                                ] тенге
                            </div>
                        </div>
                    </Li>
                </>
                <Div />

                <Div>
                    <div>Адреса доставки:</div>
                </Div>
                <>
                    {addresses.map((item, index) => {
                        return (
                            <div key={index}>
                                <Li>
                                    <div>Адресс {index + 1}:</div>
                                </Li>
                                <Li2>
                                    <div className="flex items-center gap-x-3 flex-wrap gap-y-2">
                                        <div>Улица, дом, под:</div>
                                        <MyInput
                                            name={`address${index}`}
                                            value={addresses[index].street}
                                            change={(event) =>
                                                addressChangeHandler(index, event)
                                            }
                                            color="white"
                                        />
                                        <div>
                                            2GIS ссылка:{" "}
                                            <a
                                                className="text-blue-500 hover:text-green-500"
                                                target="_blank" rel="noreferrer"
                                                href={addresses[index].link}
                                            >
                                                link%%{addresses[index].street}
                                            </a>
                                        </div>
                                    </div>
                                </Li2>
                                <Li2>
                                    <div className="flex items-center gap-x-3 flex-wrap">
                                        <div>Кв. этаж:</div>
                                        <MyInput
                                            name={`house${index}`}
                                            value={addresses[index].house}
                                            change={(event) =>
                                                addressChangeHandlerHouse(
                                                    index,
                                                    event
                                                )
                                            }
                                            color="white"
                                        />
                                    </div>
                                </Li2>
                            </div>
                        );
                    })}
                    <Div>
                        <MyButton
                            click={() => {
                                setModal(true)
                            }}
                        >
                            Добавить еще один адрес
                        </MyButton>
                    </Div>
                </>

                <Div />

                <Div>
                    <div>Действия:</div>
                </Div>
                <Div>
                    <div className="flex items-center gap-x-3">
                        <MyButton click={addClient}><span className="text-green-400">
                                        Сохранить
                                    </span></MyButton>
                        <MyButton click={cancel}><span className="text-green-400">
                                        Отменить
                                    </span></MyButton>
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
