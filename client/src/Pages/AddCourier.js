import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import MySnackBar from "../Components/MySnackBar";

export default function AddCourier() {
    const navigate = useNavigate();

    const [userData, setUserData] = useState({});

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const [form, setForm] = useState({
        fullName: "",
        phone: "",
        mail: "",
        password: "",
    });

    const changeHandler = (event) => {
        setForm({ ...form, [event.target.name]: event.target.value });
    };

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setUserData(data);
        });
    }, []);

    const addCourier = () => {
        const formComplete = Object.values(form).every(
            (value) => value.trim() !== ""
        );

        if (!formComplete) {
            setOpen(true);
            setStatus("error");
            setMessage("Заполните все поля");
            return;
        }

        api.post(
            "/addCourier",
            { ...form, franchisee: userData._id },
            {
                headers: { "Content-Type": "application/json" },
            }
        ).then(({ data }) => {
            if (data.success) {
                setOpen(true);
                setStatus("success");
                setMessage("Вы успешно добавили курьера");
                setForm({
                    fullName: "",
                    phone: "",
                    mail: "",
                    password: "",
                });
            }
        });
    };

    const cancel = () => {
        navigate(-1);
    };

    return (
        <Container role={userData.role}>
            <Div>Добавление нового курьера</Div>
            <Div />
            <Div>Личные данные:</Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3">
                        <div>ФИО:</div>
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
                <Li>
                    <div className="flex items-center gap-x-3">
                        <div>Пароль:</div>
                        <div>
                            [{" "}
                            <MyInput
                                name="password"
                                value={form.password}
                                change={changeHandler}
                                color="white"
                            />{" "}
                            ]
                        </div>
                    </div>
                </Li>
            </>
            {/* <Div />
            <Div>Статус:</Div>
            <Li>
                <div className="flex items-center gap-x-2 flex-wrap text-green-400">
                    [
                    <button
                        className="hover:text-blue-500"
                        onClick={() => {}}
                    >
                        Активен
                    </button>
                    <div>/</div>
                    <button
                        className="hover:text-blue-500"
                        onClick={() => {}}
                    >
                        Неактивен
                    </button>
                    ]
                </div>
            </Li> */}
            <Div />
            <Div>Действия:</Div>
            <Div>
                <div className="flex items-center gap-x-3">
                    <MyButton click={addCourier}><span className="text-green-400">
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
    );
}
