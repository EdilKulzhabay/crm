import { useEffect, useState } from "react";
import api from "../../api"
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import useFetchUserData from "../../customHooks/useFetchUserData";
import LinkButton from "../../Components/LinkButton";

export default function SuperAdminClientsVerify() {
    const userData = useFetchUserData()
    const [clients, setClients] = useState([])

    useEffect(() => {
        api.get("/getNotVerifyClients", {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setClients(data.clients)
        }).catch((e) => {
            console.log(e);
        })
    }, [])
    

    return <Container role={userData?.role}>
        <Div>Список новых клиентов</Div>

        <Div />
        <div>
        {clients.map((client, index) => {
            return (
                <div key={client._id}>
                    <Li link={client?.verify?.status}>
                        <div className="flex items-center gap-x-2 flex-wrap">
                            <div>{client.fullName}{client.fullName === "" && client.userName}</div>
                            <div>|</div>
                            <div>{client.phone}</div>
                            <LinkButton
                                color="green"
                                href={`/ClientPage/${client._id}`}
                            >
                                Редактировать
                            </LinkButton>
                            {userData?.role === "superAdmin" && <span>{client?.franchisee?.fullName}</span>}
                        </div>
                    </Li>
                </div>
            );
        })}
        </div>
        <Div />
    </Container>
}