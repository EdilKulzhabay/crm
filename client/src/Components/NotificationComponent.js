import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import api from "../api";
import MySnackBar from "./MySnackBar";

const socket = io(`${process.env.REACT_APP_PORT}`); // Укажите URL вашего сервера

const NotificationComponent = () => {
    const [userData, setUserData] = useState(null);
    const [canPlayAudio, setCanPlayAudio] = useState(false);
    const audio = new Audio("/asd.mp3");
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setUserData(data);
        })
    }, [])

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

                    if (
                        (notification.first === "66f15c557a27c92d447a16a0" || notification.second === "67010493e6648af4cb0213b7") && 
                        (notification.second === "66f15c557a27c92d447a16a0" || notification.first === "67010493e6648af4cb0213b7") && 
                        userData._id === "67010493e6648af4cb0213b7"
                    ) {
                        return;
                    }

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

    useEffect(() => {
        if (userData) {
            console.log("we in NotificationComponent useEffect userData = ", userData);
            
        }
    }, [userData])

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
