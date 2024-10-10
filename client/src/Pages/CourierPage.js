import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import MyButton from "../Components/MyButton";
import MySnackBar from "../Components/MySnackBar";
import UpdateClientData from "../Components/UpdateClientData";
import CourierDeliveredOrders from "../Components/CourierDeliveredOrders";
import LinkButton from "../Components/LinkButton";
import useScrollPosition from "../customHooks/useScrollPosition";
import ConfirmDeleteModal from "../Components/ConfirmDeleteModal";

export default function CourierPage() {
    const scrollPosition = useScrollPosition();
    const navigate = useNavigate();
    const { id } = useParams();
    const [role, setRole] = useState("");
    const [courier, setCourier] = useState({});

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteObject, setDeleteObject] = useState(null)

    const confirmDelete = () => {
        deleteCourier()
        setDeleteModal(false)
        setDeleteObject(null)
    }

    const closeConfirmModal = () => {
        setDeleteModal(false)
        setDeleteObject(null)
    }

    const closeSnack = () => {
        setOpen(false);
    };

    const [updates, setUpdates] = useState({
        fullNameOpen: false,
        fullNameStr: "",
        phoneOpen: false,
        phoneStr: "",
        mailOpen: false,
        mailStr: "",
    });

    const handleChangesUpdates = (title, value) => {
        setUpdates({
            ...updates,
            [title]: value,
        });
    };

    const getCourierData = () => {
        api.post(
            "/getCourierDataForId",
            { id },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                setCourier(data);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setRole(data.role);
            })
            .catch((e) => {
                console.log(e);
            });

        getCourierData();
    }, []);

    const updateCourierData = (field, value) => {
        api.post(
            "/updateCourierData",
            { courierId: courier._id, field, value },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.success) {
                    setOpen(true);
                    setStatus("success");
                    setMessage(data.message);
                    getCourierData(); // обновляем данные клиента после успешного обновления
                }
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const deleteCourier = () => {
        api.post(
            "/deleteCourier",
            { id },
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
                console.log(e);
            });
    };

    const changeSnackBar = (status, message) => {
        setOpen(true)
        setStatus(status)
        setMessage(message)
    }

    return (
        <div className="relative">
            {deleteModal && <ConfirmDeleteModal
                closeConfirmModal={closeConfirmModal}
                confirmDelete={confirmDelete}
                scrollPosition={scrollPosition}
            />}
            <Container role={role}>
                <Div>Карточка курьера</Div>
                <Div />
                <Div>Личные данные:</Div>
                <>
                    <UpdateClientData
                        title="Имя"
                        open={updates.fullNameOpen}
                        str={updates.fullNameStr}
                        name="fullName"
                        handleChange={handleChangesUpdates}
                        client={courier}
                        updateClientData={updateCourierData}
                    />
                    <UpdateClientData
                        title="Телефон"
                        open={updates.phoneOpen}
                        str={updates.phoneStr}
                        name="phone"
                        handleChange={handleChangesUpdates}
                        client={courier}
                        updateClientData={updateCourierData}
                    />
                    <UpdateClientData
                        title="Email"
                        open={updates.mailOpen}
                        str={updates.mailStr}
                        name="mail"
                        handleChange={handleChangesUpdates}
                        client={courier}
                        updateClientData={updateCourierData}
                    />
                </>

                <Div />
                <Div>Сводная информация:</Div>
                <Div>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <div>Количество выполненных заказов:</div>
                        <div className="text-red">{courier.completedOrders}</div>
                    </div>
                </Div>

                <Div />
                <Div>Возможность видеть весь список: {courier?.wholeList ? "Включен" : "Отключен"}</Div>
                <Div>
                    <MyButton click={() => {updateCourierData("wholeList", !courier?.wholeList)}}>{courier?.wholeList ? "Отключить" : "Включить"}</MyButton>
                </Div>

                <Div />
                <Div>
                    <LinkButton href={`/courierActiveOrders/${id}`}>Список активных заказов</LinkButton>
                </Div>
                {/* <CourierActiveOrders id={id} changeSnackBar={changeSnackBar} /> */}


                <Div />
                <Div>История заказов:</Div>
                <CourierDeliveredOrders id={id} />

                <Div />
                <Div>Действия:</Div>
                <Div>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <MyButton click={() => {
                            setDeleteModal(true)
                        }}>Удалить курьера</MyButton>
                    </div>
                </Div>

                <MySnackBar
                    open={open}
                    text={message}
                    status={status}
                    close={closeSnack}
                />
                <Div />
            </Container>
        </div>
    );
}
