import { useState } from "react";
import api from "../api";
import Info from "./Info";
import Li from "./Li";
import MyButton from "./MyButton";
import MyInput from "./MyInput";
import MySnackBar from "./MySnackBar";

export default function UpdateFranchiseeData(props) {
    const { franchisee, property } = props;

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const [update, setUpdate] = useState(false);
    const [updateText, setUpdateText] = useState("");

    const handeChange = (e) => {
        setUpdateText(e.target.value);
    };

    const updateFranchisee = () => {
        franchisee[property] = updateText;
        api.post(
            "/updateFranchisee",
            { ...franchisee },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                props.getFranchiseeById();
                setUpdate(false);
            })
            .catch((e) => {
                setOpen(true);
                setMessage(e.response.data.message);
                setStatus("error");
            });
    };

    return (
        <div>
            <Li>
                <div className="flex items-center gap-x-2 lg:gap-x-3 gap-y-2 flex-wrap">
                    <div>
                        {property === "userName"
                            ? "Имя:"
                            : property === "fullName"
                            ? "ФИО:"
                            : property === "phone"
                            ? "Телефон"
                            : "Email"}
                    </div>
                    <div className="-ml-3">
                        {update ? (
                            <div className="ml-2 lg:ml-3">
                                <MyInput
                                    value={updateText}
                                    change={handeChange}
                                    color="red"
                                />
                            </div>
                        ) : (
                            <Info>{franchisee[property]}</Info>
                        )}
                    </div>
                    {update ? (
                        <div className="flex items-center gap-x-2 lg:gap-x-3">
                            <MyButton click={updateFranchisee}>
                                Сохранить
                            </MyButton>
                            <MyButton
                                click={() => {
                                    setUpdate(false);
                                }}
                            >
                                Отменить
                            </MyButton>
                        </div>
                    ) : (
                        <div>
                            <MyButton
                                click={() => {
                                    setUpdate(true);
                                }}
                            >
                                Редактировать
                            </MyButton>
                        </div>
                    )}
                </div>
            </Li>
            <MySnackBar
                open={open}
                text={message}
                status={status}
                close={closeSnack}
            />
        </div>
    );
}
