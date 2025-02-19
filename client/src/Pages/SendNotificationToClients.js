import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import MySnackBar from "../Components/MySnackBar";
import useFetchUserData from "../customHooks/useFetchUserData";
import clsx from "clsx";
import MyButton from "../Components/MyButton";

export default function SendNotificationToClients() {
    const navigate = useNavigate();
    const userData = useFetchUserData();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const [type, setType] = useState("all")
    const [title, setTitle] = useState("")
    const [text, setText] = useState("")

    const closeSnack = () => {
        setOpen(false);
    };

    const sendNotification = () => {
        if (text.trim() === "" || title.trim() === "") {
            setOpen(true)
            setMessage("Нельзя отправить пустое уведомление")
            setStatus("error")
            return
        }

        api.post("/sendNotificationToClients", {type, title, text}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                setOpen(true)
                setMessage("Уведомление отправлено")
                setStatus("success")
                setType("all")
                setTitle("")
                setText("")
            } else {
                setOpen(true)
                setMessage("Что то пошло не так")
                setStatus("error")
            }
        }).catch((e) => {
            setOpen(true)
            setMessage("Что то пошло не так")
            setStatus("error")
        }) 
    }
    

    const cancel = () => {
        navigate(-1);
    };

    return (
        <div className="relative">
            <Container role={userData?.role}>
                <Div>
                    <div>Уведомление для клиентов</div>
                </Div>
                <Div />

                <Div>
                    <div>Тип: </div>
                    <button onClick={() => {setType("all")}} className={clsx("", {
                        "text-yellow-300": type === "all",
                        "text-green-400": type !== "all"
                    })}>[ Все ]</button>
                    <button onClick={() => {setType("ios")}} className={clsx("", {
                        "text-yellow-300": type === "ios",
                        "text-green-400": type !== "ios"
                    })}>[ IOS ]</button>
                    <button onClick={() => {setType("android")}} className={clsx("", {
                        "text-yellow-300": type === "android",
                        "text-green-400": type !== "android"
                    })}>[ Android ]</button>
                </Div>

                <Div />

                <Div>Заголовок уведомления:</Div>
                <Div>
                <textarea size={13} style={{ fontSize: '16px' }} value={title} onChange={(e) => {setTitle(e.target.value)}} className="bg-black text-white border border-white rounded-lg p-1 text-sm"></textarea>
                </Div>

                <Div />

                <Div>Текст уведомления:</Div>
                <Div>
                    <textarea size={13} style={{ fontSize: '16px' }} value={text} onChange={(e) => {setText(e.target.value)}} className="bg-black text-white border border-white rounded-lg p-1 text-sm"></textarea>
                </Div>

                <Div />

                <Div>
                    <MyButton click={sendNotification}>Отправить</MyButton>
                </Div>


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
