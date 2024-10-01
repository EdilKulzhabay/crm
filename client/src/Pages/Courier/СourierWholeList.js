import api from "../../api";
import Container from "../../Components/Container";
import CourierActiveOrders from "../../Components/CourierActiveOrders";
import Div from "../../Components/Div";
import MySnackBar from "../../Components/MySnackBar";
import { useEffect, useState } from "react";

export default function CourierWholeList() {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [userData, setUserData] = useState({})

    const closeSnack = () => {
        setOpen(false);
    };

    const changeSnackBar = (status, message) => {
        setOpen(true)
        setStatus(status)
        setMessage(message)
    }

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setUserData(data)
        }).catch((e) => {
            console.log(e);
        })
    }, [])

    return <Container role="courier">
        <Div>Список заказов</Div>
        <Div/>
        <Div>Очередь заказов:</Div>
        {userData?._id && <CourierActiveOrders id={userData?._id} changeSnackBar={changeSnackBar} who="courier" />}


        <MySnackBar
                open={open}
                text={message}
                status={status}
                close={closeSnack}
            />
        <Div/>
    </Container>
}