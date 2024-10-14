import Container from "../../Components/Container";
import CourierActiveOrders from "../../Components/CourierActiveOrders";
import Div from "../../Components/Div";
import MySnackBar from "../../Components/MySnackBar";
import {  useState } from "react";
import useFetchUserData from "../../customHooks/useFetchUserData";

export default function CourierWholeList() {
    const userData = useFetchUserData();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const changeSnackBar = (status, message) => {
        setOpen(true)
        setStatus(status)
        setMessage(message)
    }

    return <Container role={userData?.role}>
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