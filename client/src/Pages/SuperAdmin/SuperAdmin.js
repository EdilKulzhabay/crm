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
    const [cancelledOrdersCount, setCancelledOrdersCount] = useState(0);

    useEffect(() => {
        api.get("/getMainPageInfoSA", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setInfo(data)
            })
            .catch((e) => {
                console.log(e);
            });
    }, []);

    useEffect(() => {
        api.get("/getCancelledOrdersCount", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setCancelledOrdersCount(data.count)
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
                <LinkButton href="/superAdminCancelledOrders">
                    <div>ПРОБЛЕМНЫЕ ЗАКАЗЫ: <Info>{cancelledOrdersCount}</Info></div>
                </LinkButton>
            </Div>
            <Div />
            <Div>
                <div>Сводная информация:</div>
            </Div>
            <>
                <Li>
                    <div className="">
                        Активные заказы:
                        <Info>{info?.stats?.myActiveOrders}</Info>
                        <Info>{info?.stats?.otherActiveOrders}</Info>
                    </div>
                </Li>
                <Li>
                    <div className="">
                        Завершенные заказы:
                        <Info>{info?.stats?.myCompletedOrders}</Info>
                        <Info>{info?.stats?.otherCompletedOrders}</Info>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3">
                        <div>Отпущено бутылей: </div>
                        <div>
                            <LinkButton href="/departmentInfo">{info?.bottles?.totalBottles || 0} шт.</LinkButton>
                        </div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3">
                        <div>Самовывоз сегодня: </div>
                        <div>
                            <LinkButton href="/pickupInfo">{info?.pickup?.kolBottles || 0} шт.</LinkButton>
                        </div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3">
                        <div>Остаток в цеху: </div>
                        <div>
                            <Info>{info?.balance?.balance || 0} шт.</Info>
                        </div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-3">
                        <div>Клиенты:</div>
                        <div>
                            <Info>{info?.clients}</Info>
                        </div>
                        <div>
                            <LinkButton href="/adminDenyVerificationClients">{info?.clientsWithDenyVerification || 0}</LinkButton>
                        </div>
                    </div>
                </Li>
                <Li>
                    <div className="">
                        Общая прибыль:
                        <Info>{formatCurrency(info?.stats?.totalRevenue)}</Info>
                    </div>
                </Li>
                <Li>
                    <div className="">
                        Общая сумма:
                        <Info>{formatCurrency(info?.stats?.totalSum)}</Info>
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
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>Модерация:</div>
                        <LinkButton href="/superAdminClientsVerify">Перейти</LinkButton>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>Агрегатор:</div>
                        <LinkButton href="/aggregator">Перейти</LinkButton>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>Тех. поддержка:</div>
                        <LinkButton href="/support">Перейти</LinkButton>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>FAQ:</div>
                        <LinkButton href="/superAdminFaq">Перейти</LinkButton>
                    </div>
                </Li>
            </>
            <Div />
            <Div>
                <div>Управление аквамаркетами:</div>
            </Div>
            <Li>
                <div className="flex items-center flex-wrap gap-x-3">
                    <div>Список аквамаркетов:</div>
                    <LinkButton href="/aquaMarketList">Перейти</LinkButton>
                </div>
            </Li>
            <Li>
                <div className="flex items-center flex-wrap gap-x-3">
                    <div>Создать аквамаркет:</div>
                    <LinkButton href="/addAquaMarket">Перейти</LinkButton>
                </div>
            </Li>

            <Div />
            <Div>
                <div>Действия:</div>
            </Div>
            <div className="lg:hidden">
                <>
                    <Li>
                        <LinkButton color="green" href="/addPickup">Добавить самовывоз</LinkButton>
                    </Li>
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
                    <Li>
                        <LinkButton color="green" href="/sendNotificationToClients">
                            Отправить уведомление
                        </LinkButton>
                    </Li>
                </>
            </div>
            <Div styles="hidden lg:flex">
                <div className="flex items-center gap-x-3">
                    <LinkButton color="green" href="/addPickup">Добавить самовывоз</LinkButton>
                    <LinkButton color="green" href="/addOrder">Добавить заказ</LinkButton>
                    <LinkButton color="green" href="/addOrder2">Добавить завершенный заказ</LinkButton>
                    <LinkButton color="green" href="/addClinet">Добавить клиента</LinkButton>
                    <LinkButton color="green" href="/addPromoCode">
                        Создать промокод
                    </LinkButton>
                    <LinkButton color="green" href="/addCourier">Добавить курьера</LinkButton>
                    <LinkButton color="green" href="/sendNotificationToClients">Отправить уведомление</LinkButton>
                </div>
            </Div>
            <Div />
        </Container>
    );
}
