import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api"
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import useFetchUserData from "../../customHooks/useFetchUserData";
import LinkButton from "../../Components/LinkButton";
import MyButton from "../../Components/MyButton";
import MyInput from "../../Components/MyInput";
import Info from "../../Components/Info";
import clsx from "clsx";

export default function SuperAdminClientsVerify() {
    const userData = useFetchUserData()
    const [clients, setClients] = useState([])
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [sa, setSa] = useState(false);
    const [searchF, setSearchF] = useState("");
    const [totalClients, setTotalClients] = useState(0)

    const handleSearchF = (e) => {
        setSearchF(e.target.value);
        if (e.target.value === "") {
            setClients([]);
            setPage(1);
            setHasMore(true);
            setLoading(false)
            loadMoreClients(1, "", sa)
        }
    };

    const loadMoreClients = useCallback(async (page, searchF, sa) => {
        if (loading || !hasMore) return;
        setLoading(true);

        api.post(
            "/getNotVerifyClients",
            {
                page,
                searchF, 
                sa
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setTotalClients(data.totalClients)
                if (data.clients.length === 0) {
                    setHasMore(false);
                } else {
                    if (page === 1) {
                        setClients([...data.clients])
                    } else {
                        setClients((prevClients) => [...prevClients, ...data.clients]);
                    }
                    setPage(page + 1);
                }
            })
            .catch((e) => {
                console.log(e);
            });
        setLoading(false);
    }, [page, loading]);

    useEffect(() => {
        if (hasMore) {
            loadMoreClients(page, searchF, sa);
        }
    }, [hasMore]);


    const observer = useRef();
    const lastClientElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreClients(page, searchF, sa);
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreClients]
    );
    

    return <Container role={userData?.role}>
        <Div>Список новых клиентов</Div>
        <Div />
        <Div>
            Фильтрация по франчайзи:
        </Div>
        <Div>
            <div className="flex items-center flex-wrap gap-x-4">
                <MyInput
                    value={searchF}
                    change={handleSearchF}
                    color="white"
                />
                <MyButton click={() => {
                    setClients([]);
                    setPage(1);
                    setHasMore(true);
                    setLoading(false)
                    loadMoreClients(1, searchF, sa)
                }}>Найти</MyButton>
                <MyButton click={() => {
                    const saStatus = !sa
                    setClients([]);
                    setPage(1);
                    setHasMore(true);
                    setLoading(false)
                    loadMoreClients(1, searchF, saStatus)
                    setSa(saStatus)
                }}><span className={clsx("", {"text-yellow-300": sa})}>admin</span></MyButton>
            </div>
        </Div>

        <Div />
        <Div>
            Количество клиентов: <Info>{totalClients}</Info>
        </Div>

        <Div />
        <div className="max-h-[800px] overflow-scroll bg-black">
            {clients.map((client, index) => {
                if (clients.length === index + 1) {
                    return (
                        <div key={client?._id} ref={lastClientElementRef}>
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
                    )
                } else {
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
                }
            })}
        </div>
        <Div />
    </Container>
}