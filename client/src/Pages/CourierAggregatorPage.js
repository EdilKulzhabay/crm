import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import Li from "../Components/Li";
import LinkButton from "../Components/LinkButton";
import MyButton from "../Components/MyButton";
import Info from "../Components/Info";
import clsx from "clsx";
import useFetchUserData from "../customHooks/useFetchUserData";
import MyInput from "../Components/MyInput";

export default function CourierAggregatorPage() {
    const userData = useFetchUserData()
    const { id } = useParams();
    const [courier, setCourier] = useState(null);
    const [completedOrders, setCompletedOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [capacity, setCapacity] = useState(0);
    const [capacity12, setCapacity12] = useState(0);
    const [capacity19, setCapacity19] = useState(0);
    const [price12, setPrice12] = useState(0);
    const [price19, setPrice19] = useState(0);
    const loadCourierData = async () => {
        try {
            const { data } = await api.post(
                "/getCourierAggregatorDataForAdmin",
                { id },
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
            setCourier(data.userData);
            setCapacity(data.userData.capacity);
            setCapacity12(data.userData.capacity12);
            setCapacity19(data.userData.capacity19);
            setPrice12(data.userData.price12);
            setPrice19(data.userData.price19);
        } catch (error) {
            console.error("Ошибка при загрузке данных курьера:", error);
        }
    };

    const getCompletedOrCancelledOrdersFromCourierAggregator = async () => {
        try {
            const { data } = await api.post(
                "/getCompletedOrCancelledOrdersFromCourierAggregator",
                { courierId: id },
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
            setCompletedOrders(data.orders);
        } catch (error) {
            console.error("Ошибка при получении данных о завершенных или отменных заказов курьера:", error);
        }
    }

    const updateCourierAggregatorData = async (id, changeField, changeData) => {
        await api.post("/updateCourierAggregatorData", {id, changeField, changeData}, {
            headers: { "Content-Type": "application/json" },
        }).then(async () => {
            await loadCourierData()
        })
    }
    

    useEffect(() => {
        loadCourierData();
        getCompletedOrCancelledOrdersFromCourierAggregator()
        setLoading(false)
    }, [id]);

    if (loading) {
        return (
            <Container role={userData?.role}>
                <Div>Загрузка...</Div>
            </Container>
        );
    }

    if (!courier) {
        return (
            <Container role={userData?.role}>
                <Div>Курьер не найден</Div>
            </Container>
        );
    }

    const handleCapacity = (e) => {
        setCapacity(e.target.value)
    }

    const handleCapacity12 = (e) => {
        setCapacity12(e.target.value)
    }

    const handleCapacity19 = (e) => {
        setCapacity19(e.target.value)
    }

    return (
        <Container role={userData?.role}>
            <Div className="text-2xl font-bold">Информация о курьере</Div>
            <Div />
            <Li>
                <div className="flex items-center gap-x-2 flex-wrap">
                    <div>Имя: {courier.fullName}</div>
                    <div>|</div>
                    <div>Телефон: {courier.phone}</div>
                    <div>|</div>
                    <div>Email: {courier.email}</div>
                    <div>|</div>
                    <div className={clsx("", {
                        "text-green-500": courier.onTheLine,
                        "text-red-500": !courier.onTheLine
                    })}>
                        Статус: {courier.onTheLine ? "Активен" : "Неактивен"}
                    </div>
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-2 flex-wrap">
                    <div>
                        Вместимость: {courier.capacity}
                    </div>

                    <MyInput
                        value={capacity}
                        change={handleCapacity}
                        color="white"
                    />

                    <MyButton
                        onClick={() => {
                            updateCourierAggregatorData(id, "capacity", capacity)
                        }}
                    >
                        Обновить
                    </MyButton>
                </div>
            </Li>

            <Div/>
            <Div>
                <div className="flex items-center gap-x-2 flex-wrap">
                    <div>В сети: {courier.onTheLine ? "Да" : "Нет"}</div>
                    <MyButton click={() => {
                        updateCourierAggregatorData(id, "onTheLine", !courier.onTheLine)
                    }}>{courier.onTheLine ? "Убрать" : "Включить"}</MyButton>
                </div>
            </Div>
            <Div />

            <Div>
                <div className="flex items-center gap-x-2 flex-wrap">
                    <div>
                        <div>
                            Количество 12л:
                        </div>
                        <MyInput
                            value={capacity12}
                            change={handleCapacity12}
                            color="white"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-x-2 flex-wrap">
                <div>
                        <div>
                            Количество 19л:
                        </div>
                        <MyInput
                            value={capacity19}
                            change={handleCapacity19}
                            color="white"
                        />
                    </div>
                </div>

                {(Number(capacity12) !== courier.capacity12 || Number(capacity19) !== courier.capacity19) && (
                    <Div>
                        <MyButton
                            click={() => {
                                updateCourierAggregatorData(id, "capacities", {
                                    capacity12: capacity12,
                                    capacity19: capacity19
                                })
                            }}
                        >
                            Обновить
                        </MyButton>
                    </Div>
                )}
            </Div>

            <Div />
            <Div className="text-xl font-bold">Активный заказ</Div>
            {courier?.order ? (
                <Li>
                    <div className="flex flex-col gap-y-2">
                        <div className="flex items-center gap-x-2 flex-wrap">
                            <div>Заказ #{courier?.order?.clientAddress}</div>
                            <div>|</div>
                            <div>Статус: В пути</div>
                            <LinkButton
                                color="green"
                                href={`/OrderPage/${courier?.order?.orderId}`}
                            >Перейти на заказ</LinkButton>
                        </div>
                    </div>
                </Li>
            ) : (
                <Div>Нет активных заказов</Div>
            )}

            <Div />
            <Div className="text-xl font-bold">Заказы в ожидании</Div>
            {courier?.orders?.length > 0 ? (
                courier?.orders.map(order => (
                    <Li key={order._id}>
                        {order.orderId !== courier?.order?.orderid && <div className="flex flex-col gap-y-2">
                            <div>Заказ #{order?.clientAddress}</div>
                            <LinkButton
                                color="green"
                                href={`/OrderPage/${order?.orderId}`}
                            >Перейти на заказ</LinkButton>
                        </div>}
                    </Li>
                ))
            ) : (
                <Div>Нет заказов в ожидании</Div>
            )}

            <Div />
            <Div className="text-xl font-bold">Завершенные заказы</Div>
            {completedOrders.length > 0 ? (
                completedOrders.map(order => (
                    <Li key={order._id}>
                        <div className="flex items-center gap-x-2 flex-wrap">
                            <div>Заказ #{order?.address.actual}</div>
                            <div>|</div>
                            
                            <div className={clsx("", {
                                "text-green-500": order?.status === "delivered",
                                "text-red-500": order?.status === "cancelled"
                            })}>
                                Статус: {order?.status === "delivered" ? "Завершен" : "Отменен"}
                            </div>
                            <LinkButton
                                color="green"
                                href={`/OrderPage/${order?._id}`}
                            >Перейти на заказ</LinkButton>
                            {order?.reason && (
                                <>
                                    <div>|</div>
                                    <div>Причина: {order.reason}</div>
                                </>
                            )}
                        </div>
                    </Li>
                ))
            ) : (
                <Div>Нет завершенных заказов</Div>
            )}
            <Div />
            <Div>
                Специальная цена: {courier?.isExternal ? "Включена" : "Отключена"}
                <MyButton click={() => {
                    updateCourierAggregatorData(id, "isExternal", !courier?.isExternal)
                }}>{courier?.isExternal ? "Отключить" : "Включить"}</MyButton>
            </Div>
            {courier?.isExternal && (
                <>
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>Цена 12.5л:</div>
                            <MyInput
                                value={price12}
                                change={(e) => {
                                    setPrice12(e.target.value)
                                }}
                            />
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>Цена 19л:</div>
                            <MyInput
                                value={price19}
                                change={(e) => {
                                    setPrice19(e.target.value)
                                }}
                            />
                        </div>
                    </Li>
                    <Li>
                        <MyButton click={() => {
                            updateCourierAggregatorData(id, "price12", Number(price12))
                            updateCourierAggregatorData(id, "price19", Number(price19))
                        }}>Обновить</MyButton>
                    </Li>
                </>
            )}
            <Div />
        </Container>
    );
}
