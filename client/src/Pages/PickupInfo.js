import { useEffect, useState } from "react";
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
    const closeSnack = () => {
        setOpen(false);
    };

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const getPickupInfo = () => {
        api.post("/getPickupInfo", {...dates}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setInfo(data.stats)
            setPickups(data.pickups)
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        getPickupInfo()
    }, [])

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
        getPickupInfo()
    }

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null || amount === 0) {
            return "0 тенге"; // Или любое другое значение по умолчанию
        }
    
        // Преобразуем число в строку и форматируем его
        return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} тенге`;
    };

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
        <Div />
        <Div>Список самовывозов:</Div> 
        <>
            {pickups && pickups.length > 0 && pickups.map((item, index) => {
                const timeInGmtPlus5 = moment(item?.createdAt).tz("Etc/GMT-5");
                const hours = timeInGmtPlus5.format("HH");
                const minutes = timeInGmtPlus5.format("mm");
                return <Li key={item?._id}>
                    <div className="flex items-center gap-x-2">
                        <div>{index}.</div>
                        <div>Время: [{hours}:{minutes}]</div>
                        <div>{item?.kol12 > 0 && <span>12,5 л.: {item?.kol12}</span>} {item?.kol19 > 0 && <span>18,9 л.: {item?.kol19}</span>}</div>
                        <div>Сумма: {item?.sum} {item?.opForm === "nal" ? "Нал." : "QR"}</div>
                    </div>
                </Li>
            })}
        </>
        <Div/>
        <Div>Итоговая информация:</Div>
        <Li>
            <div className="flex items-center gap-x-3">
                <div>Всего самовывозов: </div>
                <div>
                    <Info>{pickups?.length || 0} шт.</Info>
                </div>
            </div>
        </Li>
        <Li>
            <div className="flex items-center gap-x-3">
                <div>Отпущено бутылей: </div>
                <div>
                    <Info>{info?.totalB12 + info?.totalB19 || 0} шт.</Info>
                </div>
            </div>
        </Li>
        <Li>
            <div className="flex items-center gap-x-3">
                <div>Оплата наличными: </div>
                <div>
                    <Info>{formatCurrency(info?.totalNalSum)}</Info>
                </div>
            </div>
        </Li>
        <Li>
            <div className="flex items-center gap-x-3">
                <div>Оплата QR: </div>
                <div>
                    <Info>{formatCurrency(info?.totalQrSum)}</Info>
                </div>
            </div>
        </Li>
        <Li>
            <div className="flex items-center gap-x-3">
                <div>Общая сумма: </div>
                <div>
                    <Info>{formatCurrency(info?.totalSum)}</Info>
                </div>
            </div>
        </Li>
        <Div/>
        <MySnackBar
            open={open}
            text={message}
            status={status}
            close={closeSnack}
        />
    </Container>
}