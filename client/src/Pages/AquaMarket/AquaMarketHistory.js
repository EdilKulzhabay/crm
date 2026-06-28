import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import api from "../../api";
import DataInput from "../../Components/DataInput";
import MyButton from "../../Components/MyButton";
import Info from "../../Components/Info";
import useFetchUserData from "../../customHooks/useFetchUserData";

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDate = (dateString) => {
    const date = new Date(dateString).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });
    return date;
};

export default function AquaMarketHistory() {
    const {aquaMarketId} = useParams();
    const [history, setHistory] = useState([]);
    const [aquaMarket, setAquaMarket] = useState(null);
    const [startDate, setStartDate] = useState(getCurrentDate());
    const [endDate, setEndDate] = useState(getCurrentDate());
    const userData = useFetchUserData();
    const [bottles, setBottles] = useState({
        b12: 0,
        b19: 0,
    });

    const [editFull, setEditFull] = useState({ b12: '', b19: '' });
    const [editEmpty, setEditEmpty] = useState({ b12: '', b19: '' });

    const getHistory = async () => {
        api.post("/getAquaMarketHistory", { aquaMarketId, startDate, endDate }, {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setHistory(data.aquaMarketHistory);
            })
            .catch((error) => {
                console.log(error);
            });
    }

    useEffect(() => {
        api.post("/getAquaMarketData", { aquaMarketId }, {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setAquaMarket(data.aquaMarket);
            })
            .catch((error) => {
                console.log(error);
            });

        getHistory();
    }, [aquaMarketId]);

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

        if (e.target.name === "startDate") {
            setStartDate(formattedValue);
        } else {
            setEndDate(formattedValue);
        }
    };

    const handleUpdateBottles = async (field, data) => {
        await api.post("/updateAquaMarketData", { aquaMarketId, changeField: field, changeData: data }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data: res }) => {
            if (res.success) {
                api.post("/getAquaMarketData", { aquaMarketId }, {
                    headers: { "Content-Type": "application/json" },
                }).then(({ data }) => setAquaMarket(data.aquaMarket));
                if (field === "full") setEditFull({ b12: '', b19: '' });
                if (field === "empty") setEditEmpty({ b12: '', b19: '' });
            }
        }).catch(console.error);
    };

    const handleFillBottles = async () => {
        await api.post("/aquaMarketFill", { aquaMarketId, bottles }, {
            headers: { "Content-Type": "application/json" },
        })
        .then(({ data }) => {
            console.log(data);
            setBottles({
                b12: 0,
                b19: 0,
            });
            getHistory();
        })
        .catch((error) => {
            console.log(error);
        });
    }

    return (
        <Container role={userData?.role}>
            <Div>История</Div>
            <Div>Аквамаркет: {aquaMarket?.address}</Div>
            <Div />
            <Div>Заполнить бутыли</Div>
            <Li>12,5 л: 
                <div>
                    [{" "}
                    <input
                        size={13}
                        className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                        name="b12"
                        value={bottles.b12}
                        style={{ fontSize: '16px' }}
                        inputMode="numeric"
                        pattern="\d*"
                        onKeyPress={(event) => {
                            if (!/[0-9-]/.test(event.key)) {
                                event.preventDefault(); // блокирует ввод символов, кроме цифр и минуса
                            }
                        }}
                        onChange={(event) => {
                            setBottles({ ...bottles, b12: event.target.value });
                        }}
                    />{" "}
                    ]
                </div>
            </Li>
            <Li>18,9 л: 
                <div>
                    [{" "}
                    <input
                        size={13}
                        className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                        name="b19"
                        value={bottles.b19}
                        style={{ fontSize: '16px' }}
                        inputMode="numeric"
                        pattern="\d*"
                        onKeyPress={(event) => {
                            if (!/[0-9-]/.test(event.key)) {
                                event.preventDefault(); // блокирует ввод символов, кроме цифр и минуса
                            }
                        }}
                        onChange={(event) => {
                            setBottles({ ...bottles, b19: event.target.value });
                        }}
                    />{" "}
                    ]
                </div>
            </Li>
            <Div>
                <MyButton click={handleFillBottles}>Заполнить</MyButton>
            </Div>
            <Div />

            <Div>Полные бутыли (текущие: 12,5 л — {aquaMarket?.full?.b12 ?? 0}, 18,9 л — {aquaMarket?.full?.b19 ?? 0})</Div>
            <Li>12,5 л:{" "}[{" "}
                <input
                    size={13}
                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                    style={{ fontSize: '16px' }}
                    inputMode="numeric"
                    value={editFull.b12}
                    onKeyPress={(e) => { if (!/[0-9-]/.test(e.key)) e.preventDefault(); }}
                    onChange={(e) => setEditFull(p => ({ ...p, b12: e.target.value }))}
                />{" "}]
            </Li>
            <Li>18,9 л:{" "}[{" "}
                <input
                    size={13}
                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                    style={{ fontSize: '16px' }}
                    inputMode="numeric"
                    value={editFull.b19}
                    onKeyPress={(e) => { if (!/[0-9-]/.test(e.key)) e.preventDefault(); }}
                    onChange={(e) => setEditFull(p => ({ ...p, b19: e.target.value }))}
                />{" "}]
            </Li>
            {(editFull.b12 !== '' || editFull.b19 !== '') && (
                <Div>
                    <MyButton click={() => handleUpdateBottles("full", {
                        b12: editFull.b12 !== '' ? Number(editFull.b12) : aquaMarket?.full?.b12 ?? 0,
                        b19: editFull.b19 !== '' ? Number(editFull.b19) : aquaMarket?.full?.b19 ?? 0,
                    })}>Сохранить полные</MyButton>
                </Div>
            )}
            <Div />

            <Div>Пустые бутыли (текущие: 12,5 л — {aquaMarket?.empty?.b12 ?? 0}, 18,9 л — {aquaMarket?.empty?.b19 ?? 0})</Div>
            <Li>12,5 л:{" "}[{" "}
                <input
                    size={13}
                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                    style={{ fontSize: '16px' }}
                    inputMode="numeric"
                    value={editEmpty.b12}
                    onKeyPress={(e) => { if (!/[0-9-]/.test(e.key)) e.preventDefault(); }}
                    onChange={(e) => setEditEmpty(p => ({ ...p, b12: e.target.value }))}
                />{" "}]
            </Li>
            <Li>18,9 л:{" "}[{" "}
                <input
                    size={13}
                    className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base w-[50px] text-center"
                    style={{ fontSize: '16px' }}
                    inputMode="numeric"
                    value={editEmpty.b19}
                    onKeyPress={(e) => { if (!/[0-9-]/.test(e.key)) e.preventDefault(); }}
                    onChange={(e) => setEditEmpty(p => ({ ...p, b19: e.target.value }))}
                />{" "}]
            </Li>
            {(editEmpty.b12 !== '' || editEmpty.b19 !== '') && (
                <Div>
                    <MyButton click={() => handleUpdateBottles("empty", {
                        b12: editEmpty.b12 !== '' ? Number(editEmpty.b12) : aquaMarket?.empty?.b12 ?? 0,
                        b19: editEmpty.b19 !== '' ? Number(editEmpty.b19) : aquaMarket?.empty?.b19 ?? 0,
                    })}>Сохранить пустые</MyButton>
                </Div>
            )}
            <Div />

            <Div>
                <DataInput type="date" name="startDate" value={startDate} change={handleDateChange} />
                <DataInput type="date" name="endDate" value={endDate} change={handleDateChange} />
                <MyButton click={getHistory}>Применить</MyButton>
            </Div>
            <Div />
            {history.length > 0 && history.map((item) => (
                <div key={item?._id}>
                    <Div>{item?.actionType === "giving" ? "Отдача" : item?.actionType === "receiving" ? "Прием" : "Заполнение"}</Div>
                    {item?.actionType !== "fill" && <Li>Курьер: {item?.courierAggregator?.fullName}</Li>}
                    {item?.actionType === "fill" && <Li></Li>}
                    <Li>12,5 л: <Info>{item?.bottles?.b12 || 0}</Info></Li>
                    <Li>18,9 л: <Info>{item?.bottles?.b19 || 0}</Info></Li>
                    <Li>Дата и время: {formatDate(item?.createdAt)}</Li>
                    <Div />
                </div>
            ))}
            <Div />
        </Container>
    )
}