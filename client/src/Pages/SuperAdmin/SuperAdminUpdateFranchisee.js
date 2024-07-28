import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Info from "../../Components/Info";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";
import MyButton from "../../Components/MyButton";
import MySnackBar from "../../Components/MySnackBar";
import UpdateFranchiseeData from "../../Components/UpdateFranchiseeData";

const clients = [
    {
        _id: 1,
        fullName: "Андрей Смирнов",
    },
    {
        _id: 2,
        fullName: "Мария Иванова",
    },
];

export default function SuperAdminUpdateFranchisee() {
    const navigate = useNavigate();

    const { id } = useParams();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const [franchisee, setFranchisee] = useState({});

    const getFranchiseeById = () => {
        api.post(
            "/getFranchiseeById",
            { id },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setFranchisee(data.franchisee);
            })
            .catch((e) => {
                setOpen(true);
                setMessage(e.response.data.message);
                setStatus("error");
            });
    };

    useEffect(() => {
        getFranchiseeById();
    });

    const toggleStatus = () => {
        if (franchisee.status === "active") {
            return "inActive";
        } else {
            return "active";
        }
    };

    const updateFranchiseeStatus = () => {
        franchisee.status = toggleStatus();
        api.post(
            "/updateFranchisee",
            { ...franchisee },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setFranchisee(data.franchisee);
            })
            .catch((e) => {
                setOpen(true);
                setMessage(e.response.data.message);
                setStatus("error");
            });
    };

    const deleteFranchisee = () => {
        api.post(
            "/deleteFranchisee",
            { id: franchisee._id },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.success) {
                    navigate(-1);
                }
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
                <div>Франчайзи: {franchisee.fullName}</div>
            </Div>
            <Div />

            <Div>
                <div>Личные данные:</div>
            </Div>

            <UpdateFranchiseeData
                franchisee={franchisee}
                property="userName"
                getFranchiseeById={getFranchiseeById}
            />
            <UpdateFranchiseeData
                franchisee={franchisee}
                property="fullName"
                getFranchiseeById={getFranchiseeById}
            />
            <UpdateFranchiseeData
                franchisee={franchisee}
                property="phone"
                getFranchiseeById={getFranchiseeById}
            />
            <UpdateFranchiseeData
                franchisee={franchisee}
                property="mail"
                getFranchiseeById={getFranchiseeById}
            />

            <Div />

            <Div>
                <div>Сводные данные:</div>
            </Div>

            <>
                <Li>
                    <div className="flex items-center flex-wrap">
                        <div>Количество клиентов:</div>
                        <Info>20</Info>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center flex-wrap">
                        <div>Количество заказов:</div>
                        <Info>50</Info>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center flex-wrap">
                        <div>Прибыль:</div>
                        <Info>2 000 000 тенге</Info>
                    </div>
                </Li>
            </>

            <Div />

            <Div>
                <div className="flex items-center flex-wrap">
                    <div>Статус заказа:</div>
                    <Info>
                        {franchisee.status === "active"
                            ? "Активен"
                            : "Заблокирован"}
                    </Info>
                    <div className="ml-3">
                        <MyButton click={updateFranchiseeStatus}>
                            Изменить статус
                        </MyButton>
                    </div>
                </div>
            </Div>

            <Div />
            <Div>
                <div>Клиенты:</div>
            </Div>
            {clients.length > 0 &&
                clients.map((item) => (
                    <Li key={item._id}>
                        <div className="flex items-center gap-x-3">
                            <div>Клиент:</div>
                            <div>{item.fullName}</div>
                            <LinkButton>
                                Передать клиента другому франчайзи
                            </LinkButton>{" "}
                        </div>
                    </Li>
                ))}

            <Div />
            <Div>
                <MyButton click={deleteFranchisee}>Удалить франчайзи</MyButton>
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
