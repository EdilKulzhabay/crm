import Container from "../Components/Container";
import Div from "../Components/Div";
import useFetchUserData from "../customHooks/useFetchUserData";
import api from "../api";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import MyInput from "../Components/MyInput";
import MyButton from "../Components/MyButton";
import MySnackBar from "../Components/MySnackBar";

export default function SupportChat() {
    const userData = useFetchUserData();
    const { id } = useParams();
    const [messages, setMessages] = useState([]);
    const [answerMessage, setAnswerMessage] = useState("");
    const [client, setClient] = useState(null);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    useEffect(() => {
        if (id) {  
            getMessages();
        }
    }, [id]);

    const getMessages = () => {
        api.post(`/getSupportMessages`, { clientId: id }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setClient(data.client);
            setMessages(data.client.supportMessages.reverse());
        });
    };

    const sendMessage = () => {
        const messageData = {
            text: answerMessage,
            isUser: false,
            timestamp: new Date().toISOString(),
            isRead: false,
        }
        api.post(`/replyToSupportMessage`, { mail: client?.mail, message: messageData }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            if (data.success) {
                getMessages();
            } else {
                setMessage(data.message);
                setStatus("error");
                setOpen(true);
            }
        });
    };

    const closeSnack = () => {
        setOpen(false);
    };

    return (
        <div>
            <Container role={userData?.role}>
                <Div>
                    <div>Чат поддержки</div>
                </Div>
                <Div />
                <Div>
                    <div>Переписка с клиентом</div>
                </Div>
                <Div />
                <div className="flex flex-col gap-y-3 max-h-[500px] overflow-y-auto">
                    {messages.map((message) => (
                        <div key={message._id}>
                            <div>{message.isUser ? "Вы:" : "Клиент:"}</div>
                            <div>{message.text}</div>
                            <div>{message.timestamp.split("T")[0]} {message.timestamp.split("T")[1].split(".")[0]}</div>
                        </div>
                    ))}
                </div>
                <Div />
                <Div>
                    <div>
                        <MyInput value={answerMessage} onChange={(e) => setAnswerMessage(e.target.value)} />
                        <MyButton onClick={sendMessage}>Отправить</MyButton>
                    </div>
                </Div>
            </Container>
            <MySnackBar
                open={open}
                text={message}
                status={status}
                close={closeSnack}
            />
        </div>
    )
}