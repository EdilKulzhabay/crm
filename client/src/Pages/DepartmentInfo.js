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

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function DepartmentInfo() {
    const userData = useFetchUserData()

    const [info, setInfo] = useState(null)
    const [dates, setDates] = useState({
        startDate: getCurrentDate(),
        endDate: getCurrentDate(),
    });
    const [stats, setStats] = useState({})

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
        getDepartmentInfo()
    }

    const getDepartmentInfo = () => {
        api.post("/getDepartmentInfo", {...dates}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setStats(data.stats)
            setInfo(data.franchisees)
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        getDepartmentInfo()
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
        <Li>Отпущено 12(1): <Info>{stats?.totalB121}</Info></Li>
        <Li>Отпущено 19(1): <Info>{stats?.totalB191}</Info></Li>
        <Li>Отпущено 19(7): <Info>{stats?.totalB197}</Info></Li>
        <Li>Принято 12(1): <Info>{stats?.totalB1212}</Info></Li>
        <Li>Принято 19(1): <Info>{stats?.totalB1912}</Info></Li>
        <Li>Принято 19(7): <Info>{stats?.totalB1972}</Info></Li>
        <Div />
        <Div>Список Франчайзи:</Div>
        <Div />
        {info && info.length > 0 && info.map((item) => {
            return <div key={item?._id}>
                <Div>
                    {item?.fullName} <LinkButton href={`/departmentInfoFranchisee/${item?._id}`}>Просмотр</LinkButton>
                </Div>
                {item?.b121kol !== 9999 && <Li><div className="w-[120px]">Кол 12,5:</div> <Info>{item?.b121kol} шт.</Info></Li>}
                <Li><div className="w-[120px]">Кол 18,9 (1):</div> <Info>{item?.b191kol} шт.</Info></Li>
                <Li><div className="w-[120px]">Кол 18,9 (7):</div> <Info>{item?.b197kol} шт.</Info></Li>
            </div>
        })}
        <Div />
        <MySnackBar
            open={open}
            text={message}
            status={status}
            close={closeSnack}
        />
    </Container>
}