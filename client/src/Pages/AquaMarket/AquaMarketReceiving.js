import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import api from "../../api";
import MyButton from "../../Components/MyButton";
import MySnackBar from "../../Components/MySnackBar";

export default function AquaMarketReceiving() {
    const [courierAggregators, setCourierAggregators] = useState([]);
    const [selectedCourier, setSelectedCourier] = useState(null);
    const [bottles, setBottles] = useState({
        b12: 0,
        b19: 0,
    });
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [aquaMarketData, setAquaMarketData] = useState(null);

    const closeSnack = () => {
        setOpen(false);
    };

    useEffect(() => {
        setAquaMarketData(JSON.parse(localStorage.getItem("aquaMarketData")));
        api.get("/getActiveCourierAggregators", {
            headers: { "Content-Type": "application/json" },
        })
        .then(({ data }) => {
            setCourierAggregators(data.couriers);
        });
    }, []);

    const give = () => {
        api.post("/aquaMarketAction", {
            actionType: "receiving",
            aquaMarketId: aquaMarketData._id,
            courierAggregatorId: selectedCourier._id,
            bottles: bottles,
        }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            if (data.success) {
                setOpen(true);
                setStatus("success");
                setMessage("Все прошло успешно");
                setBottles({
                    b12: 0,
                    b19: 0,
                });
                setSelectedCourier(null);
            } else {
                setOpen(true);
                setStatus("error");
                setMessage(data.message);
                setBottles({
                    b12: 0,
                    b19: 0,
                });
                setSelectedCourier(null);
            }
        });
    }
    return (
        <Container role="aquaMarket">
            <Div>Принять бутыли</Div>
            <Div />
            {courierAggregators.length > 0 && selectedCourier === null ? <>
                <Div>Курьеры:</Div>
                {courierAggregators.map((courier) => (
                    <Li key={courier._id}>
                        {courier.fullName}
                        <MyButton click={() => setSelectedCourier(courier)}>Выбрать</MyButton>
                    </Li>
                ))}
            </> : <Div>Нет курьеров</Div>}
            {selectedCourier !== null && <>
                <Div>Выбранный курьер: {selectedCourier.fullName} <MyButton click={() => setSelectedCourier(null)}>Выбрать другого курьера</MyButton></Div>
                <Div />
                <Div>Количество бутылей:</Div>
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
                <Div />
                <Div>Действия:</Div>
                <Div>
                    <MyButton click={give}>Принять бутыли</MyButton>
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
    )
}