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
import MySnackBar from "../Components/MySnackBar";

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
    const [saldoData, setSaldoData] = useState({
        haveTo: 0,
        fakt: 0,
        owe: 0,
        tookAwayB12: 0,
        tookAwayB19: 0,
        totalRegularB12Bottles: 0,
        totalRegularB19Bottles: 0,
        totalAddtitionalB12Bottles: 0,
        totalAddtitionalB19Bottles: 0
    })

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };
    
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
        if (dates.startDate.length !== 10 || dates.endDate.length !== 10) {
            setOpen(true)
            setStatus("error")
            setMessage("Введите даты в формате ГГГГ-ММ-ДД")
            return
        }
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
        if (dates.startDate.length !== 10 || dates.endDate.length !== 10) {
            setOpen(true)
            setStatus("error")
            setMessage("Введите даты в формате ГГГГ-ММ-ДД")
            return
        }
        const id = userData?._id
        api.post("/getAdditionalRevenue", {id, ...dates}, {
            headers: {"Content-Type": "application/json"}
        }).then(({data}) => {
            if (data.success) {
                setSaldoData({
                    haveTo: data.stats.haveTo,
                    fakt: data.stats.fakt,
                    owe: data.stats.owe,
                    totalAddtitionalB12Bottles: data.stats.totalAddtitionalB12Bottles,
                    totalAddtitionalB19Bottles: data.stats.totalAddtitionalB19Bottles,
                    totalRegularB12Bottles: data.stats.totalRegularB12Bottles,
                    totalRegularB19Bottles: data.stats.totalRegularB19Bottles,
                    tookAwayB12: data.bottles.totalTookAwayB121,
                    tookAwayB19: data.bottles.totalTookAwayB191 + data.bottles.totalTookAwayB197
                })
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

    const saldo = () => {
        let sum = 0
        // if (saldoData?.tookAwayB12 > saldoData?.totalAddtitionalB12Bottles + saldoData?.totalRegularB12Bottles) {
        //     sum += (saldoData?.tookAwayB12 - (saldoData?.totalAddtitionalB12Bottles + saldoData?.totalRegularB12Bottles)) * 170
        // }
        // if (saldoData?.tookAwayB19 > saldoData?.totalAddtitionalB19Bottles + saldoData?.totalRegularB19Bottles) {
        //     sum += (saldoData?.tookAwayB19 - (saldoData?.totalAddtitionalB19Bottles + saldoData?.totalRegularB19Bottles)) * 250
        // }
        sum += saldoData?.haveTo - saldoData?.owe - saldoData?.fakt
        if (sum > 0) {
            return (<p>Вы должны франчайзеру: <Info>{formatCurrency(sum)}</Info></p>)
        } else {
            return (<p>Франчайзер должен вам: <Info>{formatCurrency(-sum)}</Info></p>)
        }
    }

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
                                    <div className={`bg-red h-5`} style={{width: `${((totalOrders * 100) / (totalOrders + additionalTotal)).toFixed(0)}%`}}></div>
                                </div>
                                <div className="text-red">]</div>
                            </div>
                            <div>{((totalOrders * 100) / (totalOrders + additionalTotal)).toFixed(0)}%</div>
                        </Div>
                        <Div >
                            <div className="w-[100px] lg:w-[200px]">Доп. заказы:</div>
                            <div className="flex items-center gap-x-2">
                                <div className="text-red">[</div>
                                <div className="w-[80px]">
                                    <div className={`bg-red h-5`} style={{width: `${((additionalTotal * 100) / (totalOrders + additionalTotal)).toFixed(0)}%`}}></div>
                                </div>
                                <div className="text-red">]</div>
                            </div>
                            <div>{((additionalTotal * 100) / (totalOrders + additionalTotal)).toFixed(0)}%</div>
                        </Div>
                    <Div>---------------------</Div>
                    <Div />
                    <Div>---------------------</Div>
                        <Div>
                            Сальдо: {saldo()}
                        </Div>
                    <Div>---------------------</Div>
                    <Div />
                </>)
        }
        <MySnackBar
            open={open}
            text={message}
            status={status}
            close={closeSnack}
        />
    </Container>
}