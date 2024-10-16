import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import useFetchUserData from "../../customHooks/useFetchUserData";
import api from "../../api";
import MyButton from "../../Components/MyButton";
import Div from "../../Components/Div";
import UpIcon from "../../icons/UpIcon";
import DownIcon from "../../icons/DownIcon";
import Info from "../../Components/Info";
import Li from "../../Components/Li";
import MySnackBar from "../../Components/MySnackBar";

export default function DepartamentReceiving() {
    const userData = useFetchUserData();
    const [franchisees, setFranchisees] = useState([]);
    const [chFranchisee, setChFranchisee] = useState(null);
    const [data, setData] = useState({
        b121kol: 0,
        b191kol: 0,
        b197kol: 0,
    });

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };
    
    // Хранение идентификаторов таймера для увеличения и уменьшения
    const [increaseTimer, setIncreaseTimer] = useState(null);
    const [decreaseTimer, setDecreaseTimer] = useState(null);

    useEffect(() => {
        api.get("/getAllFranchisee", {
            headers: {"Content-Type": "application/json"}
        }).then(({ data }) => {
            setFranchisees(data.franchisees);
            console.log(data);
        }).catch((e) => {
            console.log(e);
        });
    }, []);

    // Функция для увеличения значения
    const increaseValue = (key) => {
        setData(prevData => ({
            ...prevData,
            [key]: prevData[key] + 1,
        }));
    };

    // Функция для уменьшения значения
    const decreaseValue = (key) => {
        setData(prevData => ({
            ...prevData,
            [key]: prevData[key] > 0 ? prevData[key] - 1 : 0,
        }));
    };

    // Функция для начала увеличения значения
    const startIncrease = (key) => {
        increaseValue(key); // Увеличиваем значение сразу
        const timer = setInterval(() => increaseValue(key), 1000); // Увеличиваем значение каждые 0.5 сек
        setIncreaseTimer(timer); // Сохраняем таймер
    };

    // Функция для начала уменьшения значения
    const startDecrease = (key) => {
        decreaseValue(key); // Уменьшаем значение сразу
        const timer = setInterval(() => decreaseValue(key), 1000); // Уменьшаем значение каждые 0.5 сек
        setDecreaseTimer(timer); // Сохраняем таймер
    };

    // Функция для остановки таймеров
    const stopTimers = () => {
        if (increaseTimer) {
            clearInterval(increaseTimer); // Останавливаем таймер увеличения
            setIncreaseTimer(null);
        }
        if (decreaseTimer) {
            clearInterval(decreaseTimer); // Останавливаем таймер уменьшения
            setDecreaseTimer(null);
        }
    };

    const receive = () => {
        api.post("/departmentAction", {id:userData._id, franchisee: chFranchisee._id, type: userData.receiving, data}, {
            headers: {"Content-Type": "application/json"}
        }).then(({data}) => {
            if (data.success) {
                setOpen(true);
                setStatus("success");
                setMessage("Все прошло успешно");
            }
        })
    }

    return (
        <Container role={userData?.role}>
            <Div>
                Принять бутыли
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
                                <MyButton click={() => {setChFranchisee(item)}}>Выбрать</MyButton>
                            </Div>
                        </div>
                    );
                })}
            </> : <>
                <Div>{chFranchisee.fullName} <MyButton click={() => {setChFranchisee(null)}}>Отменить</MyButton></Div>
            </>}

            {chFranchisee !== null && <>
                {chFranchisee?.b121kol !== 9999 && 
                    <Li>
                        <div className="flex items-center gap-x-2">
                            <div>Количество 12,5 л:</div>
                            <button 
                                onMouseDown={() => startDecrease("b121kol")} 
                                onMouseUp={stopTimers} 
                                onMouseLeave={stopTimers} 
                                onTouchStart={() => startDecrease("b121kol")}
                                onTouchEnd={stopTimers} 
                                className="w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                            >
                                <DownIcon className="w-6 h-6 text-white" />
                            </button>
                            <Info>{data.b121kol}</Info>
                            <button 
                                onMouseDown={() => startIncrease("b121kol")} 
                                onMouseUp={stopTimers} 
                                onMouseLeave={stopTimers}
                                onTouchStart={() => startIncrease("b121kol")}
                                onTouchEnd={stopTimers} 
                                className="ml-3 w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                            >
                                <UpIcon className="w-6 h-6 text-white" />
                            </button>
                        </div>
                    </Li>
                }
                <Li>
                    <div className="flex items-center gap-x-2">
                        <div>Количество 18,9 л. (1):</div>
                        <button 
                            onMouseDown={() => startDecrease("b191kol")} 
                            onMouseUp={stopTimers} 
                            onMouseLeave={stopTimers} 
                            onTouchStart={() => startDecrease("b191kol")}
                            onTouchEnd={stopTimers} 
                            className="w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                        >
                            <DownIcon className="w-6 h-6 text-white" />
                        </button>
                        <Info>{data.b191kol}</Info>
                        <button 
                            onMouseDown={() => startIncrease("b191kol")} 
                            onMouseUp={stopTimers} 
                            onMouseLeave={stopTimers} 
                            onTouchStart={() => startIncrease("b191kol")}
                            onTouchEnd={stopTimers} 
                            className="ml-3 w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                        >
                            <UpIcon className="w-6 h-6 text-white" />
                        </button>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-2">
                        <div>Количество 18,9 л. (7):</div>
                        <button 
                            onMouseDown={() => startDecrease("b197kol")} 
                            onMouseUp={stopTimers} 
                            onMouseLeave={stopTimers} 
                            onTouchStart={() => startDecrease("b197kol")}
                            onTouchEnd={stopTimers} 
                            className="w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                        >
                            <DownIcon className="w-6 h-6 text-white" />
                        </button>
                        <Info>{data.b197kol}</Info>
                        <button 
                            onMouseDown={() => startIncrease("b197kol")} 
                            onMouseUp={stopTimers} 
                            onMouseLeave={stopTimers} 
                            onTouchStart={() => startIncrease("b197kol")}
                            onTouchEnd={stopTimers} 
                            className="ml-3 w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                        >
                            <UpIcon className="w-6 h-6 text-white" />
                        </button>
                    </div>
                </Li>
                <Div />
                <Div>
                    <MyButton click={receive}>Принять</MyButton>
                </Div>
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
