import { useEffect, useState } from "react";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Info from "../../Components/Info";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";

export default function SuperAdmin() {
    const [info, setInfo] = useState({});

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

    return (
        <Container role="superAdmin">
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
                        Прибыль франчайзера от франчайзи:
                        <Info>2 000 000 тенге</Info>
                    </div>
                </Li>
                <Li>
                    <div className="">
                        Прибыль франчайзи от клиентов:
                        <Info>7 000 000 тенге</Info>
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
                        <LinkButton href="/addOrder">Добавить заказ</LinkButton>
                    </Li>
                    <Li>
                        <LinkButton href="/addClinet">
                            Добавить клиента
                        </LinkButton>
                    </Li>
                    <Li>
                        <LinkButton href="/addPromoCode">
                            Создать промокод
                        </LinkButton>
                    </Li>
                    <Li>
                        <LinkButton href="/addCourier">
                            Добавить курьера
                        </LinkButton>
                    </Li>
                </>
            </div>
            <Div styles="hidden lg:flex">
                <div className="flex items-center gap-x-3">
                    <LinkButton href="/addOrder">Добавить заказ</LinkButton>
                    <LinkButton href="/addClinet">Добавить клиента</LinkButton>
                    <LinkButton href="/addPromoCode">
                        Создать промокод
                    </LinkButton>
                    <LinkButton href="/addCourier">Добавить курьера</LinkButton>
                </div>
            </Div>
            <Div />
        </Container>
    );
}
