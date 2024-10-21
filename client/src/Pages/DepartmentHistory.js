import { useEffect, useState } from "react";
import ChooseFranchiseeModal from "../Components/ChooseFranchiseeModal";
import Container from "../Components/Container";
import DataInput from "../Components/DataInput";
import Div from "../Components/Div";
import Li from "../Components/Li";
import useFetchUserData from "../customHooks/useFetchUserData";
import useScrollPosition from "../customHooks/useScrollPosition";
import MyButton from "../Components/MyButton";
import MySnackBar from "../Components/MySnackBar";
import api from "../api";
import Info from "../Components/Info";
import moment from "moment-timezone";

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function DepartmentHistory() {
    const userData = useFetchUserData()
    const scrollPosition = useScrollPosition();
    const [history, setHistory] = useState([])
    const [dates, setDates] = useState({
        startDate: getCurrentDate(),
        endDate: getCurrentDate(),
    });
    const [franchiseesModal, setFranchiseesModal] = useState(false);
    const [franchisee, setFranchisee] = useState(null);
    const [historyStatus, setHistoryStatus] = useState("all")
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
        getHistory()
    }

    const closeFranchiseeModal = () => {
        setFranchiseesModal(false);
    };

    const chooseFranchisee = (chFranchisee) => {
        setFranchisee(chFranchisee);
        setFranchiseesModal(false);
    };

    const getHistory = () => {
        const fId = franchisee?._id || "all"
        api.post("/getDepartmentHistory", {...dates, franchisee: fId, status: historyStatus}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setHistory(data.history)
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        getHistory()
    }, [franchisee, historyStatus])

    return (
    <div className="relative">
        {franchiseesModal && (
                <ChooseFranchiseeModal
                    closeFranchiseeModal={closeFranchiseeModal}
                    chooseFranchisee={chooseFranchisee}
                    scrollPosition={scrollPosition}
                />
            )}
        <Container role={userData?.role}>
            <Div>
                История сотрудников цеха
            </Div>
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
            <Div>Выбрать франчайзи: {franchisee === null ? 
                <div> Все <MyButton click={() => {setFranchiseesModal(true)}}>Выбрать</MyButton></div> : 
                <div>{franchisee?.fullName} <MyButton click={() => {setFranchisee(null)}}>отменить</MyButton></div>}
            </Div>

            <Div />
            <Div>
                Статус истории: <span className="text-yellow-300">{historyStatus === "all" ? "Все" : historyStatus === "receiving" ? "Принимал" : "Отдавал"}</span>
            </Div>
            <Div>
                <div className="flex items-center gap-x-2">
                    <div className="text-green-400">[</div>
                    <button onClick={() => {setHistoryStatus("all")}} className="text-green-400 hover:text-blue-600">Все</button> /
                    <button onClick={() => {setHistoryStatus("receiving")}} className="text-green-400 hover:text-blue-600">Принимал</button> /
                    <button onClick={() => {setHistoryStatus("giving")}} className="text-green-400 hover:text-blue-600">Отдавал</button>
                    <div className="text-green-400">]</div>
                </div>
            </Div>

            <Div />

            {history.length > 0 && history.map((item) => {
                return (
                    <div key={item._id}>
                        <Div>
                            {item.type ? <span className="bg-red">Принял</span> : <span className="bg-green-400">Отдал</span>}: {item.department.fullName}
                        </Div>
                        <Li>
                            Франчайзи: {item.franchisee.fullName} 
                            {item.data.b121kol !== 0 && <span>12,5: <Info>{item.data.b121kol}</Info></span>}
                            {item.data.b191kol !== 0 && <span>18,9(1): <Info>{item.data.b191kol}</Info></span>}
                            {item.data.b197kol !== 0 && <span>18,9(7): <Info>{item.data.b197kol}</Info></span>}
                        </Li>
                        <Li>
                            Дата и время: {moment(item.createdAt).tz('Asia/Almaty').format('YYYY-MM-DD HH:mm')}
                        </Li>
                    </div>
                )
            })}

            <Div />
            <MySnackBar
                open={open}
                text={message}
                status={status}
                close={closeSnack}
            />
        </Container>
    </div>)
}