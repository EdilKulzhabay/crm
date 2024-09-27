import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import MyButton from "../../Components/MyButton";
import MyInput from "../../Components/MyInput";
import MySnackBar from "../../Components/MySnackBar";

export default function SuperAdminAddFranchizer() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        userName: "",
        password: "",
        fullName: "",
        phone: "",
        mail: "",
    });
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const changeHandler = (event) => {
        setForm({ ...form, [event.target.name]: event.target.value });
    };

    const addFranchisee = () => {
        if (
            form.userName === "" ||
            form.fullName === "" ||
            form.mail === "" ||
            form.password === "" ||
            form.phone === ""
        ) {
            setOpen(true);
            setMessage("Заполните все поля");
            setStatus("error");
            return;
        }
        api.post(
            "/register",
            { ...form, role: "superAdmin" },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                console.log(data);
                setOpen(true);
                setMessage(`Фрачайзи ${form.userName} был добавлен`);
                setStatus("success");
                setForm({
                    userName: "",
                    password: "",
                    fullName: "",
                    phone: "",
                    mail: "",
                });
            })
            .catch((e) => {
                console.log(e);
                setOpen(true);
                setMessage(e.response.data.message);
                setStatus("error");
            });
    };

    const cancel = () => {
        navigate(-1);
    };

    return (
        <Container role="superAdmin">
            <Div>
                <div>Добавление нового франчайзера</div>
            </Div>
            <Div />
            <Div>
                <div>Личные данные:</div>
            </Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3">
                        <div>Имя:</div>
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
            </>

            <Div />
            <Div>
                <div>Действия:</div>
            </Div>
            <Div>
                <div className="flex items-center gap-x-3">
                    <MyButton click={addFranchisee}><span className="text-green-400">
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
                close={closeSnack}
                text={message}
                status={status}
            />
        </Container>
    );
}
