import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import LogoText from "../../icons/LogoText";
import MySnackBar from "../../Components/MySnackBar";

export default function AquaMarketLogin() {
    const navigate = useNavigate();
    const [errorText, setErrorText] = useState(false);
    const [form, setForm] = useState({
        userName: "",
        password: "",
    });

    const handleClose = (event, reason) => {
        if (reason === "clickaway") {
            return;
        }
        setErrorText(false);
    };

    const changeHandler = (event) => {
        setForm({ ...form, [event.target.name]: event.target.value });
    };

    const loginHandler = async () => {
        api.post("/aquaMarketLogin", { ...form }, {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setErrorText(false);
                localStorage.setItem("token", data.token);
                localStorage.setItem("aquaMarketData", JSON.stringify(data.aquaMarketData));
                navigate("/aquaMarket");
            })
            .catch(() => {
                setErrorText(true);
            });
    }

    useEffect(() => {
        if (localStorage.getItem("aquaMarketData") !== null) {
            const aquaMarketData = JSON.parse(localStorage.getItem("aquaMarketData"));
            if (aquaMarketData._id) {
                navigate(`/aquaMarket`);
            }
        }
    }, []);

    return (
        <div className="min-h-screen flex justify-center items-center bg-[url('./images/LoginBG.png')] bg-cover bg-no-repeat bg-center">
            <div className="lg:min-w-[450px] flex flex-col items-center px-6 pt-10 pb-14 bg-white rounded-xl">
                <div className="mt-1">
                    <LogoText className="w-[221px] h-[49px]" />
                </div>
                <div className="text-sm text-[#606B85] text-center">
                    Пожалуйста, войдите в свой аккаунт и начните работу
                </div>
                <div className="w-full mt-7">
                    <div>
                        <input
                            size={13}
                            style={{ fontSize: '16px' }}
                            error="true"
                            className="w-full p-3 border rounded-md"
                            placeholder="Имя"
                            id="userName"
                            type="text"
                            name="userName"
                            value={form.userName}
                            onChange={changeHandler}
                        />
                    </div>
                    <div className="mt-3">
                        <input
                            size={13}
                            style={{ fontSize: '16px' }}
                            error="true"
                            className="w-full p-3 border rounded-md"
                            placeholder="Пароль"
                            id="password"
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={changeHandler}
                        />
                    </div>
                </div>

                <div className="w-full mt-8">
                    <button
                        onClick={loginHandler}
                        className="w-full py-2.5 text-center rounded-lg font-medium bg-red text-white"
                    >
                        ВОЙТИ
                    </button>
                </div>
            </div>
            <MySnackBar
                close={handleClose}
                open={errorText}
                status="error"
                text="Неверный пароль или логин"
            />
        </div>
    )
}