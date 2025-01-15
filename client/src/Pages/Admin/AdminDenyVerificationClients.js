import { useEffect, useState } from "react";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";
import useFetchUserData from "../../customHooks/useFetchUserData";
import MyInput from "../../Components/MyInput";
import MyButton from "../../Components/MyButton";

export default function AdminDenyVerificationClients() {
    const userData = useFetchUserData();
    const [clients, setClients] = useState([]);
    const [searchF, setSearchF] = useState("");
    const handleSearchF = (e) => {
        setSearchF(e.target.value);
    };

    const getDenyVerfifcation = async () => {
        api.post("/getDenyVerfifcation", {searchF}, {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setClients(data.clients);
            })
            .catch((e) => {
                console.log(e);
            });
    }

    useEffect(() => {
        getDenyVerfifcation()
    }, []);

    return (
        <Container role={userData?.role}>
            <Div>
                <div>Клиенты не прошедшие верификацию:</div>
            </Div>
            {userData?.role === "superAdmin" && <>
                <Div />
                <Div>Фильтрация по франчайзи</Div>
                <Div>
                    <div className="flex items-center flex-wrap gap-x-4">
                        <MyInput
                            value={searchF}
                            change={handleSearchF}
                            color="white"
                        />
                        <MyButton click={() => {
                            getDenyVerfifcation()
                        }}>Найти</MyButton>
                    </div>
                </Div>
            </>}
            <Div />
            {clients && clients.length > 0 && clients.map((item) => {
                return <div key={item?._id}>
                    <Li>
                        <div className="flex items-center gap-x-2">
                            <div>{item?.fullName !== "" ? item?.fullName : item?.userName}</div>
                            <div>|</div>
                            <div>{item?.verify?.message}</div>
                            {userData?.role === "superAdmin" && <>
                                <div>|</div>
                                <div>{item?.franchisee?.fullName}</div> 
                            </>}
                            <LinkButton
                                color="green"
                                href={`/ClientPage/${item?._id}`}
                            >
                                Редактировать
                            </LinkButton>
                        </div>
                    </Li>
                </div>
            })}
            <Div />
        </Container>
    );
}
