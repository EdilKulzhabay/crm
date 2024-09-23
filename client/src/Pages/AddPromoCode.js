import { useEffect, useState } from "react";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import MyButton from "../Components/MyButton";
import Li from "../Components/Li";
import MyInput from "../Components/MyInput";
import { useNavigate } from "react-router-dom";
import MySnackBar from "../Components/MySnackBar";

export default function AddPromoCode() {
    const [userData, setUserData] = useState({});
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const [promoCode, setPromoCode] = useState({
        title: "",
        price12: "",
        price19: "",
        addData: false,
        status: "active",
    });

    const changeHandler = (event) => {
        setPromoCode({ ...promoCode, [event.target.name]: event.target.value });
    };

    const generateCode = () => {
        const prefix = "TIBET";
        const characters =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let randomPart = "";

        for (let i = 0; i < 4; i++) {
            randomPart += characters.charAt(
                Math.floor(Math.random() * characters.length)
            );
        }

        setPromoCode({ ...promoCode, title: prefix + randomPart });
    };

    useEffect(() => {
        generateCode();
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setUserData(data);
        });
    }, []);

    const addPromoCode = () => {
        const formComplete = Object.entries(promoCode).every(([key, value]) => {
            if (typeof value === "string") {
                return value.trim() !== "";
            }
            return true;
        });

        if (!formComplete) {
            setOpen(true);
            setStatus("error");
            setMessage("Заполните все поля");
            return;
        }

        api.post(
            "/addPromoCode",
            { ...promoCode },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setOpen(true);
                setStatus("success");
                setMessage(data.message);
                setPromoCode({
                    title: "",
                    price12: "",
                    price19: "",
                    addData: false,
                    status: "active",
                });
            })
            .catch((e) => {
                console.log(e);
            });
    };

    return (
        <Container role={userData.role || "admin"}>
            <Div>Создание нового промокода</Div>
            <Div />
            <Div>Основне данные:</Div>
            <Li>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <div>Код:</div>
                    <div className="text-red">[{promoCode.title}]</div>
                    <MyButton click={generateCode}>
                        Сгенерировать новый
                    </MyButton>
                </div>
            </Li>

            <Div />
            <Div>
                <div>Цена товаров:</div>
            </Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>12,5-литровая бутыль:</div>
                        <div>
                            [{" "}
                            <MyInput
                                name="price12"
                                value={promoCode.price12}
                                change={changeHandler}
                                color="white"
                            />{" "}
                            ] тенге
                        </div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>18,9-литровая бутыль:</div>
                        <div>
                            [{" "}
                            <MyInput
                                name="price19"
                                value={promoCode.price19}
                                change={changeHandler}
                                color="white"
                            />{" "}
                            ] тенге
                        </div>
                    </div>
                </Li>
            </>

            <Div />
            <Div>Возможность указать время доставки:</Div>
            <Li>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <div>{promoCode.addData ? "Включено" : "Отключено"}:</div>
                    <div className="flex items-center gap-x-2 flex-wrap text-red">
                        [
                        <button
                            className="text-red hover:text-blue-500"
                            onClick={() => {
                                setPromoCode({ ...promoCode, addData: true });
                            }}
                        >
                            Включить
                        </button>
                        <div>/</div>
                        <button
                            className="text-red hover:text-blue-500"
                            onClick={() => {
                                setPromoCode({ ...promoCode, addData: false });
                            }}
                        >
                            Отключить
                        </button>
                        ]
                    </div>
                </div>
            </Li>

            <Div />

            <Div>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyButton click={addPromoCode}>Сохранить</MyButton>
                    <MyButton
                        click={() => {
                            navigate(-1);
                        }}
                    >
                        Отменить
                    </MyButton>
                </div>
            </Div>

            <Div />

            <MySnackBar
                open={open}
                text={message}
                status={status}
                close={closeSnack}
            />
        </Container>
    );
}
