import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import MyButton from "../../Components/MyButton";
import MyInput from "../../Components/MyInput";
import api from "../../api";
import LinkButton from "../../Components/LinkButton";
import MySnackBar from "../../Components/MySnackBar";
import useScrollPosition from "../../customHooks/useScrollPosition";
import ConfirmDeleteModal from "../../Components/ConfirmDeleteModal";

export default function SuperAdminSubscription() {
    const scrollPosition = useScrollPosition();
    const [subscriptions, setSubscriptions] = useState([]);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteObject, setDeleteObject] = useState(null)

    const confirmDelete = () => {
        deleteSubscription(deleteObject)
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

    const [form, setForm] = useState({
        title: "",
        description: "",
        price: "",
        validity: "",
    });

    const changeHandler = (event) => {
        setForm({ ...form, [event.target.name]: event.target.value });
    };

    const getAllSubscriptions = () => {
        api.get("/getAllSubscriptions", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setSubscriptions(data.subscriptions);
        });
    };

    useEffect(() => {
        getAllSubscriptions();
    });

    const addSubscription = () => {
        if (
            form.title === "" ||
            form.description === "" ||
            form.price === "" ||
            form.validity === ""
        ) {
            setOpen(true);
            setStatus("error");
            setMessage("Заполните все поля");
            return;
        }

        api.post(
            "/addSubscription",
            { ...form },
            {
                headers: { "Content-Type": "application/json" },
            }
        ).then(({ data }) => {
            setSubscriptions(data.subscriptions);
        });
    };

    const deleteSubscription = (id) => {
        api.post(
            "/deleteSubscription",
            { id },
            {
                headers: { "Content-Type": "application/json" },
            }
        ).then(({ data }) => {
            if (data.success) {
                getAllSubscriptions();
            }
        });
    };

    return (
        <div className="relative">
            {deleteModal && <ConfirmDeleteModal
                closeConfirmModal={closeConfirmModal}
                confirmDelete={confirmDelete}
                scrollPosition={scrollPosition}
            />}
            <Container role="superAdmin">
                <Div>
                    <div>Настройки подписок</div>
                </Div>
                <Div />

                <Div>
                    <div>Создание новой подписки:</div>
                </Div>
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>Название подписки:</div>
                        <div className="text-red">
                            {" "}
                            [
                            <MyInput
                                color="red"
                                value={form.title}
                                change={changeHandler}
                                name="title"
                            />
                            ]
                        </div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>Описание:</div>
                        <div className="text-red">
                            {" "}
                            [
                            <MyInput
                                color="red"
                                value={form.description}
                                change={changeHandler}
                                name="description"
                            />
                            ]
                        </div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>Цена:</div>
                        <div className="text-red">
                            {" "}
                            [
                            <MyInput
                                color="red"
                                value={form.price}
                                change={changeHandler}
                                name="price"
                            />
                            ]
                        </div>
                        <div>тенге</div>
                    </div>
                </Li>
                <Li>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <div>Срок действия:</div>
                        <div className="text-red">
                            {" "}
                            [
                            <MyInput
                                color="red"
                                value={form.validity}
                                change={changeHandler}
                                name="validity"
                            />
                            ]
                        </div>
                        <div>месяцев</div>
                    </div>
                </Li>
                <Li>
                    <MyButton click={addSubscription}>Создать подписку</MyButton>
                </Li>

                <Div />

                <Div>
                    <div>Список подписок:</div>
                </Div>
                {subscriptions.length > 0 &&
                    subscriptions.map((item) => (
                        <Li>
                            <div className="flex items-center gap-x-3 flex-wrap">
                                <div>Название:</div>
                                <div>"{item.title}"</div>
                                <div>|</div>
                                <div>Описание:</div>
                                <div>"{item.description}"</div>
                                <div>|</div>
                                <div>Цена:</div>
                                <div>{item.price} тенге</div>
                                <div>|</div>
                                <div>Срок:</div>
                                <div>{item.validity} месяц</div>

                                <LinkButton href="/">Редактировать</LinkButton>
                                <MyButton
                                    click={() => {
                                        setDeleteModal(true)
                                        setDeleteObject(item._id)
                                    }}
                                >
                                    Удалить
                                </MyButton>
                            </div>
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
        </div>
    );
}
