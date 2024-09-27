import { useState } from "react";
import api from "../api";
import Div from "./Div";
import Li from "./Li";
import Li2 from "./Li2";
import MyButton from "./MyButton";
import MyInput from "./MyInput";

export default function ChangePassword(props) {
    const [password, setPassword] = useState({
        now: "",
        new: "",
        newRepeat: "",
    });

    const [erNewPass, setErNewPass] = useState(false)

    const changeHandler = (event) => {
        setPassword({ ...password, [event.target.name]: event.target.value });
    };

    const changePassword = () => {
        if (password.new !== password.newRepeat) {
            setErNewPass(true)
            return
        }
        api.post(
            "/changePassword",
            { password: password.now, newPassword: password.new },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                props.responce(data.success, data.message);
                if (data.success) {
                    setErNewPass(false)
                    setPassword({
                        now: "",
                        new: "",
                        newRepeat: "",
                    });
                }
            })
            .catch((e) => {
                console.log(e);
            });
    };

    return (
        <>
            <Div>Параметры безопасности:</Div>
            <Li>Смена пароля:</Li>
            <Li2>
                <div className="flex flex-col gap-y-1.5 lg:flex-row lg:items-center gap-x-3 flex-wrap">
                    <div>Текущий пароль:</div>
                    <div className="text-red">
                        [
                        <MyInput
                            name="now"
                            value={password.now}
                            change={changeHandler}
                            color="red"
                        />
                        ]
                    </div>
                </div>
            </Li2>
            <Li2>
                <div className="flex flex-col gap-y-1.5 lg:flex-row lg:items-center gap-x-3 flex-wrap">
                    <div>Новый пароль:</div>
                    <div className="text-red">
                        [
                        <MyInput
                            name="new"
                            value={password.new}
                            change={changeHandler}
                            color="red"
                        />
                        ]
                    </div>
                </div>
            </Li2>
            <Li2>
                <div className="flex flex-col gap-y-1.5 lg:flex-row lg:items-center gap-x-3 flex-wrap">
                    <div>Подтвердите новый пароль:</div>
                    <div className="text-red">
                        [
                        <MyInput
                            name="newRepeat"
                            value={password.newRepeat}
                            change={changeHandler}
                            color="red"
                        />
                        ]
                    </div>
                    {erNewPass && <p className="text-red">Не совпадает</p>}
                </div>
            </Li2>
            <Div>
                <MyButton click={changePassword}><span className="text-green-400">
                                    Сохранить
                                </span></MyButton>
            </Div>
        </>
    );
}
