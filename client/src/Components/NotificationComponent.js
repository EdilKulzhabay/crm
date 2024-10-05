import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import api from "../api";
import MySnackBar from "./MySnackBar";

const socket = io(`${process.env.REACT_APP_PORT}`); // Укажите URL вашего сервера

const NotificationComponent = () => {
    const [canPlayAudio, setCanPlayAudio] = useState(false);
    const audio = new Audio("/asd.mp3");
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    useEffect(() => {
        const enableAudio = () => setCanPlayAudio(true);

        // Добавляем слушатель на клик
        document.addEventListener("click", enableAudio);

        // Проверка роли пользователя и настройка WebSocket
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            if (data.role === "superAdmin") {
                socket.emit("join", data._id, data.userName)
                socket.on("clientMatch", (notification) => {
                    setOpen(true);
                    setMessage(notification.message);
                    setStatus("warning");

                    audio.play().catch((error) => {
                        console.error("Failed to play audio:", error);
                    });
                });
                socket.on("orderStatusChanged", (notification) => {
                    console.log("orderStatusChanged");
                    
                    setOpen(true)
                    setStatus("success")
                    setMessage(notification.message)
                })
                socket.on("orderMatch", (notification) => {
                    setOpen(true);
                    setMessage(notification.message);
                    setStatus("warning");

                    audio.play().catch((error) => {
                        console.error("Failed to play audio:", error);
                    });
                });
            }
        });

        return () => {
            socket.off("clientMatch");
            socket.off("orderMatch");
            document.removeEventListener("click", enableAudio);
        };
    }, [canPlayAudio]);

    const closeSnack = () => {
        setOpen(false);
    };

    return (
        <>
            <MySnackBar
                open={open}
                text={message}
                status={status}
                close={closeSnack}
            />
        </>
    );
};

export default NotificationComponent;
