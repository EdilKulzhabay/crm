import { useNavigate, useParams } from "react-router-dom";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import MyButton from "../../Components/MyButton";
import { useEffect, useState } from "react";
import api from "../../api"
import useScrollPosition from "../../customHooks/useScrollPosition";
import ConfirmDeleteModal from "../../Components/ConfirmDeleteModal";
import useFetchUserData from "../../customHooks/useFetchUserData";
import LinkButton from "../../Components/LinkButton";

export default function SuperAdminCoincidencePage() {
    const userData = useFetchUserData();
    const scrollPosition = useScrollPosition();
    const navigate = useNavigate();
    const { id } = useParams();
    const [notification, setNotification] = useState({})
    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteObject, setDeleteObject] = useState(null)

    const confirmDelete = () => {
        deleteNotification()
        setDeleteModal(false)
        setDeleteObject(null)
    }

    const closeConfirmModal = () => {
        setDeleteModal(false)
        setDeleteObject(null)
    }

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

    const formatDate = (dateString) => {
        const date = new Date(dateString);
    
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы с 0, поэтому +1
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
    
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    };

    return (
        <div className="relative">
            {deleteModal && <ConfirmDeleteModal
                closeConfirmModal={closeConfirmModal}
                confirmDelete={confirmDelete}
                scrollPosition={scrollPosition}
            />}
            <Container role={userData?.role}>
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
                            Дата добавления: {formatDate(notification?.firstObject?.createdAt)}
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
                        <Div>
                            <LinkButton href={`/ClientPage/${notification?.firstObject?._id}`}>Перейти</LinkButton>
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
                            Дата добавления: {formatDate(notification?.secondObject?.createdAt)}
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
                        <Div>
                            <LinkButton href={`/ClientPage/${notification?.secondObject?._id}`}>Перейти</LinkButton>
                        </Div>
                    </div>
                </div>
                <Div />
                <Div>
                <div className="flex items-center gap-x-3">
                        <MyButton click={() => {
                            setDeleteModal(true)
                        }}>Удалить</MyButton>
                        <MyButton click={cancel}>Назад</MyButton>
                    </div>
                </Div>
                <Div />
            </Container>
        </div>
    )
}