import { useContext, useEffect, useState } from "react";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import Li2 from "../../Components/Li2";
import MyButton from "../../Components/MyButton";
import api from "../../api";
import MySnackBar from "../../Components/MySnackBar";
import LinkButton from "../../Components/LinkButton";
import ChangePassword from "../../Components/ChangePassword";
import { AuthContext } from "../../AuthContext";
import { useNavigate } from "react-router-dom";

export default function SuperAdminSettings() {
    const auth = useContext(AuthContext);
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [info, setInfo] = useState({});

    const closeSnack = () => {
        setOpen(false);
    };

    // const [notificationTypes, setNotificationTypes] = useState({
    //     order: false,
    //     client: true,
    // });

    const [users, setUsers] = useState([]);

    const getAllUsersNCouriers = () => {
        api.get("/getAllUsersNCouriers", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setUsers(data);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const getMe = () => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setInfo(data);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        getAllUsersNCouriers();
        getMe();
    }, []);

    const deleteUserOrCourier = (role, id) => {
        api.post(
            role === "courier" ? "/deleteCourier" : "/deleteUser",
            { userId: id },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.success) {
                    setOpen(true);
                    setStatus("success");
                    setMessage("Пользователь успешно удален");
                    getAllUsersNCouriers();
                } else {
                    setOpen(true);
                    setStatus("error");
                    setMessage(data.message);
                }
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const changeSnack = (resStatus, resMessage) => {
        setOpen(true);
        setStatus(resStatus ? "success" : "error");
        setMessage(resStatus ? "Пароль успешно изменен" : resMessage);
    };

    const updateNotificationStatus = (status) => {
        api.post(
            "/updateNotificationStatus",
            { status },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setOpen(true);
                setMessage(data.message);
                setStatus("success");
                getMe();
            })
            .catch((e) => {
                console.log(e);
            });
    };

    return (
        <Container role="superAdmin">
            <Div>Настройки</Div>
            <Div />
            <Div>Управление пользователями:</Div>
            <Li>Список пользователей:</Li>
            <div className="max-h-[100px] overflow-scroll">
                {users &&
                    users.length > 0 &&
                    users.map((item) => {
                        return (
                            <Li2 key={item._id}>
                                <div className="flex items-center gap-x-3 flex-wrap">
                                    <div>Имя:</div>
                                    <div>{item.fullName}</div>
                                    <div>|</div>
                                    <div>Роль:</div>
                                    <div>
                                        {!item.role
                                            ? "Курьер"
                                            : item.role === "superAdmin"
                                            ? "Франчайзер"
                                            : "Франчайзи"}
                                    </div>
                                    <div>|</div>
                                    <div>Статус:</div>
                                    <div>
                                        {item.status === "active"
                                            ? "Активен"
                                            : "Неактивен"}
                                    </div>
                                    <MyButton
                                        click={() => {
                                            deleteUserOrCourier(
                                                !item.role
                                                    ? "courier"
                                                    : "admin",
                                                item._id
                                            );
                                        }}
                                    >
                                        Удалить
                                    </MyButton>
                                </div>
                            </Li2>
                        );
                    })}
            </div>
            <Div />
            <Div>Настройки уведомлений:</Div>
            <Li>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <div>Статус уведомления:</div>
                    <div>
                        {info.notificationStatus === "active"
                            ? "Включено"
                            : "Отключено"}
                    </div>
                    <div className="flex items-center gap-x-2 flex-wrap text-red">
                        [
                        <button
                            className="text-red hover:text-blue-500"
                            onClick={() => {
                                updateNotificationStatus("active");
                            }}
                        >
                            Включить
                        </button>
                        <div>/</div>
                        <button
                            className="text-red hover:text-blue-500"
                            onClick={() => {
                                updateNotificationStatus("inActive");
                            }}
                        >
                            Отключить
                        </button>
                        ]
                    </div>
                </div>
            </Li>
            {/* <Li>Типы уведомления:</Li>
            <Li2>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyButton click={() => {}}>
                        {notificationTypes.order ? "✓" : "x"}
                    </MyButton>
                    <div>Заказы</div>
                </div>
            </Li2>
            <Li2>
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyButton click={() => {}}>
                        {notificationTypes.client ? "✓" : "x"}
                    </MyButton>
                    <div>Изменение статуса клиентов</div>
                </div>
            </Li2> */}
            <Div />
            <ChangePassword
                responce={(resStatus, resMessage) => {
                    changeSnack(resStatus, resMessage);
                }}
            />
            <Div />
            <Div>Действия:</Div>
            <Div>
                <LinkButton href="/superAdminAddFranchizer">
                    Добавить франчайзера
                </LinkButton>
                <LinkButton href="/superAdminClientManagment">
                    Управление клиентами
                </LinkButton>
                <MyButton
                    click={() => {
                        auth.logout();
                        navigate("/login");
                    }}
                >
                    Выйти
                </MyButton>
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
