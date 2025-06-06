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
import getPreviousMonthRange from "../utils/getPreviousMonthRange";

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

    const [generalData, setGeneralData] = useState({
        totalB12: 0,
        totalB19: 0,
        totalSum: 0,
        totalRegularB12: 0,
        totalRegularB19: 0,
        totalRegularSum: 0,
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
        if (dates.startDate.includes("2024") || dates.endDate.includes("2024")) {
            setOpen(true)
            setStatus("error")
            setMessage("Прошлый год не доступен")
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
        if (dates.startDate.includes("2024") || dates.endDate.includes("2024")) {
            setOpen(true)
            setStatus("error")
            setMessage("Прошлый год не доступен")
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

    const getSAGeneralInfo = () => {
        if (dates.startDate.length !== 10 || dates.endDate.length !== 10) {
            setOpen(true)
            setStatus("error")
            setMessage("Введите даты в формате ГГГГ-ММ-ДД")
            return
        }
        if (dates.startDate.includes("2024") || dates.endDate.includes("2024")) {
            setOpen(true)
            setStatus("error")
            setMessage("Прошлый год не доступен")
            return
        }
        api.post("/getSAGeneralInfo", { ...dates }, {
            headers: {"Content-Type": "application/json"}
        }).then(({data}) => {
            setGeneralData({
                totalB12: data.stats.totalB12,
                totalB19: data.stats.totalB19,
                totalSum: data.stats.totalSum,
                totalRegularB12: data.stats.totalRegularB12,
                totalRegularB19: data.stats.totalRegularB19,
                totalRegularSum: data.stats.totalRegularSum,
            })
        })
    }

    useEffect(() => {
        if (userData?._id) {
            getChartByOp()
            getAdditionalRevenue()
            if (userData?.role === "superAdmin") {
                getSAGeneralInfo()
            }
        }
    }, [userData])

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) {
            return "0"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
    };

    const oweEqual = () => {
        let owe = saldoData?.owe
        if (saldoData?.tookAwayB12 > saldoData?.totalAddtitionalB12Bottles) {
            owe += (saldoData?.tookAwayB12 - saldoData?.totalAddtitionalB12Bottles) * 220
        }
        if (saldoData?.tookAwayB19 > saldoData?.totalAddtitionalB19Bottles) {
            owe += (saldoData?.tookAwayB19 - saldoData?.totalAddtitionalB19Bottles) * 300
        }
        return formatCurrency(owe)
    }

    const saldo = () => {
        let sum = 0
        let owe = saldoData?.owe
        if (saldoData?.tookAwayB12 > saldoData?.totalAddtitionalB12Bottles) {
            owe += (saldoData?.tookAwayB12 - saldoData?.totalAddtitionalB12Bottles) * 220
        }
        if (saldoData?.tookAwayB19 > saldoData?.totalAddtitionalB19Bottles) {
            owe += (saldoData?.tookAwayB19 - saldoData?.totalAddtitionalB19Bottles) * 300
        }
        sum += saldoData?.haveTo - owe - saldoData?.fakt
        if (sum < 0) {
            return (<p>Вы должны франчайзеру: <Info>{formatCurrency(-sum)} тенге</Info></p>)
        } else {
            return (<p>Франчайзер должен вам: <Info>{formatCurrency(sum)} тенге</Info></p>)
        }
    }

    return <Container role={userData?.role}>
        {stats === null ? <Div>Загрузка данных...</Div> : (
            <>
                <Div>Графики по форме оплаты</Div>
                <Div />
                <Div>
                    <div>Фильтры:</div>
                    <MyButton click={() => {
                        const { start, end } = getPreviousMonthRange();
                        setDates({ startDate: start, endDate: end });
                    }}>Предыдущий месяц</MyButton>
                    <MyButton click={() => {
                        setDates({
                            startDate: getStartOfMonth(), // Начало месяца
                            endDate: getCurrentDate()
                        })
                    }}>Текущий месяц</MyButton>
                </Div>
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
                            <Link to={`/clientsByOpForm/${key}/${dates.startDate}/${dates.endDate}`} className="flex items-center gap-x-2">
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
                    {userData?.role === "admin" ? 
                        <>
                            <Div>
                                Всего отпущено бутылей (12,5): <Info>{saldoData?.tookAwayB12} шт.</Info>
                            </Div>
                            <Div>
                                Всего отпущено бутылей (18,9): <Info>{saldoData?.tookAwayB19} шт.</Info>
                            </Div>
                            <Div />
                            <Div>
                                Доставлено:
                            </Div>
                            <Li>
                                По доп заказам (12,5): <Info>{saldoData?.totalAddtitionalB12Bottles} шт.</Info>
                            </Li>
                            <Li>
                                По доп заказам (18,9): <Info>{saldoData?.totalAddtitionalB19Bottles} шт.</Info>
                            </Li>
                            <Li>
                                По собст заказам (12,5): <Info>{saldoData?.totalRegularB12Bottles} шт.</Info>
                            </Li>
                            <Li>
                                По собст заказам (18,9): <Info>{saldoData?.totalRegularB19Bottles} шт.</Info>
                            </Li>

                            <Div />
                            <Div>
                                -------------------------------
                            </Div>
                            <Div>
                                Итого сумма заказов (x): <Info>{formatCurrency(saldoData?.haveTo)} тенге</Info>
                            </Div>
                            <Div>
                                Итого оплаченных заказов (y): <Info>{formatCurrency(saldoData?.fakt)} тенге</Info>
                            </Div>
                            <Div>
                                Итого к оплате за вывоз (z): <Info>{oweEqual(saldoData?.owe)} тенге</Info>
                            </Div>
                            <Div>
                                Сальдо (Формула: x-y-z): {saldo()}
                            </Div>
                        </>
                        :
                        <>
                            <Div>
                                Gross: 18,9 л. <Info ml="ml-0">{formatCurrency(generalData?.totalB19)} бт.</Info>{" "}
                                12,5 л. <Info ml="ml-0">{formatCurrency(generalData?.totalB12)} бт.</Info> {" "}
                                <Info ml="ml-0">{formatCurrency(generalData?.totalSum)} тенге</Info>
                            </Div>
                            <Div>
                                Net: 18,9 л. <Info ml="ml-0">{formatCurrency(generalData?.totalRegularB19)} бт.</Info>{" "}
                                12,5 л. <Info ml="ml-0">{formatCurrency(generalData?.totalRegularB12)} бт.</Info> {" "}
                                <Info ml="ml-0">{formatCurrency(generalData?.totalRegularSum)} тенге</Info>
                            </Div>
                        </>
                    }
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