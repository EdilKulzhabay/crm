import { useNavigate, useParams } from "react-router-dom";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import MyButton from "../../Components/MyButton";
import { useEffect, useState } from "react";
import api from "../../api"

export default function SuperAdminCoincidencePage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [notification, setNotification] = useState({})

    useEffect(() => {
        api.post("/getNotificationDataForId", {id}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setNotification(data.notification)            
        }).catch((e) => {
            console.log(e);
        })
    }, [])

    const cancel = () => {
        navigate(-1);
    };

    const deleteNotification = () => {
        api.post("/deleteNotification", {id}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                cancel()
            }
        }).catch((e) => {
            console.log(e);
        })
    }

    return (
        <Container role="superAdmin">
            <Div>Совпадение по {notification?.matchesType === "client" ? "Клиенту" : "Заказу"}</Div>
            <Div />
            <Div>Совпадении: {notification?.matchedField?.includes("mail") && "почта "} {notification?.matchedField?.includes("fullName") && "наименование или ФИО "} {notification?.matchedField?.includes("phone") && "номер телефона "} {notification?.matchedField?.includes("addresses") && "адрес"}</Div>
            <Div />
            <div className="flex flex-col lg:flex-row lg:gap-x-5">
                <div className="lg:w-[33%]">
                    <Div>
                        <div className="w-full text-center">
                            Первый {notification?.first?.fullName}
                        </div>
                    </Div>
                    <Div>
                        {notification?.firstObject?.fullName}
                    </Div>
                    <Div>
                        {notification?.firstObject?.phone}
                    </Div>
                    <Div>
                        {notification?.firstObject?.addresses.length > 0 && notification?.firstObject?.addresses.map((item, index) => {
                            return <div key={item._id}>
                                Адрес {index + 1}: {item.street} {item.house}
                            </div>
                        })} 
                    </Div>
                </div>
                <div className="lg:hidden"><Div /></div>
                <div className="lg:w-[33%]">
                    <Div>
                        <div className="w-full text-center">
                            Второй {notification?.second?.fullName}
                        </div>
                    </Div>
                    <Div>
                        {notification?.secondObject?.fullName}
                    </Div>
                    <Div>
                        {notification?.secondObject?.phone}
                    </Div>
                    <Div>
                        {notification?.secondObject?.addresses.length > 0 && notification?.secondObject?.addresses.map((item, index) => {
                            return <div key={item._id}>
                                Адрес {index + 1}: {item.street} {item.house}
                            </div>
                        })} 
                    </Div>
                </div>
            </div>
            <Div />
            <Div>
            <div className="flex items-center gap-x-3">
                    <MyButton click={deleteNotification}>Удалить</MyButton>
                    <MyButton click={cancel}>Назад</MyButton>
                </div>
            </Div>
            <Div />
        </Container>
    )
}