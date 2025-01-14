import { useState, useEffect, useCallback, useRef } from "react";
import Li from "./Li";
import LinkButton from "./LinkButton";
import api from "../api";
import OrderInfo from "./OrderInfo";
import DataInput from "./DataInput";
import MyButton from "./MyButton";
import Div from "./Div";
import MySnackBar from "./MySnackBar";
import Info from "./Info"
import clsx from "clsx";
import StarIcon from "../icons/StarIcon";

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const tags = [
    "Поздняя доставка",
    "Без звонка",
    "Без формы",
    "Грубое общение",
    "Повреждена упаковка",
    "Курьер не помог установить",
    "Проблемы с оплатой",
    "Грубое общение",
    "Чистая упаковка",
    "Ошибка оплаты",
    "Быстрая доставка",
    "Чистая упаковка",
    "Дружелюбный курьер",
    "Фирменная форма",
    "Удобное время",
    "Пунктуальная доставка",
]

export default function CourierDeliveredOrders(props) {
    const id = props.id
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [userData, setUserData] = useState({})
    const [deliveredOrders, setDeliveredOrders] = useState([])
    const [tagCounts, setTagCounts] = useState([])
    const [clientNote, setClientNote] = useState("")

    const [dates, setDates] = useState({
        startDate: getCurrentDate(),
        endDate: getCurrentDate(),
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

    const handleDate = () => {
        if (dates.startDate.length !== 10 || dates.endDate.length !== 10) {
            setOpen(true)
            setStatus("error")
            setMessage("Введите даты в формате ГГГГ-ММ-ДД")
            return
        }
        
        setDeliveredOrders([]);
        setPage(1);
        setHasMore(true);
        setLoading(false)
        loadMoreDeliveredOrders(1, dates, clientNote)
        getDeliveredOrdersCourierTagCounts(dates)
    }

    const getMe = () => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setUserData(data)
            })
            .catch((e) => {
                console.log(e);
            });
    }

    const getDeliveredOrdersCourierTagCounts = async(dates) => {
        api.post(
            "/getDeliveredOrdersCourierTagCounts",
            {
                id,
                ...dates
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setTagCounts(data.tagCounts)
            })
            .catch((e) => {
                console.log(e);
            });
    }

    useEffect(() => {
        getMe()
        getDeliveredOrdersCourierTagCounts(dates)
    }, [id]);

    const loadMoreDeliveredOrders = useCallback(async (page, dates, clientNote) => {
        if (loading || !hasMore) return;

        setLoading(true);
        
        api.post(
            "/getDeliveredOrdersCourier",
            {
                id,
                page,
                ...dates,
                clientNote
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.deliveredOrders.length === 0) {
                    setHasMore(false);
                } else {
                    if (page === 1) {
                        setDeliveredOrders([...data.deliveredOrders])
                    } else {
                        setDeliveredOrders((prevDeliveredOrders) => [...prevDeliveredOrders, ...data.deliveredOrders]);
                    }
                    setPage(page + 1);
                }
            })
            .catch((e) => {
                console.log(e);
            });
        setLoading(false);
    }, [page, hasMore]);


    useEffect(() => {
        console.log("useEffect triggered with hasMore:", hasMore);
        if (hasMore) {
            loadMoreDeliveredOrders(page, dates, clientNote);
        }
    }, [hasMore]);


    const observer = useRef();
    const lastDeliveredOrderElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreDeliveredOrders(page, dates, clientNote);
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreDeliveredOrders]
    );

    return <>
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
                <MyButton click={handleDate}>
                    <span className="text-green-400">
                        Применить
                    </span>
                </MyButton>
            </div>
        </Li>
        <Div />
        {tags.map((item) => {
            const selectTag = tagCounts.find((item) => item._id === item)

            return <div key={item}>
                <Div>
                    <button
                        onClick={() => {
                            setClientNote(item); 
                            setPage(1)
                            loadMoreDeliveredOrders(1, dates, item)}
                        }
                        className={clsx("", {
                            "text-yellow-300": item === clientNote,
                            "text-green-400": item !== clientNote
                        })}
                    >
                       [ {item} ]
                    </button>
                    <Info>{selectTag ? selectTag.count : 0}</Info>
                </Div>
            </div>
        })}
        <Div />
        <div className="max-h-[250px] overflow-scroll">
            {deliveredOrders.map((item, index) => {
                if (deliveredOrders.length === index + 1) {
                    return (
                        <div key={item?._id} ref={lastDeliveredOrderElementRef}>
                            <Li>
                                <div className="flex items-center gap-x-3 flex-wrap">
                                    <div>
                                        Заказ: 
                                    </div>
                                    <div>{item?.client?.fullName}</div>
                                    <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                    <div>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                    <div>
                                        {(item?.products?.b12 !== 0 && item?.products?.b12 !== null) && <>12.5л: <OrderInfo>{item?.products?.b12}</OrderInfo> {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.client?.price12}тг)</span>};</>}
                                        {(item?.products?.b19 !== 0 && item?.products?.b19 !== null) && <>{" "}18.9л: <OrderInfo>{item?.products?.b19}</OrderInfo> {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.client?.price19}тг)</span>};</>}
                                    </div>
                                    {item?.clientReview > 0 && 
                                        <div className="flex items-center gap-x-2">
                                            <div><StarIcon className="w-5 h-5 text-white" /> </div>
                                            <div>{item?.clientReview}</div>
                                        </div>
                                    }
                                    <LinkButton
                                        href={`/orderPage/${item?._id}`}
                                    >
                                        Просмотр
                                    </LinkButton>
                                </div>
                            </Li>
                        </div>
                    );
                } else {
                    return (
                        <div key={item?._id}>
                            <Li>
                                <div className="flex items-center gap-x-3 flex-wrap">
                                    <div>
                                        Заказ: 
                                    </div>
                                    <div>{item?.client?.fullName}</div>
                                    <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                    <div>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                    <div>
                                        {(item?.products?.b12 !== 0 && item?.products?.b12 !== null) && <>12.5л: <OrderInfo>{item?.products?.b12}</OrderInfo> {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.client?.price12}тг)</span>};</>}
                                        {(item?.products?.b19 !== 0 && item?.products?.b19 !== null) && <>{" "}18.9л: <OrderInfo>{item?.products?.b19}</OrderInfo> {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.client?.price19}тг)</span>};</>}
                                    </div>
                                    {item?.clientReview > 0 && 
                                        <div className="flex items-center gap-x-2">
                                            <div><StarIcon className="w-5 h-5 text-white" /> </div>
                                            <div>{item?.clientReview}</div>
                                        </div>
                                    }
                                    <LinkButton
                                        href={`/orderPage/${item?._id}`}
                                    >
                                        Просмотр
                                    </LinkButton>
                                </div>
                            </Li>
                        </div>
                    );
                }
            })}
            {loading && <div>Загрузка...</div>}
        </div>
        <MySnackBar
            open={open}
            text={message}
            status={status}
            close={closeSnack}
        />
    </>
    
}