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
    const [userData, setUserData] = useState({})

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
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setUserData(data)
        }).catch((e) => {
            console.log(e);
        })
        getFirstOrderForToday()
    }, [])

    const updateCourierOrderStatus = (status) => {
        const sum = getSum()
        api.post("/updateCourierOrderStatus", {orderId: firstActiveOrder._id, trueOrder: firstActiveOrder.order._id, "newStatus": status, products, opForm, sum}, {
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

    const getSum = () => {
        if (products.b12 !== "" && products.b19 !== "") {
            const sum = Number(products.b12) * Number(firstActiveOrder?.order?.client?.price12) + Number(products.b19) * Number(firstActiveOrder?.order?.client?.price19)
            return sum
        }
    }

    return (
        <Container role="courier">
            <Div>
                Главная панель
            </Div>
            
            {userData?.wholeList && <><Div/><Div><LinkButton href={`/courierActiveOrders/${userData?._id}`}>Список заказов</LinkButton></Div></> }
            <Div />
            <Div>
                Текущий заказ: 
                {firstActiveOrder?.orderStatus === "inLine" && <button className="text-green-500" onClick={() => {updateCourierOrderStatus("onTheWay")}}><span className="text-green500">[ Начать ]</span></button>}
                {firstActiveOrder?.orderStatus === "onTheWay" && (opForm === "" || products.b12 === "" || products.b19 === "") && <a href={firstActiveOrder?.order?.address?.link} target="_blank" rel="noreferrer"><span className="text-green-500">[ Построить маршрут ]</span></a>}
                {firstActiveOrder?.orderStatus === "onTheWay" && opForm !== "" && products.b12 !== "" && products.b19 !== "" && <MyButton click={() => {updateCourierOrderStatus("delivered")}}><span className="text-green-500">Завершить</span></MyButton>}    
            </Div>
            {firstActiveOrder !== null ? 
            <>
                <Li>Наименование: {firstActiveOrder?.order?.client?.userName}</Li>
                <Li>Адрес: <span className="text-blue-500">{firstActiveOrder?.order?.address?.actual}</span></Li>
                <Li><p>Количество 12.5 - литровых бутылей: <span className="text-blue-500">{firstActiveOrder?.order?.products?.b12}</span></p>
                    <div>
                        [{" "}
                        <input
                            size={11}
                            className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                            name="b12"
                            value={products.b12}
                            style={{ fontSize: '16px' }}
                            inputMode="numeric"
                            pattern="\d*"
                            onKeyPress={(event) => {
                                if (!/[0-9]/.test(event.key)) {
                                    event.preventDefault(); // блокирует ввод символов, кроме цифр
                                }
                            }}
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
                            size={11}
                            className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                            name="b19"
                            value={products.b19}
                            style={{ fontSize: '16px' }}
                            inputMode="numeric"
                            pattern="\d*"
                            onKeyPress={(event) => {
                                if (!/[0-9]/.test(event.key)) {
                                    event.preventDefault(); // блокирует ввод символов, кроме цифр
                                }
                            }}
                            onChange={(event) => {
                                changeProducts(event);
                            }}
                        />{" "}
                        ] шт
                    </div>
                </Li>
                {firstActiveOrder?.order?.comment && <Li>
                    <LinkButton href={`/courierOrderComment/${firstActiveOrder?.order?._id}`}>Есть комм.</LinkButton>
                     
                    </Li>}
                <Li>
                    <div>Сумма оплаты: <span className="text-blue-500">{getSum()}</span></div>
                </Li>
                <Li>
                    <div>Форма оплаты:<span className="text-blue-500"> {firstActiveOrder?.order?.opForm === "fakt" && "Нал_Карта_QR"}{firstActiveOrder?.order?.opForm === "postpay" && "Постоплата"}{firstActiveOrder?.order?.opForm === "credit" && "В долг"}{firstActiveOrder?.order?.opForm === "coupon" && "Талоны"}{firstActiveOrder?.order?.opForm === "mixed" && "Смешанная"}</span></div>
                </Li>
                <Li>
                    <div>Форма оплаты по факту:<span className="text-blue-500"> {opForm === "fakt" && "Нал_Карта_QR"}{opForm === "postpay" && "Постоплата"}{opForm === "credit" && "В долг"}{opForm === "coupon" && "Талоны"}{opForm === "mixed" && "Смешанная"}</span></div>
                </Li>
                <div className="hidden lg:block">
                    <Li>
                        <div className="text-red flex items-center gap-x-3">
                            [
                                <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("fakt")}}>Нал_Карта_QR</button> /
                                <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("coupon")}}>Талоны</button> /
                                <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("postpay")}}>Постоплата</button> /
                                <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("credit")}}>В долг</button> /
                                <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("mixed")}}>Смешанная</button>
                            ]
                        </div>
                    </Li>
                </div>
                <div className="lg:hidden">
                    <Li>
                        [ <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("cash")}}>Наличные</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("coupon")}}>Талоны</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("postpay")}}>Постоплата</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("credit")}}>В долг</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-red hover:text-blue-500" onClick={() => {setOpForm("mixed")}}>Смешанная</button> ]
                    </Li>
                </div>
                {firstActiveOrder?.order?.date?.time !== "" && <Li>Время доставки: <span className="text-red">{firstActiveOrder?.order?.date?.time}</span></Li>}
                
            </> : 
            <>
                <Div>Заказов не осталось</Div>
            </>}
            
            <Div />
        </Container>
    );
}
