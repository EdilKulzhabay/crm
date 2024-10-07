import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import api from "../../api";
import { useParams } from "react-router-dom";
import Div from "../../Components/Div";

export default function CourierOrderComment() {
    const {id} = useParams()
    const [order, setOrder] = useState({})

    const getOrderData = () => {
        api.post(
            "/getOrderDataForId",
            { id },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                setOrder(data.order);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        getOrderData()
    }, [id])

    return <Container role="courier">
        <Div>Комментарии к заказу</Div>

        <Div />
        <Div>{order?.comment}</Div>

        <Div />
    </Container>
}