import { useEffect, useState } from "react";
import api from "../api";
import Container from "../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import Li2 from "../../Components/Li2";
import MyButton from "../../Components/MyButton";
import MyInput from "../../Components/MyInput";
import MySnackBar from "../../Components/MySnackBar";
import useFetchUserData from "../../customHooks/useFetchUserData";

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
            let link = false
            if (client.addresses.length > 0) {
                client.addresses.forEach((address) => {
                    if (address.link.includes("/search")) {
                        link = true
                    }
                })
            }
            return (
                <div key={client._id}>
                    <Li link={link}>
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
                            {userData?.role === "superAdmin" && 
                                <MyButton
                                    click={() => {
                                        setDeleteObject(client._id)
                                        setDeleteModal(true)
                                        // deleteClient(client._id);
                                    }}
                                >
                                    Удалить
                                </MyButton>
                            }
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