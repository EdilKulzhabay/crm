import { useEffect, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import useFetchUserData from "../customHooks/useFetchUserData";
import api from "../api";
import Info from "../Components/Info";
import Li from "../Components/Li";
import DataInput from "../Components/DataInput";
import MyButton from "../Components/MyButton";
import LinkButton from "../Components/LinkButton";
import MySnackBar from "../Components/MySnackBar";
import MyInput from "../Components/MyInput";
import DownIcon from "../icons/DownIcon";
import UpIcon from "../icons/UpIcon";

export default function SAAnalytics() {
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
    const [temporaryStats, setTemporaryStats] = useState(null)
    const [search, setSearch] = useState("")
    const [chooseFr, setChooseFr] = useState(null)

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setStats([...temporaryStats])
        }
    };

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

    const getFranchiseeAnalytics = () => {
        if (dates.startDate.length !== 10 || dates.endDate.length !== 10) {
            setOpen(true)
            setStatus("error")
            setMessage("Введите даты в формате ГГГГ-ММ-ДД")
            return
        }
        const id = userData?._id
        api.post("/getFranchiseeAnalytics", {id, ...dates}, {
            headers: {"Content-Type": "application/json"}
        }).then(({data}) => {
            setStats(data.stats)
            setTemporaryStats(data.stats)
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        if (userData?._id) {
            getFranchiseeAnalytics()
        }
    }, [userData])

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null || amount === 0) {
            return "0 тенге"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} тенге`;
    };

    const formatCurrencyTG = (amount) => {
        if (amount === undefined || amount === null || amount === 0) {
            return "0 ₸"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
    };

    const saldo = (stat) => {
        let sum = 0
        let owe = stat.owe
        if (stat.tookAwayB12 > stat.totalAddtitionalB12Bottles) {
            owe += (stat.tookAwayB12 - stat.totalAddtitionalB12Bottles) * 170
        }
        if (stat.tookAwayB19 > stat.totalAddtitionalB19Bottles) {
            owe += (stat.tookAwayB19 - stat.totalAddtitionalB19Bottles) * 250
        }
        sum += stat.haveTo - owe - stat.fakt
        if (sum < 0) {
            return (<p>Франчайзи должен вам: <Info>{formatCurrency(-sum)}</Info></p>)
        } else {
            return (<p>Вы должны франчайзи: <Info>{formatCurrency(sum)}</Info></p>)
        }
    }

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
                                <MyButton click={getFranchiseeAnalytics}>
                                    <span className="text-green-400">
                                        Применить
                                    </span>
                                </MyButton>
                            </div>
                        </Li>
                    </>
                    <Div />
                    <Div>
                        Поиск по франчайзи:
                    </Div>
                    <Div>
                        <div className="flex items-center flex-wrap gap-x-4">
                            <MyInput
                                value={search}
                                change={handleSearch}
                                color="white"
                            />
                            <MyButton click={() => {
                                const searchStats = stats.filter((item) => item.fullName.toLowerCase().includes(search.toLowerCase()))
                                
                                setStats(searchStats)
                            }}>Найти</MyButton>
                        </div>
                    </Div>
                    <Div />
                    <Div>---------------------</Div>
                    {stats && stats.length > 0 && stats.map((item) => {
                        return (<div key={item._id}>
                            {chooseFr === item._id ? 
                            <>
                                <Div>{item.fullName}</Div>
                                <Div>Переданные. заказы</Div>
                                <Div>
                                    <div>18,9 л: </div>
                                    <Info ml="ml-1">{item.totalAddtitionalB19Bottles} б.</Info> * 
                                    <Info ml="ml-1">400 ₸</Info> = 
                                    <Info ml="ml-1">{formatCurrencyTG(item.totalAddtitionalB19Bottles * 400)}</Info>
                                </Div>
                                <Div>
                                    <div>12,5 л: </div>
                                    <Info ml="ml-1">{item.totalAddtitionalB12Bottles} б.</Info> * 
                                    <Info ml="ml-1">270 ₸</Info> = 
                                    <Info ml="ml-1">{formatCurrencyTG(item.totalAddtitionalB12Bottles * 270)}</Info>
                                </Div>
                                <Div />
                                <Div>Доп. заказы</Div>
                                <Div>
                                    <div>18,9 л: </div>
                                    <Info ml="ml-1">{item.totalRegularB19Bottles} б.</Info> * 
                                    <Info ml="ml-1">250 ₸</Info> = 
                                    <Info ml="ml-1">{formatCurrencyTG(item.totalRegularB19Bottles * 250)}</Info>
                                </Div>
                                <Div>
                                    <div>12,5 л: </div>
                                    <Info ml="ml-1">{item.totalRegularB12Bottles} б.</Info> * 
                                    <Info ml="ml-1">170 ₸</Info> = 
                                    <Info ml="ml-1">{formatCurrencyTG(item.totalRegularB12Bottles * 170)}</Info>
                                </Div>
                                <Div />
                                <Div>Кол отпущенных:</Div>
                                <Li>
                                    12: <Info ml="ml-1">{item.tookAwayB12}</Info>
                                    <p>*</p>
                                    <Info ml="ml-1">170 ₸</Info>
                                    <p>=</p>
                                    <Info ml="ml-1">{formatCurrencyTG(item.tookAwayB12 * 170)}</Info>
                                </Li>
                                <Li>
                                    19: <Info ml="ml-1">{item.tookAwayB19}</Info>
                                    <p>*</p>
                                    <Info ml="ml-1">250 ₸</Info>
                                    <p>=</p>
                                    <Info ml="ml-1">{formatCurrencyTG(item.tookAwayB19 * 250)}</Info>
                                </Li>
                                <Div />
                                <Div>Задолженность:</Div>
                                <Li>
                                    Sum: <Info>{formatCurrency(item.haveTo)}</Info>
                                </Li>
                                <Li>
                                    Fakt: <Info>{formatCurrency(item.fakt)}</Info>
                                </Li>
                                <Li>
                                    Owe: <Info>{formatCurrency(item.owe)}</Info>
                                </Li>
                                <Li>
                                    {saldo(item)}
                                </Li>
                                <Div>
                                    <button
                                    onClick={() => {setChooseFr(null)}}
                                    className="text-green-400 hover:text-blue-500 flex items-center gap-x-0.5">
                                        <p>[</p>
                                        <p>Свернуть</p>
                                        <UpIcon className="w-5 h-5"/> 
                                        <p>]</p>
                                    </button>
                                </Div>
                            </> : 
                            <>
                                <Div>{item.fullName}</Div>
                                <Li>
                                    {saldo(item)}
                                </Li>
                                {/* <Div>
                                    <div>18,9 л: </div>
                                    <Info>{item.totalRegularB19Bottles + item.totalAddtitionalB19Bottles} бут.</Info>
                                    <Info>{formatCurrency(item.totalRgularSumB19 + item.totalAdditionalSumB19)}</Info>
                                </Div>
                                <Div>
                                    <div>12,5 л: </div>
                                    <Info>{item.totalRegularB12Bottles + item.totalAddtitionalB12Bottles} бут.</Info>
                                    <Info>{formatCurrency(item.totalRgularSumB12 + item.totalAdditionalSumB12)}</Info>
                                </Div> */}
                                <Div>
                                    <button
                                    onClick={() => {setChooseFr(item._id)}}
                                    className="text-green-400 hover:text-blue-500 flex items-center gap-x-0.5">
                                        <p>[</p>
                                        <p>Подробнее</p>
                                        <DownIcon className="w-5 h-5"/> 
                                        <p>]</p>
                                    </button>
                                </Div>
                            </>}
                            
                            <Div>---------------------</Div>
                        </div>)
                    })}
                    <Div>
                        <LinkButton href="/charts">Графики</LinkButton>
                    </Div>
                    <Div />
                </>
                )
            }
            <MySnackBar
                open={open}
                text={message}
                status={status}
                close={closeSnack}
            />
        </Container>
    )
}