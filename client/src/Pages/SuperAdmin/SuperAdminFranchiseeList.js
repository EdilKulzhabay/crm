import { useEffect, useState } from "react";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";
import MyButton from "../../Components/MyButton";
import MyInput from "../../Components/MyInput";
import MySnackBar from "../../Components/MySnackBar";

export default function SuperAdminFranchiseeList() {
    const [search, setSearch] = useState("");
    const [franchisees, setFranchisees] = useState([]);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            getAllFranchisee();
        }
    };

    const searchFrinchisee = () => {
        api.post(
            "/searchFrinchisee",
            { str: search },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setFranchisees(data.franchisees);
            })
            .catch((e) => {
                console.log(e.response.data.message);
                setOpen(true);
                setMessage(e.response.data.message);
                setStatus("error");
            });
    };

    const getAllFranchisee = () => {
        api.get("/getAllFranchisee", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setFranchisees(data.franchisees);
                console.log(data.franchisees);
            })
            .catch((e) => {
                console.log(e.response.data.message);
            });
    };

    useEffect(() => {
        getAllFranchisee();
    }, []);

    const toggleStatus = (franchisee) => {
        if (franchisee.status === "active") {
            return "inActive";
        } else {
            return "active";
        }
    };

    const updateStatus = (franchisee) => {
        franchisee.status = toggleStatus(franchisee);
        api.post(
            "/updateFranchisee",
            { ...franchisee },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                getAllFranchisee();
            })
            .catch((e) => {
                setOpen(true);
                setMessage(e.response.data.message);
                setStatus("error");
            });
    };

    return (
        <Container role="superAdmin">
            <Div>
                <div>Управление франчайзи</div>
            </Div>
            <Div />
            <Div>
                <div>Пойск франчайзи:</div>
            </Div>
            <>
                <div className="lg:hidden">
                    <Div>
                        <MyInput
                            value={search}
                            change={handleSearch}
                            color="white"
                        />
                    </Div>
                    <Div>
                        <MyButton click={searchFrinchisee}>Найти</MyButton>
                    </Div>
                </div>
                <Div styles="hidden lg:flex">
                    <div className="flex items-center gap-x-4">
                        <MyInput
                            value={search}
                            change={handleSearch}
                            color="white"
                        />
                        <MyButton click={searchFrinchisee}>Найти</MyButton>
                    </div>
                </Div>
            </>

            <Div />
            <Div>
                <div>Список франчайзи:</div>
            </Div>

            {franchisees.length > 0 &&
                franchisees.map((item) => (
                    <div key={item._id}>
                        <Li>
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div>Имя: {item.fullName}</div>
                                <div>|</div>
                                <div>Статус:{"    "}</div>
                                <div>
                                    {item.status === "active"
                                        ? "Активен"
                                        : "Заблокирован"}
                                </div>
                                <div>
                                    <LinkButton
                                        color="red"
                                        href={`/updateFranchisee/${item._id}`}
                                    >
                                        Редактировать
                                    </LinkButton>
                                </div>
                                <div>
                                    <MyButton
                                        click={() => {
                                            updateStatus(item);
                                        }}
                                    >
                                        {item.status === "active"
                                            ? "Блокировать"
                                            : "Разблокировать"}
                                    </MyButton>
                                </div>
                            </div>
                        </Li>
                    </div>
                ))}

            <Div />
            <Div>
                <LinkButton href="/addFranchisee">
                    Добавить франчайзи
                </LinkButton>
            </Div>

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
