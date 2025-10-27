import { useState, useEffect } from "react";
import api from "../../api";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import MyButton from "../../Components/MyButton";
import LinkButton from "../../Components/LinkButton";
import Container from "../../Components/Container";
import clsx from "clsx";
import OrderInfo from "../../Components/OrderInfo";
import useFetchUserData from "../../customHooks/useFetchUserData";
import DataInput from "../../Components/DataInput";
import MySnackBar from "../../Components/MySnackBar";

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


export default function SuperAdminCancelledOrders() {
    const userData = useFetchUserData();
    const [orders, setOrders] = useState([]);
    const [date, setDate] = useState(getCurrentDate());
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const getCancelledOrders = () => {
        if (date === "" || date.length !== 10) {
            setOpen(true)
            setStatus("error")
            setMessage("Введите дату в формате ГГГГ-ММ-ДД")
            return;
        }
        api.post("/getCancelledOrders", {date}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setOrders(data.orders)
        }).catch((e) => {
            console.log(e);
        })
    }

    const addOrderToAggregator = (id) => {
        api.post("/addOrderToAggregator", {orderId: id}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            console.log(data);
            getCancelledOrders();
        })
    }

    const toTomorrow = (id) => {
        api.post("/toTomorrow", {orderId: id}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            console.log(data);
            getCancelledOrders();
        })
    }

    useEffect(() => {
        getCancelledOrders()
    }, []);

    const closeSnack = () => {
        setOpen(false);
    };

    return (
        <div className="relative">
            <Container role={userData?.role}>
                
                <Div>Список заказов</Div>
                <Div />
                <Div>
                    <div>Отмененные заказы:</div>
                </Div>
                <Div />
                <Div>
                    <div>Дата:</div>
                </Div>
                <Li>
                    <div className="text-red">
                        [
                        <DataInput
                            color="red"
                            value={date}
                            name="date"
                            change={(e) => setDate(e.target.value)}
                        />
                        ]
                    </div>
                    <MyButton click={() => {getCancelledOrders()}}>Применить</MyButton>
                </Li>
                <Div />

                {orders && orders.length > 0 && orders.map((item) => (
                    <div key={item._id}>
                        <Li icon={item?.franchisee?._id === "66f15c557a27c92d447a16a0"}>
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div className={clsx("", {
                                    "text-white bg-red": new Date(item?.date?.d).toISOString().split('T')[0] < new Date().toISOString().split('T')[0],
                                    "text-white bg-green-400": new Date(item?.date?.d).toISOString().split('T')[0] === new Date().toISOString().split('T')[0],
                                    "text-white bg-blue-600": new Date(item?.date?.d).toISOString().split('T')[0] > new Date().toISOString().split('T')[0],
                                })}>
                                    Заказ {userData?.role === "superAdmin" && item?.forAggregator && "Агрегатор"}: 
                                </div>
                                <div className={clsx("", {
                                    "text-yellow-300": new Date(item?.date?.d) > new Date()
                                })}>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                <div>{item?.client?.fullName}</div>
                                <a target="_blank" rel="noreferrer" href={item?.address?.link} className={clsx("", {
                                    "text-blue-500 hover:text-green-500": item?.address?.point?.lat && item?.address?.point?.lon,
                                    "text-red": !item?.address?.point?.lat || !item?.address?.point?.lon
                                })}>{item?.address?.actual}</a>
                                <div>{(item?.products?.b12 !== 0 && item?.products?.b12 !== null) && <span>12.5л: <OrderInfo>{item?.products?.b12}</OrderInfo></span>}; {(item?.products?.b19 !== 0 && item?.products?.b19 !== null) && <span>18.9л: <OrderInfo>{item?.products?.b19}</OrderInfo></span>}</div>
                                <div>{item?.comment && <span className="text-yellow-300">Есть комм.</span>}</div>
                                <LinkButton
                                    href={`/orderPage/${item?._id}`}
                                >
                                    Просмотр
                                </LinkButton>
                                <MyButton click={() => {addOrderToAggregator(item?._id)}}>Добавить заново</MyButton>
                                <MyButton click={() => {toTomorrow(item?._id)}}>На завтра</MyButton>
                                <div>Причина: <span className="text-red">{item?.reason}</span></div>
                                <div>{item?.courier?.fullName}</div>
                            </div>
                        </Li>
                    </div>
                ))}
                <MySnackBar
                    open={open}
                    text={message}
                    status={status}
                    close={closeSnack}
                />
            </Container>
        </div>
    );
}
