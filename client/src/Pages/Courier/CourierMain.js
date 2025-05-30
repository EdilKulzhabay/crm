import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import api from "../../api"
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";
import MyButton from "../../Components/MyButton";
import OrderInfo from "../../Components/OrderInfo";
import useFetchUserData from "../../customHooks/useFetchUserData";
import StarIcon from "../../icons/StarIcon";

export default function CourierMain() {
    const userData = useFetchUserData();
    const [products, setProducts] = useState({
        b12: "",
        b19: "",
    });
    const [opForm, setOpForm] = useState("")
    const [rating, setRating] = useState(0)

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

    const getCourierRating = () => {
        api.get("/getCourierRating", {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setRating(data.rating)
        }).catch((error) => {
            console.log(error);
        })
    }

    useEffect(() => {
        getCourierRating()
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
        <Container role={userData?.role}>
            <Div>
                Главная панель 
            </Div>
            <Div />
            {rating > 0 && <Div>
                <div className="flex items-center">
                    <div>Рейтинг</div>
                    <div className="flex items-center gap-x-2 ml-4">
                        <div><StarIcon className="w-5 h-5 text-yellow-300" /> </div>
                        <div className="text-yellow-300">{rating}</div>
                    </div>
                    <div></div>
                </div>
            </Div>}
            
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
                <Li>Наименование: {firstActiveOrder?.order?.client?.fullName}</Li>
                {userData?.phoneVision && <Li>Номер телефона: {firstActiveOrder?.order?.address?.phone}</Li>}
                <Li>Адрес: <span className="text-blue-500">{firstActiveOrder?.order?.address?.actual}</span></Li>
                <Li><p>Количество 12.5 - литровых бутылей: <OrderInfo>{firstActiveOrder?.order?.products?.b12}</OrderInfo></p>
                    <div>
                        [{" "}
                        <input
                            size={13}
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
                <Li><p>Количество 18.9 - литровых бутылей: <OrderInfo>{firstActiveOrder?.order?.products?.b19}</OrderInfo></p>
                    <div>
                        [{" "}
                        <input
                            size={13}
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
                    <div>Форма оплаты по факту:<span className="text-yellow-300"> {opForm === "fakt" && "Нал_Карта_QR"}{opForm === "postpay" && "Постоплата"}{opForm === "credit" && "В долг"}{opForm === "coupon" && "Талоны"}{opForm === "mixed" && "Смешанная"}</span></div>
                </Li>
                <div className="hidden lg:block">
                    <Li>
                        <div className="text-green-400 flex items-center gap-x-3">
                            [
                                <button className="text-green-400 hover:text-blue-500" onClick={() => {setOpForm("fakt")}}>Нал_Карта_QR</button> /
                                <button className="text-green-400 hover:text-blue-500" onClick={() => {setOpForm("coupon")}}>Талоны</button> /
                                <button className="text-green-400 hover:text-blue-500" onClick={() => {setOpForm("postpay")}}>Постоплата</button> /
                                <button className="text-green-400 hover:text-blue-500" onClick={() => {setOpForm("credit")}}>В долг</button> /
                                <button className="text-green-400 hover:text-blue-500" onClick={() => {setOpForm("mixed")}}>Смешанная</button>
                            ]
                        </div>
                    </Li>
                </div>
                <div className="lg:hidden">
                    <Li>
                        [ <button className="text-green-400 hover:text-blue-500" onClick={() => {setOpForm("fakt")}}>Нал_Карта_QR</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-green-400 hover:text-blue-500" onClick={() => {setOpForm("coupon")}}>Талоны</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-green-400 hover:text-blue-500" onClick={() => {setOpForm("postpay")}}>Постоплата</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-green-400 hover:text-blue-500" onClick={() => {setOpForm("credit")}}>В долг</button> ]
                    </Li>
                    <Li>
                        [ <button className="text-green-400 hover:text-blue-500" onClick={() => {setOpForm("mixed")}}>Смешанная</button> ]
                    </Li>
                </div>
                {firstActiveOrder?.order?.date?.time !== "" && <Li>Время доставки: <span className="text-yellow-300">{firstActiveOrder?.order?.date?.time}</span></Li>}
                
            </> : 
            <>
                <Div>Заказов не осталось</Div>
            </>}
            
            <Div />
        </Container>
    );
}
