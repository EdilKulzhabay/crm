import { useEffect, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import useFetchUserData from "../customHooks/useFetchUserData";
import api from "../api";
import Li from "../Components/Li";
import MyInput from "../Components/MyInput";
import MySnackBar from "../Components/MySnackBar";
import MyButton from "../Components/MyButton";

export default function AddPickup() {
    const userData = useFetchUserData()

    const [data, setData] = useState({
        price12: "400",
        price19: "600",
        kol12: "0",
        kol19: "",
        opForm: "qr",
        sum: ""
    })

    const closeSnack = () => {
        setOpen(false);
    };

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const changeHandler = (event) => {
        setData({ ...data, [event.target.name]: event.target.value });
    };

    const addPickup = () => {
        api.post("/addPickup", {...data}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                setOpen(true)
                setStatus("success")
                setMessage("Самовывоз успешно добавлен")
            }
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        let pickupSum = 0;
        if (data.kol12 !== "" && data.price12 !== "") {
            pickupSum += Number(data.kol12) * Number(data.price12)
        }
        if (data.kol19 !== "" && data.price19 !== "") {
            pickupSum += Number(data.kol19) * Number(data.price19)
        }

        setData({...data, ["sum"]: pickupSum})
    }, [data.kol12, data.kol19, data.price12, data.price19])

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null || amount === 0) {
            return "0 тенге"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} тенге`;
    };

    const clear = () => {
        setData({
            price12: "400",
            price19: "600",
            kol12: "0",
            kol19: "",
            opForm: "qr",
            sum: ""
        })
    }

    return <Container role={userData?.role}>
        <Div>Добавить самовывоз</Div>
        <Div />
        <Div>Данные самовывоза:</Div>
        <Li>
            <div className="flex items-center gap-x-3">
                <div>18,9 л.:</div>
                <div>
                    [{" "}
                    <MyInput
                        name="kol19"
                        value={data.kol19}
                        change={changeHandler}
                        color="white"
                        format="numeric"
                        width="qwe"
                    />{" "}
                    ]
                </div>
                <div>
                    [{" "}
                    <MyInput
                        name="price19"
                        value={data.price19}
                        change={changeHandler}
                        color="white"
                        format="numeric"
                        width="qwe"
                    />{" "}
                    ]
                </div>
            </div>
        </Li>
        <Li>
            <div className="flex items-center gap-x-3">
                <div>12,5 л.:</div>
                <div>
                    [{" "}
                    <MyInput
                        name="kol12"
                        value={data.kol12}
                        change={changeHandler}
                        color="white"
                        format="numeric"
                        width="qwe"
                    />{" "}
                    ]
                </div>
                <div>
                    [{" "}
                    <MyInput
                        name="price12"
                        value={data.price12}
                        change={changeHandler}
                        color="white"
                        format="numeric"
                        width="qwe"
                    />{" "}
                    ]
                </div>
            </div>
        </Li>
        <Li>
            Сумма: {formatCurrency(data.sum)}
        </Li>
        <Li>
            Форма оплаты: <span className="text-yellow-300">{data.opForm === "qr" ? "QR" : "Наличными"}</span>
        </Li>
        <Li>
            <MyButton click={() => {setData({...data, ["opForm"]: "qr"})}}>QR</MyButton> /
            <MyButton click={() => {setData({...data, ["opForm"]: "nal"})}}>Наличными</MyButton>
        </Li>
        <Div/>
        <Div>
            Действия:
        </Div>
        <Div>
            <MyButton click={addPickup}>Сохранить</MyButton> /
            <MyButton click={clear}>Отменить</MyButton>
        </Div>
        <Div />
        <MySnackBar
            open={open}
            text={message}
            status={status}
            close={closeSnack}
        />
    </Container>
}