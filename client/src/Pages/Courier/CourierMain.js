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
            console.log(data);
            
            setFirstActiveOrder(data.firstActiveOrder)
            setOpForm(data.firstActiveOrder.order.opForm)
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
                <Li>Наименование: {firstActiveOrder?.order?.client?.userName}</Li>
                <Li>Адрес: <span className="text-blue-500">{firstActiveOrder?.order?.address?.actual}</span></Li>
                <Li><p>Количество 12.5 - литровых бутылей: <span className="text-blue-500">{firstActiveOrder?.order?.products?.b12}</span></p>
                    <div>
                        [{" "}
                        <input
                            className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                            name="b12"
                            value={products.b12}
                            style={{ fontSize: '16px' }}
                            onChange={(event) => {
                                changeProducts(event);
                            }}
                        />{" "}
                        ] шт
                    </div>
                </Li>
                <Li><p>Количество 18.9 - литровых бутылей: <span className="text-blue-500">{firstActiveOrder?.order?.products?.b19}</span></p>
                    <div>
                        [{" "}
                        <input
                            className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                            name="b19"
                            value={products.b19}
                            style={{ fontSize: '16px' }}
                            onChange={(event) => {
                                changeProducts(event);
                            }}
                        />{" "}
                        ] шт
                    </div>
                </Li>
                <Li>
                    <div>Форма оплаты:<span className="text-blue-500"> {opForm === "cash" && "наличные"}{opForm === "postpay" && "постоплата"}{opForm === "transfer" && "перевод"}{opForm === "card" && "карта"}{opForm === "coupon" && "талон"}</span></div>
                </Li>
                <div className="hidden lg:block">
                    <Li>
                        <div className="text-red flex items-center gap-x-3">
                            [
                                <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("cash")}}>Наличные</button> /
                                <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("transfer")}}>Перевод</button> /
                                <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("card")}}>Карта</button> /
                                <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("coupon")}}>Талон</button> /
                                <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("postpay")}}>Постоплата</button>
                            ]
                        </div>
                    </Li>
                </div>
                <div className="lg:hidden">
                    <Li>
                        [ <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("cash")}}>Наличные</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("transfer")}}>Перевод</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("card")}}>Карта</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("coupon")}}>Талон</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("postpay")}}>Постоплата</button> ]
                    </Li>
                </div>
                {firstActiveOrder?.order?.date?.time !== "" && <Li>Время доставки: {firstActiveOrder?.order?.date?.time}</Li>}
                <Div/>
                <Div/>
                <Li>
                    {firstActiveOrder?.orderStatus === "inLine" && <a href={firstActiveOrder?.order?.address?.link} target="_blank" rel="noreferrer" className="text-red hover:text-blue-500"><button onClick={() => {updateCourierOrderStatus("onTheWay")}}>[ Начать ]</button></a>}
                    {firstActiveOrder?.orderStatus === "onTheWay" && (opForm === "" || products.b12 === "" || products.b19 === "") && <a href={firstActiveOrder?.order?.address?.link} target="_blank" rel="noreferrer" className="text-red hover:text-blue-500">[ Построить маршрут ]</a>}
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
