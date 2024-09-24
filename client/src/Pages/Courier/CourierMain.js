import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import api from "../../api"
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";
import MyButton from "../../Components/MyButton";

export default function CourierMain() {
    const [products, setProducts] = useState({
        b12: "",
        b19: "",
    });
    const [opForm, setOpForm] = useState("")

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
        api.post("/updateCourierOrderStatus", {orderId: firstActiveOrder._id, trueOrder: firstActiveOrder.order._id, "newStatus": status, products, opForm}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                getFirstOrderForToday()
                setOpForm("")
                setProducts({
                    b12: "",
                    b19: ""
                })
            }
        }).catch((e) => {
            console.log(e);
        })
    }

    const changeProducts = (event) => {
        setProducts({ ...products, [event.target.name]: event.target.value });
    };

    return (
        <Container role="courier">
            <Div>
                Главная панель
            </Div>
            <Div />
            <Div>Текущий заказ:</Div>
            {firstActiveOrder !== null ? 
            <>
                <Li>Адрес: {firstActiveOrder?.order?.address?.actual} <a href={firstActiveOrder?.order?.address?.link} target="_blank" rel="noreferrer" className="text-red hover:text-blue-500">Построить маршрут</a></Li>
                <Li>Количество 12.5 - литровых бутылей: {firstActiveOrder?.order?.products?.b12} 
                    <div>
                        [{" "}
                        <input
                            className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                            name="b12"
                            value={products.b12}
                            onChange={(event) => {
                                changeProducts(event);
                            }}
                        />{" "}
                        ] шт
                    </div>
                </Li>
                <Li>Количество 18.9 - литровых бутылей: {firstActiveOrder?.order?.products?.b19}
                    <div>
                        [{" "}
                        <input
                            className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                            name="b19"
                            value={products.b19}
                            onChange={(event) => {
                                changeProducts(event);
                            }}
                        />{" "}
                        ] шт
                    </div>
                </Li>
                <Li>
                    <div>Форма оплаты: {opForm === "cash" && "наличные"}{opForm === "transfer" && "перевод"}{opForm === "card" && "карта"}{opForm === "coupon" && "талон"}</div>
                </Li>
                <Li>
                    <div className="text-red flex items-center gap-x-3">
                        [
                            <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("cash")}}>Наличные</button> /
                            <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("transfer")}}>Перевод</button> /
                            <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("card")}}>Карта</button> /
                            <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("coupon")}}>Талон</button>
                        ]
                    </div>
                </Li>
                {firstActiveOrder?.order?.date?.time !== "" && <Li>Время доставки: {firstActiveOrder?.order?.date?.time}</Li>}
                <Li>
                    {firstActiveOrder?.orderStatus === "inLine" && <a href={firstActiveOrder?.order?.address?.link} target="_blank" rel="noreferrer" className="text-red hover:text-blue-500"><button onClick={() => {updateCourierOrderStatus("onTheWay")}}>[ Начать ]</button></a>}
                    {firstActiveOrder?.orderStatus === "onTheWay" && opForm !== "" && products.b12 !== "" && products.b19 !== "" && <MyButton click={() => {updateCourierOrderStatus("delivered")}}>Завершить</MyButton>}
                </Li>
            </> : 
            <>
                <Div>Заказов не осталось</Div>
            </>}
            
            <Div />
        </Container>
    );
}
