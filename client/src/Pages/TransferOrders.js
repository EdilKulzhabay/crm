import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import MySnackBar from "../Components/MySnackBar";
import useFetchUserData from "../customHooks/useFetchUserData";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import Li from "../Components/Li";

export default function TransferOrders() {
    const navigate = useNavigate();
    const { clientId } = useParams();
    const userData = useFetchUserData();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [search, setSearch] = useState("")
    const [clients, setClients] = useState([])
    const [client, setClient] = useState({})
    const [chooseClient, setChooseClient] = useState(null)

    const closeSnack = () => {
        setOpen(false);
    };

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setClients([]);
        }
    };

    const searchClient = () => {
        api.post(
            "/searchClient",
            { search },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setClients(data);
            })
            .catch((e) => {
                console.log(e);
            });
    };
    
    const getClientData = () => {
        api.post(
            "/getClientDataForId",
            { id: clientId },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                setClient(data);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        getClientData();
    }, []);

    const transferOrders = async () => {
        await api.post("/transferOrders", {firstClientId: client?._id, secondClientId: chooseClient?._id}, {
            headers: { "Content-Type": "application/json" }
        }).then(({data}) => {
            if (data.success) {
                setOpen(true)
                setMessage(data.message)
                setStatus("success")
            } else {
                setOpen(true)
                setMessage(data.message)
                setStatus("error")
            }
        }).catch((e) => {
            setOpen(true)
            setMessage("Что то пошло не так")
            setStatus("error")
        })
    }

    const cancel = () => {
        navigate(-1);
    };

    return (
        <div className="relative">
            <Container role={userData?.role}>
                <Div>
                    <div>Перенос заказов клиента</div>
                </Div>
                <Div/>
                <Div>Наш клиент: {client?.fullName} {client?.userName} {client?.phone}</Div>
                <Div />
                <Div>
                    <div>Поиск клиента:</div>
                </Div>
                <Div>
                    <div className="flex items-center flex-wrap gap-x-4">
                        <MyInput
                            value={search}
                            change={handleSearch}
                            color="white"
                        />
                        <MyButton click={searchClient}>Найти</MyButton>
                    </div>
                </Div>
                <Div />
                
                {clients && clients.length > 0 && clients.map((item) => {
                    return <Li>
                        <div>{item?.fullName} {item?.userName} {item?.phone}</div>
                        <MyButton click={() => {setChooseClient(item)}}>Выбрать</MyButton>
                    </Li>
                })}

                <Div />

                <Div>Выбранный клиент {chooseClient && chooseClient?.phone}</Div>

                <Div />

                <Div>
                    <MyButton click={transferOrders}>Перенести</MyButton>
                </Div>
                <Div />

                <MySnackBar
                    open={open}
                    text={message}
                    status={status}
                    close={closeSnack}
                />
            </Container>
        </div>
    );
}
