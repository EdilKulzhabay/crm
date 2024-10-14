import { useNavigate, useParams } from "react-router-dom";
import Container from "../Components/Container";
import { useEffect, useState } from "react";
import api from "../api";
import Div from "../Components/Div";
import MyButton from "../Components/MyButton";
import MySnackBar from "../Components/MySnackBar";
import UpdateClientData from "../Components/UpdateClientData";
import useScrollPosition from "../customHooks/useScrollPosition";
import ConfirmDeleteModal from "../Components/ConfirmDeleteModal";
import useFetchUserData from "../customHooks/useFetchUserData";

export default function DepartmentPage() {
    const scrollPosition = useScrollPosition();
    const userData = useFetchUserData();
    const navigate = useNavigate();
    const { id } = useParams();
    const [department, setDepartment] = useState({});

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteObject, setDeleteObject] = useState(null)

    const confirmDelete = () => {
        deleteDepartment()
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
        userNameOpen: false,
        userNameStr: "",
    });

    const handleChangesUpdates = (title, value) => {
        setUpdates({
            ...updates,
            [title]: value,
        });
    };

    const getDepartmentData = () => {
        api.post(
            "/getDepartmentData",
            { id },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                setDepartment(data.department);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        getDepartmentData()
    }, [])

    const updateDepartmentData = (field, value) => {
        api.post(
            "/updateDepartmentData",
            { departmentId: department._id, field, value },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.success) {
                    setOpen(true);
                    setStatus("success");
                    setMessage(data.message);
                    getDepartmentData(); // обновляем данные клиента после успешного обновления
                }
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const deleteDepartment = () => {
        api.post(
            "/deleteDepartment",
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

    return (
        <div className="relative">
            {deleteModal && <ConfirmDeleteModal
                closeConfirmModal={closeConfirmModal}
                confirmDelete={confirmDelete}
                scrollPosition={scrollPosition}
            />}
            <Container role={userData?.role}>
                <Div>Карточка сотрудника</Div>
                <Div />
                <Div>Личные данные:</Div>
                <>
                    <UpdateClientData
                        title="ФИО"
                        open={updates.fullNameOpen}
                        str={updates.fullNameStr}
                        name="fullName"
                        handleChange={handleChangesUpdates}
                        client={department}
                        updateClientData={updateDepartmentData}
                    />
                    <UpdateClientData
                        title="Имя пользователя"
                        open={updates.userNameOpen}
                        str={updates.userNameStr}
                        name="userName"
                        handleChange={handleChangesUpdates}
                        client={department}
                        updateClientData={updateDepartmentData}
                    />
                </>
                <Div />
                <Div>История:</Div>
                <div className="max-h-[180px] overflow-y-scroll">
                    {department.history && department.history.length > 0 && department.history.map((item, index) => {
                        return <div key={index}>
                            <Div>{item}</Div>
                        </div>
                    })}
                </div>
                

                <Div />
                <Div>Действия:</Div>
                <Div>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <MyButton click={() => {
                            setDeleteModal(true)
                        }}>Удалить сотрудника</MyButton>
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
    )
}