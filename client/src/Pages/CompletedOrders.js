import { useCallback, useEffect, useRef, useState } from "react"
import Container from "../Components/Container"
import Div from "../Components/Div"
import api from "../api"
import Li from "../Components/Li"
import LinkButton from "../Components/LinkButton"
import DataInput from "../Components/DataInput"
import MyButton from "../Components/MyButton"
import MyInput from "../Components/MyInput"
import * as XLSX from "xlsx";
import MySnackBar from "../Components/MySnackBar"
import OrderInfo from "../Components/OrderInfo"
import useFetchUserData from "../customHooks/useFetchUserData"
import clsx from "clsx"
import Info from "../Components/Info"

export default function CompletedOrders() {
    const userData = useFetchUserData();
    const [completedOrders, setCompletedOrders] = useState([])
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [info, setInfo] = useState({
        totalB12: 0,
        totalB19: 0,
        totalSum: 0,
        totalFakt: 0,
        totalCoupon: 0,
        totalPostpay: 0,
        totalCredit: 0,
        totalMixed: 0
    })
    const [opForm, setOpForm] = useState("all")
    const [sa, setSa] = useState(false)
    const [search, setSearch] = useState("");
    const [searchF, setSearchF] = useState("");
    const [searchStatus, setSearchStatus] = useState(false);
    const [dates, setDates] = useState({
        startDate: "",
        endDate: "",
    });

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

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setCompletedOrders([]);
            setPage(1);
            setHasMore(true);
            setLoading(false)
            setSearchStatus(false)
            loadMoreCompletedOrders(1, dates, "", false, searchF, opForm, sa)
        }
    };

    const handleSearchF = (e) => {
        setSearchF(e.target.value);
        if (e.target.value === "") {
            setCompletedOrders([]);
            setPage(1);
            setHasMore(true);
            setLoading(false)
            loadMoreCompletedOrders(1, dates, search, searchStatus, "", opForm, sa)
        }
    };

    const handleDate = () => {
        if (dates.startDate.length !== 10 || dates.endDate.length !== 10) {
            setOpen(true)
            setStatus("error")
            setMessage("Введите даты в формате ГГГГ-ММ-ДД")
            return
        }
        
        setCompletedOrders([])
        setPage(1)
        setLoading(false)
        setHasMore(true)
        loadMoreCompletedOrders(1, dates, search, searchStatus, searchF, opForm, sa)
    }

    const loadMoreCompletedOrders = useCallback(async (page, dates, search, searchStatus, searchF, opForm, sa) => {
        if (loading || !hasMore) return;

        setLoading(true);
        
        api.post(
            "/getCompletedOrders",
            {
                page, ...dates, search, searchStatus, searchF, opForm, sa
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setInfo({
                    totalB12: data.result.totalB12,
                    totalB19: data.result.totalB19,
                    totalSum: data.result.totalSum,
                    totalFakt: data.result.totalFakt,
                    totalCoupon: data.result.totalCoupon,
                    totalPostpay: data.result.totalPostpay,
                    totalCredit: data.result.totalCredit,
                    totalMixed: data.result.totalMixed
                })
                if (data.orders.length === 0) {
                    setHasMore(false);
                } else {
                    setCompletedOrders((prevCompletedOrders) => [...prevCompletedOrders, ...data.orders]);
                    setPage(page + 1);
                }
            })
            .catch((e) => {
                console.log(e);
            });
        setLoading(false);
    }, [page, loading, hasMore]);

    useEffect(() => {
        if (hasMore) {
            loadMoreCompletedOrders(page, dates, search, searchStatus, searchF, opForm, sa);
        }
    }, [hasMore]);


    const observer = useRef();
    const lastOrderElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreCompletedOrders(page, dates, search, searchStatus, searchF, opForm, sa);
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreCompletedOrders]
    );

    const getOrdersForExcel = () => {
        api.post(
            "/getOrdersForExcel",
            {
                ...dates, search, searchStatus, searchF
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                const type = "orders";
                const orders = data.orders;

                const mappedData = orders.map((item) => {
                    return {
                        "Наименование": item?.client?.fullName,
                        "Имя Пользоватлея": item?.client?.userName,
                        Адрес: item?.address?.actual || "",
                        Кол19: item?.products?.b19 || "",
                        Кол12: item?.products?.b12 || "",
                        Сумма: item?.sum,
                        "Форма оплаты": item?.opForm,
                        Курьер: item?.courier?.fullName,
                        Франчайзи: item?.franchisee?.fullName,
                        Статус:
                            item?.status === "awaitingOrder"
                                ? "Ожидает заказ"
                                : item?.status === "onTheWay"
                                ? "В пути"
                                : item?.status === "delivered"
                                ? "Доставлен"
                                : "Отменен",
                        "Дата доставки": item?.date?.d,
                    };
                });

                const workbook = XLSX.utils.book_new();
                const worksheet = XLSX.utils.json_to_sheet(mappedData);
                XLSX.utils.book_append_sheet(
                    workbook,
                    worksheet,
                    type === "clients" ? "Clients" : "Orders"
                );
                const nowDate = new Date();
                const fileDate =
                    dates.startDate !== ""
                        ? `${dates.startDate} - ${dates.endDate}`
                        : `${nowDate.getFullYear()}:${
                              nowDate.getMonth() + 1
                          }:${nowDate.getDate()}`;
                const fileName = `${fileDate}.xlsx`; // Убедитесь, что функция formatDate определена и возвращает строку

                XLSX.writeFile(workbook, fileName);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) {
            return "0 тенге"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} тенге`;
    };

    return <Container role={userData?.role}>
        <Div>Завершенные заказы</Div>
        <Div />
        <Div>
            <div>Поиск заказа:</div>
        </Div>
        <Div>
            <div className="flex items-center flex-wrap gap-x-4">
                <MyInput
                    value={search}
                    change={handleSearch}
                    color="white"
                />
                <MyButton click={() => {
                    setCompletedOrders([]);
                    setPage(1);
                    setHasMore(true);
                    setSearchStatus(true)
                    setLoading(false)
                    loadMoreCompletedOrders(1, dates, search, true, searchF, opForm, sa)
                }}>Найти</MyButton>
            </div>
        </Div>

        {userData?.role === "superAdmin" && <>
            <Div />
            <Div>
                Фильтрация по франчайзи:
            </Div>
            <Div>
                <div className="flex items-center flex-wrap gap-x-4">
                    <MyInput
                        value={searchF}
                        change={handleSearchF}
                        color="white"
                    />
                    <MyButton click={() => {
                        setCompletedOrders([]);
                        setPage(1);
                        setHasMore(true);
                        setLoading(false)
                        loadMoreCompletedOrders(1, dates, search, true, searchF, opForm, sa)
                    }}>Найти</MyButton>
                    <MyButton click={() => {
                        const saStatus = !sa
                        setCompletedOrders([]);
                        setPage(1);
                        setHasMore(true);
                        setLoading(false)
                        loadMoreCompletedOrders(1, dates, search, searchStatus, searchF, opForm, saStatus)
                        setSa(saStatus)
                    }}><span className={clsx("", {"text-yellow-300": sa})}>admin</span></MyButton>
                </div>
            </Div>
        </>
        }

        <Div />
        <Div>Фильтры:</Div>
        <>
            <Li>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <div>Дата регистрации:</div>
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
                    <MyButton click={handleDate}>
                        <span className="text-green-400">
                            Применить
                        </span>
                    </MyButton>
                </div>
            </Li>
        </>
        <Div />
        <Div>
            Сводная информация:
        </Div>
        <>
            <Li>
                12,5 литровая бутыль: <span className="text-red">[ <span className="text-white">{info?.totalB12}</span> ]</span> шт.
            </Li>
            <Li>
                18,9 литровая бутыль: <span className="text-red">[ <span className="text-white">{info?.totalB19}</span> ]</span> шт.
            </Li>
            <Li>
                Сумма: <span className="text-red">[ <span className="text-white">{formatCurrency(info?.totalSum)}</span> ]</span>
            </Li>
            {["fakt", "coupon", "postpay", "credit", "mixed"].map((item) => {
                return <div key={item}>
                    <Li>
                        <button onClick={() => {
                                const newOpForm = opForm === "all" ? item : "all"
                                setOpForm(newOpForm)
                                setCompletedOrders([]);
                                setPage(1);
                                setHasMore(true);
                                setLoading(false)
                                loadMoreCompletedOrders(1, dates, search, searchStatus, searchF, newOpForm, sa)
                            }}
                            className={clsx("lg:hover:text-blue-500 w-[150px] text-left", {
                                "text-green-400": opForm !== item,
                                "text-yellow-300": opForm === item
                            })}
                        >[ {item === "fakt" ? "Нал_Карта_QR" : item === "coupon" ? "Талон" : item === "postpay" ? "Постоплата" : item === "credit" ? "В долг" : "Смешанная"} ]</button>
                        <Info>
                            {
                                item === "fakt"
                                ? info?.totalFakt
                                : item === "coupon"
                                ? info?.totalCoupon
                                : item === "postpay"
                                ? info?.totalPostpay
                                : item === "credit"
                                ? info?.totalCredit
                                : info?.totalMixed
                            }
                        </Info> 
                    </Li>
                </div>
            })}
        </>
        
        <Div />
        <div className="max-h-[380px] overflow-scroll">
            {completedOrders.map((item, index) => {
                if (completedOrders.length === index + 1) {
                    return (
                        <div key={item?._id} ref={lastOrderElementRef}>
                            <Li icon={item?.franchisee?._id === "66f15c557a27c92d447a16a0"}>
                                <div className="flex items-center gap-x-3 flex-wrap">
                                    <div>
                                        Заказ: 
                                    </div>
                                    <div>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                    <div>{item?.client?.fullName}</div>
                                    <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                    <div>
                                        {(item?.products?.b12 !== 0 && item?.products?.b12 !== null) && <span>12.5л({item?.client?.price12}): <OrderInfo>{item?.products?.b12} </OrderInfo>; {" "}</span>}
                                        {(item?.products?.b19 !== 0 && item?.products?.b19 !== null) && <span>18.9л({item?.client?.price19}): <OrderInfo>{item?.products?.b19} </OrderInfo></span>}
                                    </div>
                                    <LinkButton
                                        href={`/orderPage/${item?._id}`}
                                    >
                                        Просмотр
                                    </LinkButton>
                                    {userData?.role === "superAdmin" && <>
                                        {item?.transferred && <div>{item?.transferredFranchise}</div>}
                                        </>}
                                    <div>{item?.courier?.fullName}</div>
                                </div>
                            </Li>
                        </div>
                    );
                } else {
                    return (
                        <div key={item?._id}>
                            <Li icon={item?.franchisee?._id === "66f15c557a27c92d447a16a0"}>
                                <div className="flex items-center gap-x-3 flex-wrap">
                                    <div>
                                        Заказ: 
                                    </div>
                                    <div>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                    <div>{item?.client?.fullName}</div>
                                    <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                    <div>
                                        {(item?.products?.b12 !== 0 && item?.products?.b12 !== null) && <span>12.5л({item?.client?.price12}): <OrderInfo>{item?.products?.b12} </OrderInfo>; {" "}</span>}
                                        {(item?.products?.b19 !== 0 && item?.products?.b19 !== null) && <span>18.9л({item?.client?.price19}): <OrderInfo>{item?.products?.b19} </OrderInfo></span>}
                                    </div>
                                    <LinkButton
                                        href={`/orderPage/${item?._id}`}
                                    >
                                        Просмотр
                                    </LinkButton>
                                    {userData?.role === "superAdmin" && <>
                                        {item?.transferred && <div>{item?.transferredFranchise}</div>}
                                        </>}
                                    <div>{item?.courier?.fullName}</div>
                                </div>
                            </Li>
                        </div>
                    );
                }
            })}
        </div>

        <Div />
            <Div>Действия:</Div>
            <Div>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyButton click={getOrdersForExcel}>
                        Экспорт в excel
                    </MyButton>
                </div>
            </Div>
        <Div />
        <MySnackBar
            open={open}
            text={message}
            status={status}
            close={closeSnack}
        />
    </Container>
}