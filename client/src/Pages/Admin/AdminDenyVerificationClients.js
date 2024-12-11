import { useEffect, useState } from "react";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";
import useFetchUserData from "../../customHooks/useFetchUserData";

export default function AdminDenyVerificationClients() {
    const userData = useFetchUserData();
    const [clients, setClients] = useState([]);

    useEffect(() => {
        api.get("/getMainPageInfo", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setClients(data.clients);
            })
            .catch((e) => {
                console.log(e);
            });
    }, []);

    return (
        <Container role={userData?.role}>
            <Div>
                <div>Клиенты не прошедшие верификацию:</div>
            </Div>
            <Div />
            {clients && clients.length > 0 && clients.map((item) => {
                return <div key={item?._id}>
                    <Li>
                        <div className="flex items-center gap-x-2">
                            <div>{item?.fullName !== "" ? item?.fullName : item?.userName}</div>
                            <div>|</div>
                            <div>{item?.verify?.message}</div>
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
