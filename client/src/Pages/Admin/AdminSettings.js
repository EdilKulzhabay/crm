import { useContext, useEffect, useState } from "react";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import MyButton from "../../Components/MyButton";
import api from "../../api";
import MySnackBar from "../../Components/MySnackBar";
import ChangePassword from "../../Components/ChangePassword";
import { AuthContext } from "../../AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminSettings() {
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

    const changeSnack = (resStatus, resMessage) => {
        setOpen(true);
        setStatus(resStatus ? "success" : "error");
        setMessage(resStatus ? "Пароль успешно изменен" : resMessage);
    };

    return (
        <Container role="admin">
            <Div>Настройки</Div>
            <Div />
            <ChangePassword
                responce={(resStatus, resMessage) => {
                    changeSnack(resStatus, resMessage);
                }}
            />
            <Div />
            <Div>Действия:</Div>
            <Div>
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
