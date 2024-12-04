import { useEffect, useState } from "react";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Info from "../../Components/Info";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";
import useFetchUserData from "../../customHooks/useFetchUserData";

export default function SuperAdmin() {
    const userData = useFetchUserData();
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
                    <div className="flex items-center gap-x-2">
                        <div>
                        Активные заказы:
                        <Info>{info?.activeOrders}</Info>
                        </div>
                        <div className="flex items-center gap-x-1">
                            <div className="text-red">[</div>    
                            <div className="bg-red text-white px-1.5">{info?.unfinishedOrders}</div>
                            <div className="text-red">]</div>    
                        </div>                        
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
                <Li>
                    <div className="">
                        Сумма:
                        <Info>{formatCurrency(info?.totalSum)}</Info>
                    </div>
                </Li>
                {userData?.b121kol !== 9999 && 
                    <Li>
                        <div className="">
                            Количество 12,5 л:
                            <Info>{userData?.b121kol}</Info>
                        </div>
                    </Li>
                }
                <Li>
                    <div className="">
                        Количество 18,9 л. (1):
                        <Info>{userData?.b191kol}</Info>
                    </div>
                </Li>
                <Li>
                    <div className="">
                        Количество 18,9 л. (7):
                        <Info>{userData?.b197kol}</Info>
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
