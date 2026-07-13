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
import ChooseFranchiseeModal from "../Components/ChooseFranchiseeModal";
import useScrollPosition from "../customHooks/useScrollPosition";
import DataInput from "../Components/DataInput";

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getTomorrowDate = () => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const OP_FORMS = [
    { value: "fakt", label: "Нал_QR" },
    { value: "postpay", label: "Постоплата" },
    { value: "credit", label: "Карта" },
    { value: "coupon", label: "Талоны" },
    { value: "mixed", label: "Смешанно" },
];

const getOpFormLabel = (opForm) => {
    const found = OP_FORMS.find((item) => item.value === opForm);
    return found ? found.label : opForm;
};

export default function CourierAggregatorPage() {
    const scrollPosition = useScrollPosition();
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
    const [income, setIncome] = useState(0);
    const [incomeLogs, setIncomeLogs] = useState([]);
    const [incomeLogDateFrom, setIncomeLogDateFrom] = useState(getCurrentDate());
    const [incomeLogDateTo, setIncomeLogDateTo] = useState(getTomorrowDate());
    const [franchiseesModal, setFranchiseesModal] = useState(false);
    const [franchisee, setFranchisee] = useState(null);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordMsg, setPasswordMsg] = useState(null);
    const [editingLogId, setEditingLogId] = useState(null);
    const [editingOpForm, setEditingOpForm] = useState("");
    const [incomeLogActionMsg, setIncomeLogActionMsg] = useState(null);

    const closeFranchiseeModal = () => {
        setFranchiseesModal(false);
    };

    const chooseFranchisee = (chFranchisee) => {
        setFranchisee(chFranchisee);
        setFranchiseesModal(false);
        updateCourierAggregatorData(id, "franchisee", chFranchisee._id)
    };

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
            setIncome(data.userData.income || 0);
        } catch (error) {
            console.error("Ошибка при загрузке данных курьера:", error);
        }
    };

    const loadIncomeLogs = async () => {
        try {
            const { data } = await api.post(
                "/getCourierAggregatorIncomeLogs",
                { courierId: id, limit: 200, dateFrom: incomeLogDateFrom, dateTo: incomeLogDateTo },
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
            if (data.success) {
                setIncomeLogs(data.logs || []);
            }
        } catch (error) {
            console.error("Ошибка при загрузке истории income:", error);
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

    const handleDeleteIncomeLog = async (logId) => {
        if (!window.confirm("Удалить эту запись? Баланс курьера будет пересчитан.")) {
            return;
        }
        try {
            const { data } = await api.post(
                "/deleteCourierAggregatorIncomeLog",
                { logId, courierId: id },
                { headers: { "Content-Type": "application/json" } }
            );
            if (data.success) {
                setIncome(data.income);
                setIncomeLogActionMsg({ ok: true, text: "Запись удалена" });
                await loadCourierData();
                await loadIncomeLogs();
            } else {
                setIncomeLogActionMsg({ ok: false, text: data.message });
            }
        } catch {
            setIncomeLogActionMsg({ ok: false, text: "Ошибка при удалении записи" });
        }
    };

    const handleSaveOpForm = async (logId) => {
        try {
            const { data } = await api.post(
                "/updateCourierAggregatorIncomeLogOpForm",
                { logId, courierId: id, opForm: editingOpForm },
                { headers: { "Content-Type": "application/json" } }
            );
            if (data.success) {
                setIncome(data.income);
                setEditingLogId(null);
                setEditingOpForm("");
                setIncomeLogActionMsg({ ok: true, text: "Форма оплаты изменена" });
                await loadCourierData();
                await loadIncomeLogs();
            } else {
                setIncomeLogActionMsg({ ok: false, text: data.message });
            }
        } catch {
            setIncomeLogActionMsg({ ok: false, text: "Ошибка при изменении формы оплаты" });
        }
    };

    const handleChangePassword = async () => {
        if (newPassword.length < 4) {
            setPasswordMsg({ ok: false, text: "Пароль должен быть не менее 4 символов" });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordMsg({ ok: false, text: "Пароли не совпадают" });
            return;
        }
        try {
            const { data } = await api.post("/changePasswordCourierAggregator", { courierId: id, newPassword }, {
                headers: { "Content-Type": "application/json" },
            });
            if (data.success) {
                setPasswordMsg({ ok: true, text: "Пароль успешно изменён" });
                setNewPassword("");
                setConfirmPassword("");
            } else {
                setPasswordMsg({ ok: false, text: data.message });
            }
        } catch {
            setPasswordMsg({ ok: false, text: "Ошибка при смене пароля" });
        }
    };
    

    useEffect(() => {
        loadCourierData();
        getCompletedOrCancelledOrdersFromCourierAggregator();
        loadIncomeLogs();
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

    const handleIncomeLogDateChange = (e) => {
        const { name, value } = e.target;
        let input = e.target.value.replace(/\D/g, ""); // Remove all non-digit characters
        if (input.length > 8) input = input.substring(0, 8); // Limit input to 8 digits

        const year = input.substring(0, 4);
        const month = input.substring(4, 6);
        const day = input.substring(6, 8);

        let formattedValue = year;
        if (input.length >= 5) {
            formattedValue += "-" + month;
        }
        if (input.length >= 7) {
            formattedValue += "-" + day;
        }
        if (name === "incomeLogDateFrom") {
            setIncomeLogDateFrom(formattedValue);
        }
        if (name === "incomeLogDateTo") {
            setIncomeLogDateTo(formattedValue);
        }
    };

    return (
        <Container role={userData?.role}>
            {franchiseesModal && (
                <ChooseFranchiseeModal
                    closeFranchiseeModal={closeFranchiseeModal}
                    chooseFranchisee={chooseFranchisee}
                    scrollPosition={scrollPosition}
                />
            )}
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
            
            <Div />
            <Div>
                <div className="flex items-center gap-x-2 flex-wrap">
                    <div>Верифицирован?:</div>
                    <Info>{courier.status === "active" ? "Да" : "Нет"}</Info>
                    <MyButton click={() => {
                        if (courier.status === "active") {
                            updateCourierAggregatorData(id, "status", "awaitingVerfication")
                        } else {
                            updateCourierAggregatorData(id, "status", "active")
                        }
                    }}>{courier.status === "active" ? "Убрать" : "Верифицировать"}</MyButton>
                </div>
            </Div>

            <Div />
            <Div>
                <div className="flex items-center gap-x-2 flex-wrap">
                    <div>Закрепить за франчайзием: {courier.franchisee ? courier.franchisee.fullName : "Нет"}</div>
                    <MyButton click={() => {
                        setFranchiseesModal(true)
                    }}>Закрепить</MyButton>
                </div>
            </Div>

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
            <Div className="text-xl font-bold">Баланс курьера (income)</Div>
            <Li>
                <div className="flex items-center gap-x-2 flex-wrap">
                    <div>Текущий баланс: {courier.income ?? 0} ₸</div>
                    <MyInput
                        value={income}
                        change={(e) => setIncome(e.target.value)}
                        color="white"
                    />
                    <MyButton
                        click={async () => {
                            await updateCourierAggregatorData(id, "income", Number(income));
                            await loadIncomeLogs();
                        }}
                    >
                        Обновить баланс
                    </MyButton>
                </div>
            </Li>
            <>
                    <Div>История изменений баланса:</Div>
                    {incomeLogActionMsg && (
                        <Div>
                            <span className={incomeLogActionMsg.ok ? "text-green-500" : "text-red-500"}>
                                {incomeLogActionMsg.text}
                            </span>
                        </Div>
                    )}
                    <Div>
                        <div className="flex items-center gap-x-2 flex-wrap">
                            <div>Дата:</div>
                            <div className="text-red">
                                [
                                <DataInput
                                    color="red"
                                    name="incomeLogDateFrom"
                                    value={incomeLogDateFrom}
                                    change={handleIncomeLogDateChange}
                                />
                                ]
                            </div>
                            <div> - </div>
                            <div className="text-red">
                                [
                                <DataInput
                                    color="red"
                                    name="incomeLogDateTo"
                                    value={incomeLogDateTo}
                                    change={handleIncomeLogDateChange}
                                />
                                ]
                            </div>
                            <MyButton click={() => {
                                loadIncomeLogs()
                            }}>
                                Применить
                            </MyButton>
                            {(incomeLogDateFrom || incomeLogDateTo) && (
                                <MyButton
                                    click={() => {
                                        setIncomeLogDateFrom("");
                                        setIncomeLogDateTo("");
                                    }}
                                >
                                    Сбросить
                                </MyButton>
                            )}
                        </div>
                    </Div>
                    <Div />
                    {incomeLogs.length === 0 ? (
                        <Div>Нет записей за выбранный период</Div>
                    ) : (
                        <div className="max-h-[600px] overflow-y-auto">
                            {incomeLogs.map((log) => (
                                <div key={log._id}>
                                    <Li>
                                        <div className="flex flex-col gap-y-1">
                                            <div>
                                                {new Date(log.createdAt).toLocaleString("ru-RU")}
                                                {" | "}
                                                {log.type === "order_complete" && "Завершение заказа"}
                                                {log.type === "admin_adjustment" && "Изменение администратором"}
                                                {log.type === "withdrawal_request" && "Запрос на вывод"}
                                            </div>
                                            <div>
                                                Изменение: {log.amount > 0 ? "+" : ""}{log.amount} ₸
                                                {" | "}
                                                Было: {log.incomeBefore} ₸ → Стало: {log.incomeAfter} ₸
                                            </div>
                                            {log.opForm && <div>Форма оплаты: {getOpFormLabel(log.opForm)}</div>}
                                            {log.comment && <div>{log.comment}</div>}
                                            {log.order?.address?.actual && (
                                                <div>Заказ: {log.order.address.actual}</div>
                                            )}
                                            <div className="flex items-center gap-x-2 flex-wrap">
                                                {log.order?._id && (
                                                    <LinkButton
                                                        color="green"
                                                        href={`/OrderPage/${log.order._id}`}
                                                    >Перейти на заказ</LinkButton>
                                                )}
                                                {log.type === "order_complete" && log.order?._id && (
                                                    <MyButton
                                                        click={() => {
                                                            setEditingLogId(log._id);
                                                            setEditingOpForm(log.opForm || log.order?.opForm || "fakt");
                                                            setIncomeLogActionMsg(null);
                                                        }}
                                                    >
                                                        Изменить форму оплаты
                                                    </MyButton>
                                                )}
                                                <MyButton
                                                    click={() => {
                                                        setIncomeLogActionMsg(null);
                                                        handleDeleteIncomeLog(log._id);
                                                    }}
                                                >
                                                    Удалить
                                                </MyButton>
                                            </div>
                                            {editingLogId === log._id && (
                                                <div className="flex flex-col gap-y-1 mt-1">
                                                    {OP_FORMS.map((item) => (
                                                        <div
                                                            key={item.value}
                                                            className={clsx("hover:text-yellow-300 flex items-center gap-x-3", {
                                                                "text-green-400": editingOpForm !== item.value,
                                                                "text-blue-700": editingOpForm === item.value,
                                                            })}
                                                        >
                                                            <div>[</div>
                                                            <button onClick={() => setEditingOpForm(item.value)}>
                                                                {item.label}
                                                            </button>
                                                            <div>]</div>
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center gap-x-2 flex-wrap">
                                                        <MyButton click={() => handleSaveOpForm(log._id)}>
                                                            Сохранить
                                                        </MyButton>
                                                        <MyButton
                                                            click={() => {
                                                                setEditingLogId(null);
                                                                setEditingOpForm("");
                                                            }}
                                                        >
                                                            Отменить
                                                        </MyButton>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Li>
                                    <Div />
                                </div>
                            ))}
                        </div>
                    )}
            </>

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
            <Div className="text-xl font-bold">Сменить пароль</Div>
            <Li>
                <div className="flex flex-col gap-y-2">
                    <div className="flex items-center gap-x-2 flex-wrap">
                        <div>Новый пароль:</div>
                        <MyInput
                            value={newPassword}
                            change={(e) => { setNewPassword(e.target.value); setPasswordMsg(null); }}
                            color="white"
                            type="password"
                        />
                    </div>
                    <div className="flex items-center gap-x-2 flex-wrap">
                        <div>Подтверждение:</div>
                        <MyInput
                            value={confirmPassword}
                            change={(e) => { setConfirmPassword(e.target.value); setPasswordMsg(null); }}
                            color="white"
                            type="password"
                        />
                    </div>
                    <div className="flex items-center gap-x-2 flex-wrap">
                        <MyButton click={handleChangePassword}>Сменить пароль</MyButton>
                        {passwordMsg && (
                            <span className={passwordMsg.ok ? "text-green-500" : "text-red-500"}>
                                {passwordMsg.text}
                            </span>
                        )}
                    </div>
                </div>
            </Li>
            <Div />
        </Container>
    );
}
