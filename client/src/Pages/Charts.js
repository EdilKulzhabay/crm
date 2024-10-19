import { useEffect, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import useFetchUserData from "../customHooks/useFetchUserData";
import api from "../api";
import DataInput from "../Components/DataInput";
import MyButton from "../Components/MyButton";
import Li from "../Components/Li";
import { Link } from "react-router-dom";
import Info from "../Components/Info";

export default function Charts() {
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
    const [stats, setStats] = useState({
        fakt: {
            count: 0,
            percentage: 0
        },
        coupon: {
            count: 0,
            percentage: 0
        },
        postpay: {
            count: 0,
            percentage: 0
        },
        credit: {
            count: 0,
            percentage: 0
        },
        mixed: {
            count: 0,
            percentage: 0
        },
    })
    const [totalOrders, setTotalOrders] = useState(0)
    const [additionalTotal, setAdditionalTotal] = useState(0)
    const [totalRevenue, setTotalRevenue] = useState(0)
    const [totalFaktRevenue, setTotalFaktRevenue] = useState(0)
    
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

    const getChartByOp = () => {
        const id = userData?._id
        api.post("/getChartByOp", {id, ...dates}, {
            headers: {"Content-Type": "application/json"}
        }).then(({data}) => {
            if (data.success) {
                setTotalOrders(data.totalOrders)
                setAdditionalTotal(data.additionalTotal)
                data.stats.length > 0 && data.stats.forEach((item) => {
                    setStats(prevStats => ({
                        ...prevStats,
                        [item.opForm]: {count: item.count, percentage: item.percentage}
                    }));
                })
            } else {
                setAdditionalTotal(data.additionalTotal)
            }
        }).catch((e) => {
            console.log(e);
        })
    }

    const getAdditionalRevenue = () => {
        const id = userData?._id
        api.post("/getAdditionalRevenue", {id, ...dates}, {
            headers: {"Content-Type": "application/json"}
        }).then(({data}) => {
            console.log(data);
            
            if (data.success) {
                setTotalRevenue(data.stats.totalRevenue)
                setTotalFaktRevenue(data.stats.totalFaktRevenue)
            }
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        if (userData?._id) {
            getChartByOp()
            getAdditionalRevenue()
        }
    }, [userData])

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) {
            return "0 тенге"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} тенге`;
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
                                <MyButton click={() => {
                                    getChartByOp()
                                    getAdditionalRevenue()
                                }}>
                                    <span className="text-green-400">
                                        Применить
                                    </span>
                                </MyButton>
                            </div>
                        </Li>
                    </>
                    <Div />
                    <Div>---------------------</Div>
                    {Object.keys(stats).map((key) => (
                        <div key={key}>
                            <Div >
                                <div className="w-[110px] lg:w-[200px]">{key === "fakt" ? "Нал_Карта_QR" : key === "coupon" ? "Талоны" : key === "postpay" ? "Постоплата" : key === "credit" ? "В долг" : "Смешанная"}:</div>
                                <Link to={`/clientsByOpForm/${key}`} className="flex items-center gap-x-2">
                                    <div className="text-red">[</div>
                                    <div className="w-[80px]">
                                        <div className={`bg-red h-5`} style={{width: `${stats[key].percentage}%`}}></div>
                                    </div>
                                    <div className="text-red">]</div>
                                </Link>
                                <div>{stats[key].percentage}%</div>
                            </Div>
                            <div className="h-2" />
                        </div>
                    ))}
                    <Div>---------------------</Div>
                    <Div />
                    <Div>---------------------</Div>
                        <Div >
                            <div className="w-[100px] lg:w-[200px]">Соб. заказы:</div>
                            <div className="flex items-center gap-x-2">
                                <div className="text-red">[</div>
                                <div className="w-[80px]">
                                    <div className={`bg-red h-5`} style={{width: `${((totalOrders * 100) / (totalOrders + additionalTotal)).toFixed(2)}%`}}></div>
                                </div>
                                <div className="text-red">]</div>
                            </div>
                            <div>{((totalOrders * 100) / (totalOrders + additionalTotal)).toFixed(2)}%</div>
                        </Div>
                        <Div >
                            <div className="w-[100px] lg:w-[200px]">Доп. заказы:</div>
                            <div className="flex items-center gap-x-2">
                                <div className="text-red">[</div>
                                <div className="w-[80px]">
                                    <div className={`bg-red h-5`} style={{width: `${((additionalTotal * 100) / (totalOrders + additionalTotal)).toFixed(2)}%`}}></div>
                                </div>
                                <div className="text-red">]</div>
                            </div>
                            <div>{((additionalTotal * 100) / (totalOrders + additionalTotal)).toFixed(2)}%</div>
                        </Div>
                    <Div>---------------------</Div>
                    <Div />
                    <Div>---------------------</Div>
                        <Div>
                            Общая прибль от доп. заказов: <Info>{formatCurrency(totalRevenue)}</Info>
                        </Div>
                        <Div>
                            Общая прибль от доп. заказов по нал.: <Info>{formatCurrency(totalFaktRevenue)}</Info>
                        </Div>
                    <Div>---------------------</Div>
                    <Div />
                </>)
        }
    </Container>
}