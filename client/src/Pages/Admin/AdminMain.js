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

    const formatCurrency = (amount) => {
        return `${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} тенге`;
    };

    return (
        <Container role="admin">
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
                        Прибыль:
                        <Info>{formatCurrency(info?.totalRevenue)}</Info>
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
