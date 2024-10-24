import { useEffect, useState } from "react";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Info from "../../Components/Info";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";
import useFetchUserData from "../../customHooks/useFetchUserData";

export default function SuperAdmin() {
    const [info, setInfo] = useState({});
    const userData = useFetchUserData();

    useEffect(() => {
        api.get("/getMainPageInfo", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setInfo(data);
            })
            .catch((e) => {
                console.log(e);
            });
    }, []);

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) {
            return "0 тенге"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} тенге`;
    };

    return (
        <Container role={userData?.role}>
            <Div>
                <div>Главная панель</div>
            </Div>
            <Div />
            <Div>
                <div>Сводная информация:</div>
            </Div>
            <>
                <Li>
                    <div className="">
                        Активные заказы:
                        <Info>{info?.activeOrders}</Info>
                    </div>
                </Li>
                <Li>
                    <div className="">
                        Завершенные заказы:
                        <Info>{info?.deliveredOrders}</Info>
                    </div>
                </Li>
                <Li>
                    <div className="">
                        Клиенты:
                        <Info>{info?.clients}</Info>
                    </div>
                </Li>
                <Li>
                    <div className="">
                        Общая прибыль:
                        <Info>{formatCurrency(info?.totalRevenue)}</Info>
                    </div>
                </Li>
                <Li>
                    <div className="">
                        Общая сумма:
                        <Info>{formatCurrency(info?.totalSum)}</Info>
                    </div>
                </Li>
            </>
            <Div />
            <Div>
                <div>Управление франчайзи:</div>
            </Div>
            <>
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>Список франчайзи:</div>
                        <LinkButton href="/franchiseeList">Перейти</LinkButton>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>Список сотрудников цеха:</div>
                        <LinkButton href="/departmentList">Перейти</LinkButton>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>Настройка подписок:</div>
                        <LinkButton href="/subsciption">Перейти</LinkButton>
                    </div>
                </Li>
            </>
            <Div />
            <Div>
                <div>Действия:</div>
            </Div>
            <div className="lg:hidden">
                <>
                    <Li>
                        <LinkButton color="green" href="/addOrder">Добавить заказ</LinkButton>
                    </Li>
                    <Li>
                        <LinkButton color="green" href="/addClinet">
                            Добавить клиента
                        </LinkButton>
                    </Li>
                    <Li>
                        <LinkButton color="green" href="/addPromoCode">
                            Создать промокод
                        </LinkButton>
                    </Li>
                    <Li>
                        <LinkButton color="green" href="/addCourier">
                            Добавить курьера
                        </LinkButton>
                    </Li>
                </>
            </div>
            <Div styles="hidden lg:flex">
                <div className="flex items-center gap-x-3">
                    <LinkButton color="green" href="/addOrder">Добавить заказ</LinkButton>
                    <LinkButton color="green" href="/addClinet">Добавить клиента</LinkButton>
                    <LinkButton color="green" href="/addPromoCode">
                        Создать промокод
                    </LinkButton>
                    <LinkButton color="green" href="/addCourier">Добавить курьера</LinkButton>
                </div>
            </Div>
            <Div />
        </Container>
    );
}
