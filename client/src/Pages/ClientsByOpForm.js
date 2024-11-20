import { useEffect, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import useFetchUserData from "../customHooks/useFetchUserData";
import api from "../api";
import DataInput from "../Components/DataInput";
import MyButton from "../Components/MyButton";
import Li from "../Components/Li";
import { useParams } from "react-router-dom";
import Info from "../Components/Info";
import LinkButton from "../Components/LinkButton";

export default function ClientsByOpForm() {
    const userData = useFetchUserData()
    const { opForm, startDate, endDate } = useParams();
    // const getCurrentDate = () => {
    //     const today = new Date();
    //     const year = today.getFullYear();
    //     const month = String(today.getMonth() + 1).padStart(2, '0');
    //     const day = String(today.getDate()).padStart(2, '0');
    //     return `${year}-${month}-${day}`;
    // };

    // const getStartOfMonth = () => {
    //     const today = new Date();
    //     const year = today.getFullYear();
    //     const month = String(today.getMonth() + 1).padStart(2, '0');
    //     return `${year}-${month}-01`;
    // };

    const [dates, setDates] = useState({
        startDate: startDate, // Начало месяца
        endDate: endDate     // Сегодняшняя дата
    });
    const [stats, setStats] = useState(null)
    const [totalOrdersSum, setTotalOrdersSum] = useState(0)

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

    const getClientsByOpForm = () => {
        const id = userData?._id
        api.post("/getClientsByOpForm", {id, ...dates, opForm}, {
            headers: {"Content-Type": "application/json"}
        }).then(({data}) => {
            setStats(data.stats)
            setTotalOrdersSum(data.totalOrdersSum)
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        if (userData?._id) {
            getClientsByOpForm()
        }
    }, [userData])

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) {
            return "0 тенге"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
    };

    return <Container role={userData?.role}>
        {stats === null ? <Div>Загрузка данных...</Div> : (
                <>
                    <Div>Графики по форме оплаты</Div>
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
                                <MyButton click={getClientsByOpForm}>
                                    <span className="text-green-400">
                                        Применить
                                    </span>
                                </MyButton>
                            </div>
                        </Li>
                    </>
                    <Div />
                    <Div>---------------------</Div>
                    <Div>
                        <div className="w-[130px] lg:w-[250px]">Имя клиента</div>
                        <div>|</div>
                        <div className="w-[65px]">Бутыли</div>
                        <div>|</div>
                        <div>Сумма</div>
                    </Div>
                    <Div>---------------------</Div>
                    {stats.length > 0 && stats.map((item) => {
                        return <Div key={item.clientId}>
                            <div className="w-[130px] lg:w-[250px]"><LinkButton href={`/ClientPage/${item.clientId}`}>{item.clientFullName} {item.clientFullName === "" && item.clientUserName}</LinkButton></div>
                            <div>|</div>
                            <div className="w-[65px]"><Info>{item.totalB12 + item.totalB19}</Info></div>
                            <div>|</div>
                            <div><Info>{formatCurrency(item.totalSum)}</Info></div>
                        </Div>
                    })}
                    <Div>---------------------</Div>
                    <Div>Общая сумма по клиентам: <Info>{formatCurrency(totalOrdersSum)} тенге</Info></Div>
                    <Div />
                </>)
        }
    </Container>
}