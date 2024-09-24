import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import api from "../../api"
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";
import MyButton from "../../Components/MyButton";

export default function CourierMain() {

    const [firstActiveOrder, setFirstActiveOrder] = useState([])

    const getFirstOrderForToday = () => {
        api.get("/getFirstOrderForToday", {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setFirstActiveOrder(data.firstActiveOrder)
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 404) {
                    console.log("Заказ не найден");
                    // Здесь можно задать обработку для 404, например, установить пустое значение
                    setFirstActiveOrder(null); 
                } else {
                    console.log("Произошла другая ошибка:", error.response.status);
                }
            } else {
                console.log("Ошибка сети или сервера:", error.message);
            }
        })
    }

    useEffect(() => {
        getFirstOrderForToday()
    }, [])

    const updateCourierOrderStatus = (status) => {
        api.post("/updateCourierOrderStatus", {orderId: firstActiveOrder._id, trueOrder: firstActiveOrder.order._id, "newStatus": status}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                getFirstOrderForToday()
            }
        }).catch((e) => {
            console.log(e);
        })
    }

    return (
        <Container role="courier">
            <Div>
                Главная панель
            </Div>
            <Div />
            <Div>Текущий заказ:</Div>
            {firstActiveOrder !== null ? 
            <>
                <Li>Адрес: {firstActiveOrder?.order?.address?.actual} <LinkButton href={firstActiveOrder?.order?.address?.link}>Построить маршрут</LinkButton></Li>
                <Li>Количество 12.5 - литровых бутылей: {firstActiveOrder?.order?.products?.b12}</Li>
                <Li>Количество 18.9 - литровых бутылей: {firstActiveOrder?.order?.products?.b19}</Li>
                {firstActiveOrder?.order?.date?.time !== "" && <Li>Время доставки: {firstActiveOrder?.order?.date?.time}</Li>}
                <Li>
                    {firstActiveOrder?.orderStatus === "inLine" && <LinkButton href={firstActiveOrder?.order?.address?.link}><button onClick={() => {updateCourierOrderStatus("onTheWay")}}>Начать</button></LinkButton>}
                    {firstActiveOrder?.orderStatus === "onTheWay" && <MyButton click={() => {updateCourierOrderStatus("delivered")}}>Завершить</MyButton>}
                </Li>
            </> : 
            <>
                <Div>Заказов не осталось</Div>
            </>}
            
            <Div />
        </Container>
    );
}
