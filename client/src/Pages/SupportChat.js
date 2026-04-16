import Container from "../Components/Container";
import Div from "../Components/Div";
import useFetchUserData from "../customHooks/useFetchUserData";
import api from "../api";
import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
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
    const messagesContainerRef = useRef(null);

    useEffect(() => {
        if (id) {  
            getMessages();
        }
    }, [id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            const el = messagesContainerRef.current;
            if (el) {
                el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            }
        });
    };

    const getMessages = () => {
        api.post(`/getSupportMessagesAdmin`, { clientId: id }, {
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
                    <div>Переписка с клиентом: {client?.userName}</div>
                </Div>
                <Div />
                <div
                    ref={messagesContainerRef}
                    className="flex flex-col gap-y-3 max-h-[400px] lg:w-1/3 overflow-y-auto px-2 py-2 rounded-lg border border-white/20"
                >
                    {messages?.length > 0 &&
                        messages?.map((msg) => {
                            const time = (new Date(msg.timestamp).getTime() + 5 * 60 * 1000) - (5 * 60 * 1000)
                            return (
                                <div
                                    key={msg?._id}
                                    className={`flex w-full ${msg?.isUser ? "justify-start" : "justify-end"}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${
                                            msg?.isUser
                                                ? "rounded-tl-sm bg-neutral-200 text-neutral-900"
                                                : "rounded-tr-sm bg-red text-white"
                                        }`}
                                    >
                                        <div className="text-sm whitespace-pre-wrap break-words">
                                            {msg?.text}
                                        </div>
                                        <div
                                            className={`text-[11px] mt-1.5 ${
                                                msg?.isUser ? "text-neutral-500" : "text-red-100"
                                            }`}
                                        >
                                            {new Date(time)?.toLocaleString('ru-RU')}
                                            {/* {time?.slice(0, 10)}{" "}
                                            {time?.slice(11, 16)} */}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
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