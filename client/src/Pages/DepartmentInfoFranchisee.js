import { useEffect, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import DataInput from "../Components/DataInput";
import MyButton from "../Components/MyButton";
import useFetchUserData from "../customHooks/useFetchUserData";
import api from "../api";
import Li from "../Components/Li";
import { useParams } from "react-router-dom";
import Info from "../Components/Info";
import MySnackBar from "../Components/MySnackBar";
import moment from "moment-timezone";

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function DepartmentInfoFranchisee() {
    const userData = useFetchUserData()
    const {id} = useParams()

    const [info, setInfo] = useState(null)
    const [history, setHistory] = useState(null)
    const [date, setDate] = useState(getCurrentDate());

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

        setDate(formattedValue);
    };

    const getDepartmentInfoFranchisee = () => {
        if (date.length !== 10) {
            setOpen(true)
            setStatus("error")
            setMessage("Введите даты в формате ГГГГ-ММ-ДД")
            return
        }
        api.post("/getDepartmentInfoFranchisee", {id, date}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setInfo(data.info)
            setHistory(data.history)
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        getDepartmentInfoFranchisee()
    }, [])

    return <Container role={userData?.role}>
        <Div>Сводные данные цеха</Div>
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
                            value={date}
                            change={handleDateChange}
                        />
                        ]
                    </div>
                    <MyButton click={getDepartmentInfoFranchisee}>
                        <span className="text-green-400">
                            Применить
                        </span>
                    </MyButton>
                </div>
            </Li>
        </>
        <Div />
        <Div>Франчайзи {info?.fullName}:</Div>
        <Li>Забрал 12(1): <Info>{info?.totalB121}</Info></Li>
        <Li>Забрал 19(1): <Info>{info?.totalB191}</Info></Li>
        <Li>Забрал 19(7): <Info>{info?.totalB197}</Info></Li>
        <Div />

        {history && history.length > 0 && history.map((item) => {
            return <div key={item?._id}>
                <Div>
                    {item?.type ? <span className="bg-red">Принял</span> : <span className="bg-green-400">Отдал</span>}: {item?.department?.fullName}
                </Div>
                <Li>
                    Франчайзи: {item?.franchisee?.fullName} 
                    {item?.data?.b121kol !== 0 && <span>12,5: <Info>{item?.data?.b121kol}</Info></span>}
                    {item?.data?.b191kol !== 0 && <span>18,9(1): <Info>{item?.data?.b191kol}</Info></span>}
                    {item?.data?.b197kol !== 0 && <span>18,9(7): <Info>{item?.data?.b197kol}</Info></span>}
                </Li>
                <Li>
                    Дата и время: {moment(item.createdAt).tz('Asia/Almaty').format('YYYY-MM-DD HH:mm')}
                </Li>
            </div>
        })}
        <MySnackBar
            open={open}
            text={message}
            status={status}
            close={closeSnack}
        />
        <Div />
    </Container>
}