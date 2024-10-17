import { useEffect, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import useFetchUserData from "../customHooks/useFetchUserData";
import api from "../api";
import Info from "../Components/Info";
import Li from "../Components/Li";
import DataInput from "../Components/DataInput";
import MyButton from "../Components/MyButton";

export default function Analytics() {
    const userData = useFetchUserData()
    const getCurrentDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getStartOfMonth = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}-01`;
    };

    const [dates, setDates] = useState({
        startDate: getStartOfMonth(), // Начало месяца
        endDate: getCurrentDate()     // Сегодняшняя дата
    });
    const [stats, setStats] = useState(null)
    const handleDateChange = (e) => {
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

        setDates({ ...dates, [e.target.name]: formattedValue });
    };

    const getAnalytics = () => {
        const id = userData?._id
        api.post("/getAnalyticsData", {id, ...dates}, {
            headers: {"Content-Type": "application/json"}
        }).then(({data}) => {
            setStats(data.stats)
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        if (userData?._id) {
            getAnalytics()
        }
    }, [userData])

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) {
            return "0 тенге"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} тенге`;
    };

    return (
        <Container role={userData?.role}>
            {stats === null ? <Div>Загрузка данных...</Div> : (
                <>
                    <Div>Аналитика</Div>
                    <Div />
                    <Div>Фильтры:</Div>
                    <>
                        <Li>
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div>Дата:</div>
                                <div className="text-red">
                                    [
                                    <DataInput
                                        color="red"
                                        value={dates.startDate}
                                        name="startDate"
                                        change={handleDateChange}
                                    />
                                    ]
                                </div>
                                <div> - </div>
                                <div className="text-red">
                                    [
                                    <DataInput
                                        color="red"
                                        value={dates.endDate}
                                        name="endDate"
                                        change={handleDateChange}
                                    />
                                    ]
                                </div>
                                <MyButton click={getAnalytics}>
                                    <span className="text-green-400">
                                        Применить
                                    </span>
                                </MyButton>
                            </div>
                        </Li>
                    </>
                    <Div />
                    <Div>Дополнительные заказы:</Div>
                    <Div>---------------------</Div>
                    <Div>Бутыли 18.9л: <Info>{stats?.totalAdditionalB19Bottles}</Info></Div>
                    <Div>Средняя стоимость: <Info>{formatCurrency(stats?.additionalAverageCostB19)}</Info></Div>
                    <Div>Оплата франчайзеру: <Info>{formatCurrency(stats?.additionalB19Expense)}</Info></Div>
                    <Div>Прибыль франчайзи: <Info>{formatCurrency(stats?.additionalB19Revenue)}</Info></Div>
                    <Div>Общая сумма: <Info>{formatCurrency(stats?.additionalB19Amount)}</Info></Div>
                    <Div />
                    <Div>Бутыли 12.5л: <Info>{stats?.totalAdditionalB12Bottles}</Info></Div>
                    <Div>Средняя стоимость: <Info>{formatCurrency(stats?.additionalAverageCostB12)}</Info></Div>
                    <Div>Оплата франчайзеру: <Info>{formatCurrency(stats?.additionalB12Expense)}</Info></Div>
                    <Div>Прибыль франчайзи: <Info>{formatCurrency(stats?.additionalB12Revenue)}</Info></Div>
                    <Div>Общая сумма: <Info>{formatCurrency(stats?.additionalB12Amount)}</Info></Div>
                    <Div />
                    <Div>Собственные заказы:</Div>
                    <Div>---------------------</Div>
                    <Div>Бутыли 18.9л: <Info>{stats?.totalRegularB19Bottles}</Info></Div>
                    <Div>Средняя стоимость: <Info>{formatCurrency(stats?.regularAverageCostB19)}</Info></Div>
                    <Div>Оплата франчайзеру: <Info>{formatCurrency(stats?.regularB19Expense)}</Info></Div>
                    <Div>Прибыль франчайзи: <Info>{formatCurrency(stats?.regularB19Revenue)}</Info></Div>
                    <Div>Общая сумма: <Info>{formatCurrency(stats?.regularB19Amount)}</Info></Div>
                    <Div />
                    <Div>Бутыли 12.5л: <Info>{stats?.totalRegularB12Bottles}</Info></Div>
                    <Div>Средняя стоимость: <Info>{formatCurrency(stats?.regularAverageCostB12)}</Info></Div>
                    <Div>Оплата франчайзеру: <Info>{formatCurrency(stats?.regularB12Expense)}</Info></Div>
                    <Div>Прибыль франчайзи: <Info>{formatCurrency(stats?.regularB12Revenue)}</Info></Div>
                    <Div>Общая сумма: <Info>{formatCurrency(stats?.regularB12Amount)}</Info></Div>
                    <Div />
                    <Div>Общая прибыль от заказов:</Div>
                    <Div>---------------------</Div>
                    <Li>Общая прибыль по дополнительным заказам: <Info>{formatCurrency(stats?.additionalB12Revenue + stats?.additionalB19Revenue)}</Info></Li>
                    <Li>Общая прибыль по собственным заказам: <Info>{formatCurrency(stats?.regularB12Revenue + stats?.regularB19Revenue)}</Info></Li>
                    <Li>Общая прибыль: <Info>{formatCurrency(stats?.regularB12Revenue + stats?.regularB19Revenue + stats?.additionalB12Revenue + stats?.additionalB19Revenue)}</Info></Li>
                    <Div />
                    <Div>Общая сумма от заказов:</Div>
                    <Div>---------------------</Div>
                    <Li>Общая сумма по дополнительным заказам: <Info>{formatCurrency(stats?.additionalB12Amount + stats?.additionalB19Amount)}</Info></Li>
                    <Li>Общая сумма по собственным заказам: <Info>{formatCurrency(stats?.regularB12Amount + stats?.regularB19Amount)}</Info></Li>
                    <Li>Общая сумма: <Info>{formatCurrency(stats?.regularB12Amount + stats?.regularB19Amount + stats?.additionalB12Amount + stats?.additionalB19Amount)}</Info></Li>
                    <Div />
                    <Div>Действия:</Div>
                    <Div>---------------------</Div>
                    <Div></Div>
                    <Div />
                </>
                )
            }
            
        </Container>
    )
}