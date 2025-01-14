import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import useFetchUserData from "../../customHooks/useFetchUserData";
import api from "../../api";
import MyButton from "../../Components/MyButton";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import Info from "../../Components/Info";
import MySnackBar from "../../Components/MySnackBar";
import moment from "moment-timezone";

export default function DepartmentReceivingHistory() {
    const userData = useFetchUserData();
    const [franchisees, setFranchisees] = useState([]);
    const [chFranchisee, setChFranchisee] = useState(null);
    const [history, setHistory] = useState([])

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    useEffect(() => {
        api.get("/getAllFranchisee", {
            headers: {"Content-Type": "application/json"}
        }).then(({ data }) => {
            setFranchisees(data.franchisees);
        }).catch((e) => {
            console.log(e);
        });
    }, []);

    const getReceivHistory = async(fran) => {
        setChFranchisee(fran)
        api.post("/getReceivHistory", {id: fran?._id}, {
            headers: {"Content-Type": "application/json"}
        }).then(({ data }) => {
            setHistory(data.history)
        }).catch((e) => {
            console.log(e);
        });
    }

    const deleteDepartmentHistory = (id) => {
        api.post("/deleteDepartmentHistory", {id}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                getReceivHistory()
            }
        }).catch((e) => {
            console.log(e);
        })
    }

    return (
        <Container role={userData?.role}>
            <Div>
                История
            </Div>
            <Div />
            {chFranchisee === null ? <>
                <Div>
                    Список франчайзи
                </Div>
                {franchisees.map((item) => {
                    return (
                        <div key={item._id}>
                            <Div>
                                {item.fullName}
                                <MyButton click={() => {getReceivHistory(item)}}>Выбрать</MyButton>
                            </Div>
                            <Div />
                        </div>
                    );
                })}
            </> : <>
                <Div>{chFranchisee.fullName} <MyButton click={() => {setChFranchisee(null)}}>Отменить</MyButton></Div>
            </>}

            {chFranchisee !== null && <>
                {history && history.length > 0 && history.map((item) => {
                    return <div key={item?._id}>
                        <Div>
                            {item?.type ? <span className="bg-red">Принято</span> : <span className="bg-green-400">Отпущено</span>}: {item?.department?.fullName}
                            <MyButton click={() => {deleteDepartmentHistory(item?._id)}}>Удалить</MyButton>
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
            </>}
            <Div />
            <MySnackBar
                open={open}
                text={message}
                status={status}
                close={closeSnack}
            />
        </Container>
    );
}
