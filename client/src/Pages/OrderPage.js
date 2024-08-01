import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MySnackBar from "../Components/MySnackBar";

export default function OrderPage() {
    const { id } = useParams();
    const [role, setRole] = useState("");
    const [order, setOrder] = useState(null);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const getOrderData = () => {
        api.post(
            "/getOrderDataForId",
            { id },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                console.log(data);
                setOrder(data.order);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setRole(data.role);
            })
            .catch((e) => {
                console.log(e);
            });

        getOrderData();
    }, []);

    return (
        <Container role={role}>
            <Div>Детали заказа</Div>
            <Div />
            <Div>Клиент:</Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Имя:</div>
                        <div>{order?.client?.fullName || ""}</div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Телефон:</div>
                        <div>{order?.client?.phone || ""}</div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Адрес:</div>
                        <div>
                            {order?.address?.actual || ""}{" "}
                            <a
                                href={order?.address?.link || "/"}
                                className="text-blue-900 hover:text-blue-500"
                                target="_blank"
                            >
                                %2gis%
                            </a>
                        </div>
                    </div>
                </Li>
            </>
            <Div />
            <Div>Продукты:</Div>
            <>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>12,5-литровая бутыль:</div>
                        <div>{order?.products?.b12} шт</div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>18,9-литровая бутыль:</div>
                        <div>{order?.products?.b19} шт</div>
                    </div>
                </Li>
            </>

            <Div />
            <Div>Цены товаров:</Div>

            <Div />
            <Div>Сводная информация:</Div>

            <Div />
            <Div>Настройки клиента:</Div>

            <Div />
            <Div>История заказов:</Div>
            <Div>---------------------</Div>

            <Div />
            <Div>Действия:</Div>
            <Div>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyButton click={() => {}}>Создать заказ</MyButton>
                    <MyButton click={() => {}}>
                        Выгрузить заказы в excel
                    </MyButton>
                    <MyButton click={() => {}}>Удлаить клиента</MyButton>
                </div>
            </Div>
            <Div />
            <MySnackBar
                open={open}
                text={message}
                status={status}
                close={closeSnack}
            />
        </Container>
    );
}
