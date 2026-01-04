import { useState, useEffect } from "react";
import api from "../../api";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import MyButton from "../../Components/MyButton";
import LinkButton from "../../Components/LinkButton";
import Container from "../../Components/Container";
import clsx from "clsx";
import OrderInfo from "../../Components/OrderInfo";
import useFetchUserData from "../../customHooks/useFetchUserData";
import DataInput from "../../Components/DataInput";
import MySnackBar from "../../Components/MySnackBar";

export default function SuperAdminNotifications() {
    const userData = useFetchUserData();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [notificationTitle, setNotificationTitle] = useState("");
    const [notificationText, setNotificationText] = useState("");
    const [notificationTokens, setNotificationTokens] = useState([]);
    const [search, setSearch] = useState("");
    const [clients, setClients] = useState([]);
    const [selectedClients, setSelectedClients] = useState([]);

    const closeSnack = () => {
        setOpen(false);
    };

    const searchClient = () => {
        api.post("/searchClient", {search}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setClients(data.clients)
        })
    }

    const sendNotification = () => {
        if (notificationTitle === "" || notificationText === "") {
            setOpen(true)
            setStatus("error")
            setMessage("Введите заголовок и текст уведомления")
            return
        }
        if (selectedClients.length === 0) {
            setOpen(true)
            setStatus("error")
            setMessage("Выберите клиентов")
            return
        }
        const notificationTokens = selectedClients.map(client => client.expoPushToken);
        api.post("/sendNotification", {notificationTitle, notificationText, notificationTokens}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            console.log(data)
        })
    }

    return (
        <div className="relative">
            <Container role={userData?.role}>
                
                <Div>Отправка уведомлений</Div>
                <Div />
                <Div>
                    Поиск клиента:
                    <MyInput
                        value={search}
                        change={(e) => {setSearch(e.target.value)}}
                        color="white"
                    />
                    <MyButton click={searchClient}>Найти</MyButton>
                </Div>
                <Div>Найденные клиенты:</Div>
                {clients.length > 0 && clients.map((client) => {
                    return <Li>
                        <div>{client.fullName} {client.userName} {client.phone}</div>
                        <MyButton click={() => {setSelectedClients(prev => [...prev, client])}}>Выбрать</MyButton>
                    </Li>
                })}
                <Div />
                <Div>Выбранные клиенты:</Div>
                {selectedClients.length > 0 && selectedClients.map((client) => {
                    return <Li>
                        <div>{client.fullName} {client.userName} {client.phone}</div>
                        <MyButton click={() => {setSelectedClients(prev => prev.filter(c => c._id !== client._id))}}>Убрать</MyButton>
                    </Li>
                })}
                <Div />
                <Div>
                    Заголовок уведомления:
                </Div>
                <Li>
                    <MyInput
                        value={notificationTitle}
                        change={(e) => {setNotificationTitle(e.target.value)}}
                        color="white"
                    />
                </Li>
                <Div />
                <Div>Текст уведомления:</Div>
                <Li>
                    <textarea size={13} style={{ fontSize: '16px' }} value={notificationText} onChange={(e) => {setNotificationText(e.target.value)}} className="bg-black text-white border border-white rounded-lg p-1 text-sm"></textarea>
                </Li>
                <Div />
                <Div>
                    <MyButton click={sendNotification}>Отправить</MyButton>
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
    )
}