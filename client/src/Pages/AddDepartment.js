import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import MySnackBar from "../Components/MySnackBar";

export default function AddDepartment() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const [form, setForm] = useState({
        fullName: "",
        userName: "",
        password: "",
    });

    const changeHandler = (event) => {
        setForm({ ...form, [event.target.name]: event.target.value });
    };

    const addDepartment = () => {
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
            "/addDepartment",
            { ...form },
            {
                headers: { "Content-Type": "application/json" },
            }
        ).then(({ data }) => {
            if (data.success) {
                setOpen(true);
                setStatus("success");
                setMessage("Вы успешно добавили сотрудника");
                setForm({
                    fullName: "",
                    userName: "",
                    password: "",
                });
            }
        });
    };

    const cancel = () => {
        navigate(-1);
    };

    return <Container role="superAdmin">
        <Div>Добавление сотрудника</Div>
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
                        <div>Имя пользователя:</div>
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
            </>
        <Div />
        <Div>Действия:</Div>
        <Div>
            <div className="flex items-center gap-x-3">
                <MyButton click={addDepartment}>
                    <span className="text-green-400">
                                Сохранить
                    </span>
                </MyButton>
                <MyButton click={cancel}>
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
}