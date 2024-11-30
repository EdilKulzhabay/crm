import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import useFetchUserData from "../../customHooks/useFetchUserData";
import api from "../../api";
import MyButton from "../../Components/MyButton";
import Div from "../../Components/Div";
import PlusIcon from "../../icons/PlusIcon";
import MinusIcon from "../../icons/MinusIcon";
import Li from "../../Components/Li";
import MySnackBar from "../../Components/MySnackBar";
import { useNavigate } from "react-router-dom";

export default function DepartamentGivingSingle() {
    const userData = useFetchUserData();
    const navigate = useNavigate()
    const [franchisees, setFranchisees] = useState([]);
    const [chFranchisee, setChFranchisee] = useState(null);
    const [data, setData] = useState({
        b121kol: "",
        b191kol: "",
        b197kol: "",
    });

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

    // Функция для увеличения значения
    const increaseValue = (key) => {
        setData(prevData => ({
            ...prevData,
            [key]: Number(prevData[key]) + 1,
        }));
    };

    // Функция для уменьшения значения
    const decreaseValue = (key) => {
        setData(prevData => ({
            ...prevData,
            [key]: prevData[key] > 0 ? Number(prevData[key]) - 1 : 0,
        }));
    };

    const give = (receivingFinish) => {
        const sendData = {
            b121kol: Number(data.b121kol),
            b191kol: Number(data.b191kol),
            b197kol: Number(data.b197kol),
        }
        api.post("/departmentAction", {id: userData._id, franchisee: chFranchisee._id, type: userData.receiving, data: sendData, receivingFinish}, {
            headers: {"Content-Type": "application/json"}
        }).then(({data}) => {
            if (data.success) {
                setOpen(true);
                setStatus("success");
                setMessage("Все прошло успешно");
                navigate(-1)
            }   
        })
    }

    const changeData = (event) => {
        setData({ ...data, [event.target.name]: event.target.value });
    };

    return (
        <Container role={userData?.role}>
            <Div>
                Отпустить бутыли
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
                                onClick={() => {decreaseValue("b121kol")}}
                                className="w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                            >
                                <MinusIcon className="w-6 h-6 text-white" />
                            </button>
                            <div>
                                [{" "}
                                <input
                                    size={13}
                                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                    name="b121kol"
                                    value={data.b121kol}
                                    style={{ fontSize: '16px' }}
                                    inputMode="numeric"
                                    pattern="\d*"
                                    onKeyPress={(event) => {
                                        if (!/[0-9-]/.test(event.key)) {
                                            event.preventDefault(); // блокирует ввод символов, кроме цифр и минуса
                                        }
                                    }}
                                    onChange={(event) => {
                                        changeData(event)
                                    }}
                                />{" "}
                                ]
                            </div>
                            <button 
                                onClick={() => {increaseValue("b121kol")}}
                                className="ml-3 w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                            >
                                <PlusIcon className="w-6 h-6 text-white" />
                            </button>
                        </div>
                    </Li>
                }
                <Li>
                    <div className="flex items-center gap-x-2">
                        <div>Количество 18,9 л. (1):</div>
                        <button 
                            onClick={() => {decreaseValue("b191kol")}}
                            className="w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                        >
                            <MinusIcon className="w-6 h-6 text-white" />
                        </button>
                        <div>
                            [{" "}
                            <input
                                size={13}
                                className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                name="b191kol"
                                value={data.b191kol}
                                style={{ fontSize: '16px' }}
                                inputMode="numeric"
                                pattern="\d*"
                                onKeyPress={(event) => {
                                    if (!/[0-9-]/.test(event.key)) {
                                        event.preventDefault(); // блокирует ввод символов, кроме цифр и минуса
                                    }
                                }}
                                onChange={(event) => {
                                    changeData(event)
                                }}
                            />{" "}
                            ]
                        </div>
                        <button 
                            onClick={() => {increaseValue("b191kol")}}
                            className="ml-3 w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                        >
                            <PlusIcon className="w-6 h-6 text-white" />
                        </button>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center gap-x-2">
                        <div>Количество 18,9 л. (7):</div>
                        <button 
                            onClick={() => {decreaseValue("b197kol")}}
                            className="w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                        >
                            <MinusIcon className="w-6 h-6 text-white" />
                        </button>
                        <div>
                            [{" "}
                            <input
                                size={13}
                                className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                                name="b197kol"
                                value={data.b197kol}
                                style={{ fontSize: '16px' }}
                                inputMode="numeric"
                                pattern="\d*"
                                onKeyPress={(event) => {
                                    if (!/[0-9-]/.test(event.key)) {
                                        event.preventDefault(); // блокирует ввод символов, кроме цифр и минуса
                                    }
                                }}
                                onChange={(event) => {
                                    changeData(event)
                                }}
                            />{" "}
                            ]
                        </div>
                        <button 
                            onClick={() => {increaseValue("b197kol")}}
                            className="ml-3 w-8 h-8 flex items-center bg-gray-700 bg-opacity-50 rounded-full justify-center p-1"
                        >
                            <PlusIcon className="w-6 h-6 text-white" />
                        </button>
                    </div>
                </Li>
                <Div />
                <Div>
                    <MyButton click={() => {give(true)}}>Завершить</MyButton>
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
