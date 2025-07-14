import { useCallback, useRef, useState, useEffect } from "react";
import api from "../api";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import LinkButton from "../Components/LinkButton";
import Container from "../Components/Container";
import clsx from "clsx";
import OrderInfo from "../Components/OrderInfo";
import useFetchUserData from "../customHooks/useFetchUserData";


export default function SuperAdminCancelledOrders() {
    const userData = useFetchUserData();
    const [orders, setOrders] = useState([]);

    const getCancelledOrders = () => {
        api.get("/getCancelledOrders", {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setOrders(data.orders)
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        getCancelledOrders()
    }, []);

    return (
        <div className="relative">
            <Container role={userData?.role}>
                
                <Div>Список заказов</Div>
                <Div />
                <Div>
                    <div>Отмененные заказы:</div>
                </Div>

                {orders && orders.length > 0 && orders.map((order) => (
                    <div key={order._id}>
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
                                {userData?.role === "superAdmin" && <>
                                    {item?.transferred && 
                                    <div className={clsx("", {
                                        "text-white bg-red": new Date(item?.date?.d).toISOString().split('T')[0] < new Date().toISOString().split('T')[0],
                                    })}>
                                        {item?.transferredFranchise}
                                    </div>}
                                    {!item?.transferred && <MyButton click={() => {setOrder(item?._id); setFranchiseesModal(true)}}>Перенести</MyButton>}
                                    {item?.transferred &&  <MyButton click={() => {closeOrderTransfer(item?._id)}}>
                                        <span className="text-green-400">
                                            Отменить
                                        </span></MyButton>}
                                    </>}
                                <div>{item?.courier?.fullName}</div>
                            </div>
                        </Li>
                    </div>
                ))}
            </Container>
        </div>
    );
}
