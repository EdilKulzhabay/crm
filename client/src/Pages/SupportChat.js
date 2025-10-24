import Container from "../Components/Container";
import Div from "../Components/Div";
import useFetchUserData from "../customHooks/useFetchUserData";
import api from "../api";
import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import MyButton from "../Components/MyButton";
import MySnackBar from "../Components/MySnackBar";
import Li from "../Components/Li";

export default function SupportChat() {
    const userData = useFetchUserData();
    const { id } = useParams();
    const [messages, setMessages] = useState([]);
    const [answerMessage, setAnswerMessage] = useState("");
    const [client, setClient] = useState(null);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (id) {  
            getMessages();
        }
    }, [id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const getMessages = () => {
        api.post(`/getSupportMessages`, { clientId: id }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setClient(data.client);
            setMessages(data.client.supportMessages);
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
                setAnswerMessage("");
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
                    {messages?.length > 0 && messages?.map((message) => (
                        <div key={message?._id}>
                            <Li>{message?.isUser ? "Клиент:" : "Вы:"}</Li>
                            <Li>{message?.text}</Li>
                            <Li>{message?.timestamp?.slice(0, 10)} {message?.timestamp?.slice(11, 16)}</Li>
                            <Div />
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <Div />
                <Div>
                    <textarea size={13} style={{ fontSize: '16px' }} value={answerMessage} onChange={(e) => {setAnswerMessage(e.target.value)}} className="bg-black text-white border border-white rounded-lg p-1 text-sm"></textarea>
                </Div>
                <Div>
                    <MyButton click={sendMessage}>Отправить</MyButton>
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