import { useEffect, useState } from "react";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import MyInput from "../Components/MyInput";
import MyButton from "../Components/MyButton";
import useFetchUserData from "../customHooks/useFetchUserData";
import Li from "../Components/Li";
import LinkButton from "../Components/LinkButton";
import MySnackBar from "../Components/MySnackBar";

export default function Support() {
    const userData = useFetchUserData();

    const [search, setSearch] = useState("");
    const [supportContacts, setSupportContacts] = useState([]);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            getSupportContacts();
        }
    };

    const searchClient = () => {
        api.post("/searchClient", { search }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setSupportContacts(data.supportContacts);
        });
    };

    const getSupportContacts = () => {
        api.get("/getSupportContacts", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setSupportContacts(data.supportContacts);
        });
    };

    useEffect(() => {
        getSupportContacts();
    }, []);

    const deleteSupportContact = (clientId) => {
        api.post("/deleteSupportContact", { clientId }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            if (data.success) {
                setSupportContacts(supportContacts.filter((contact) => contact.client._id !== clientId));
            } else {
                setMessage(data.message);
                setStatus("error");
                setOpen(true);
            }
        });
    };

    const closeSnack = () => {
        setOpen(false);
    };

    return <>
        <Container role={userData?.role}>
            
            <Div>
                <div>Поддержка</div>
            </Div>
            <Div />

            {/* <Div>
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
            <Div /> */}

            <Div>
                <div>Клиенты с последним сообщением:</div>
            </Div>
            <Div />
            { supportContacts.length > 0 && supportContacts.map((contact) => (
                <Li key={contact._id}>
                    <div>{contact.client.fullName || contact.client.userName}</div>
                    <div>|</div>
                    <div>{contact.lastMessage}</div>
                    <div>|</div>
                    <div>{contact.lastMessageTime}</div>
                    <div>|</div>
                    <LinkButton href={`/SupportChat/${contact.client._id}`}>Перейти</LinkButton>
                    <div>|</div>
                    <MyButton click={() => {
                        deleteSupportContact(contact.client._id);
                    }}>Удалить</MyButton>
                </Li>
            ))}

            <Div />
            <MySnackBar
                open={open}
                text={message}
                status={status}
                close={closeSnack}
            />
        </Container>
    </>
}