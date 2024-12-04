import { useCallback, useEffect, useRef, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import useFetchUserData from "../customHooks/useFetchUserData";
import api from "../api";
import Li from "../Components/Li";
import LinkButton from "../Components/LinkButton";
import Info from "../Components/Info";
import MySnackBar from "../Components/MySnackBar";
import DataInput from "../Components/DataInput";
import MyButton from "../Components/MyButton";
import moment from "moment-timezone";
import clsx from "clsx";

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function PickupInfo() {
    const userData = useFetchUserData()

    const [info, setInfo] = useState(null)
    const [pickups, setPickups] = useState([])
    const [dates, setDates] = useState({
        startDate: getCurrentDate(),
        endDate: getCurrentDate(),
    });
    const [opForm, setOpForm] = useState("all")
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const closeSnack = () => {
        setOpen(false);
    };

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

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
        setPickups([])
        setPage(1);
        setHasMore(true);
        setLoading(false)
        loadMorePickups(page, dates, opForm)
    }

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null || amount === 0) {
            return "0 тенге"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} тенге`;
    };

    const loadMorePickups = useCallback(async (page, dates, opForm) => {
        if (loading || !hasMore) return;

        setLoading(true);
        
        api.post(
            "/getPickupInfo",
            {
                page, ...dates, opForm
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setInfo(data.stats)
                if (data.pickups.length === 0) {
                    setHasMore(false);
                } else {
                    setPickups((prevPickups) => [...prevPickups, ...data.pickups]);
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
            loadMorePickups(page, dates, opForm);
        }
    }, [hasMore]);


    const observer = useRef();
    const lastPickupElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMorePickups(page, dates, opForm);
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMorePickups]
    );

    return <Container role={userData?.role}>
        <Div>Самовывозы</Div>
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
                    <MyButton click={handleDate}>
                        <span className="text-green-400">
                            Применить
                        </span>
                    </MyButton>
                </div>
            </Li>
        </>
        <Div/>
        <Div>Итоговая информация:</Div>
        <>
            <Li>
                <div className="flex items-center gap-x-3">
                    <div className="w-[150px] lg:w-[200px]">Всего самовывозов: </div>
                    <div>
                        <Info>{pickups?.length || 0} шт.</Info>
                    </div>
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-3">
                    <div className="w-[150px] lg:w-[200px]">Отпущено бутылей: </div>
                    <div>
                        <Info>{info?.totalB12 + info?.totalB19 || 0} шт.</Info>
                    </div>
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-3">
                    <div className="w-[150px] lg:w-[200px]">Кол 12,5: </div>
                    <div>
                        <Info>{info?.totalB12 || 0} шт.</Info>
                    </div>
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-3">
                    <div className="w-[150px] lg:w-[200px]">Кол 18,9: </div>
                    <div>
                        <Info>{info?.totalB19 || 0} шт.</Info>
                    </div>
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-3">
                    <button 
                        onClick={() => {
                            const newOpForm = opForm === "nal" ? "all" : "nal"
                            setOpForm(newOpForm)
                            setPickups([]);
                            setPage(1);
                            setHasMore(true);
                            setLoading(false)
                            loadMorePickups(1, dates, newOpForm)
                        }}
                        className={clsx("lg:hover:text-blue-500 w-[150px] lg:w-[200px] text-left", {
                            "text-green-400": opForm !== "nall",
                            "text-yellow-300": opForm === "nal"
                        })}
                    >Наличными: </button>
                    <div>
                        <Info>{formatCurrency(info?.totalNalSum)}</Info>
                    </div>
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-3">
                    <button 
                        onClick={() => {
                            const newOpForm = opForm === "qr" ? "all" : "qr"
                            setOpForm(newOpForm)
                            setPickups([]);
                            setPage(1);
                            setHasMore(true);
                            setLoading(false)
                            loadMorePickups(1, dates, newOpForm)
                        }}
                        className={clsx("lg:hover:text-blue-500 w-[150px] lg:w-[200px] text-left", {
                            "text-green-400": opForm !== "qr",
                            "text-yellow-300": opForm === "qr"
                        })}
                    >QR: </button>
                    <div>
                        <Info>{formatCurrency(info?.totalQrSum)}</Info>
                    </div>
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-3">
                    <div className="w-[150px] lg:w-[200px]">Cумма: </div>
                    <div>
                        <Info>{formatCurrency(info?.totalSum)}</Info>
                    </div>
                </div>
            </Li>
        </>
        <Div />
        <Div>Список самовывозов:</Div> 
        <>
            {pickups && pickups.length > 0 && pickups.map((item, index) => {
                const timeInGmtPlus5 = moment(item?.createdAt).tz("Etc/GMT-5");
                const hours = timeInGmtPlus5.format("HH");
                const minutes = timeInGmtPlus5.format("mm");
                if (pickups.length === index + 1) {
                    return (
                        <div key={item?._id} ref={lastPickupElementRef}>
                            <Li>
                                <div className="flex items-center gap-x-2">
                                    <div>{index + 1}.</div>
                                    <div>Время: {hours}:{minutes}</div>
                                    <div>{item?.kol12 > 0 && <span>12,5 л: <Info>{item?.kol12} шт.</Info></span>} {item?.kol19 > 0 && <span>18,9 л: <Info>{item?.kol19} шт.</Info></span>}</div>
                                    <div>Сумма: <Info>{formatCurrency(item?.sum)}</Info> {item?.opForm === "nal" ? "Нал." : "QR"}</div>
                                </div>
                            </Li>
                        </div>
                    )
                } else {
                    return (
                        <div key={item?._id}>
                            <Li>
                                <div className="flex items-center gap-x-2">
                                    <div>{index + 1}.</div>
                                    <div>Время: {hours}:{minutes}</div>
                                    <div>{item?.kol12 > 0 && <span>12,5 л: <Info>{item?.kol12} шт.</Info></span>} {item?.kol19 > 0 && <span>18,9 л: <Info>{item?.kol19} шт.</Info></span>}</div>
                                    <div>Сумма: <Info>{formatCurrency(item?.sum)}</Info> {item?.opForm === "nal" ? "Нал." : "QR"}</div>
                                </div>
                            </Li>
                        </div>
                    )
                }
            })}
        </>
        
        <Div/>
        <MySnackBar
            open={open}
            text={message}
            status={status}
            close={closeSnack}
        />
    </Container>
}