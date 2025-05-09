import { useCallback, useEffect, useRef, useState } from "react";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import api from "../../api";
import LinkButton from "../../Components/LinkButton";
import MyButton from "../../Components/MyButton";
import MySnackBar from "../../Components/MySnackBar";
import useScrollPosition from "../../customHooks/useScrollPosition";
import ConfirmDeleteModal from "../../Components/ConfirmDeleteModal";
import useFetchUserData from "../../customHooks/useFetchUserData";

export default function SuperAdminCoincidence() {
    const userData = useFetchUserData();
    const scrollPosition = useScrollPosition();
    const [notifications, setNotifications] = useState([])
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteObject, setDeleteObject] = useState(null)

    const confirmDelete = () => {
        deleteNotification(deleteObject)
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

    const loadMoreNotifications = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        const franchiseeId = userData?._id
        const role = userData?.role
        api.post(
            "/getNotifications",
            { page, franchiseeId, role},
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.notifications.length === 0) {
                    setHasMore(false);
                } else {
                    setNotifications((prevNotifications) => [
                        ...prevNotifications,
                        ...data.notifications,
                    ]);
                    setPage(page + 1);
                }
            })
            .catch((e) => {
                console.log(e);
            });
        setLoading(false);
    }, [page, loading, hasMore, userData]);

    useEffect(() => {
        if (userData?._id && userData?.role && hasMore) {
            loadMoreNotifications();
        }
    }, [hasMore, userData]);

    const observer = useRef();
    const lastNotificationElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreNotifications();
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreNotifications]
    );

    const deleteNotification = (id) => {
        api.post("/deleteNotification", {id}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                setOpen(true)
                setStatus("success")
                setMessage("Cовпадние успешно удалено")
                setNotifications([]);
                setPage(1);
                setHasMore(true);
            } else {
                setOpen(true)
                setStatus("error")
                setMessage("Не удалось удалить совпадение")
            }
        }).catch((e) => {
            console.log(e);
        })
    }

    return (
        <div className="relative">
            {deleteModal && <ConfirmDeleteModal
                closeConfirmModal={closeConfirmModal}
                confirmDelete={confirmDelete}
                scrollPosition={scrollPosition}
            />}
            <Container role={userData?.role}>
                <Div>
                    Совпадение
                </Div>
                <Div/>
                <Div>
                    Список совпадении:
                </Div>
                <div className="max-h-[400px] overflow-scroll">
                    {notifications &&
                        notifications.length > 0 &&
                        notifications.map((item, index) => {
                            // console.log("item?.first?.fullName = ", item?.first?.fullName);
                            // console.log("item?.second?.fullName = ", item?.second?.fullName);
                            // console.log("userData._id = ", userData._id);
                            
                            if ((item?.first?._id === "66f15c557a27c92d447a16a0" || item?.second?._id === "66f15c557a27c92d447a16a0") && (item?.first?._id === "67010493e6648af4cb0213b7" || item?.second?._id === "67010493e6648af4cb0213b7") && userData._id === "67010493e6648af4cb0213b7") {
                                return null
                            }
                            if (notifications.length === index + 1) {
                                return (
                                    <div key={item._id} ref={lastNotificationElementRef}>
                                        <Li>
                                            <div className="flex items-center gap-x-2 flex-wrap">
                                                <div>({item?.first?.fullName} и {item?.second?.fullName})</div>
                                                <div>Совпадение по {item?.matchesType === "client" ? "Клиенту" : "Заказу"}</div>
                                                <div>Совпадения:{" "}
                                                    {item?.matchedField?.includes("phone") ? "номер телефона " : ""}
                                                    {item?.matchedField?.includes("addresses") ? "адрес " : ""}
                                                </div>
                                                {/*
                                                <LinkButton href={`/superAdminCoincidencePage/${item?._id}`}>Перейти</LinkButton>
                                                <MyButton click={() => {
                                                    setDeleteObject(item._id)
                                                    setDeleteModal(true)
                                                }}>Удалить</MyButton>
                                                */}
                                            </div>
                                        </Li>
                                    </div>
                                );
                            } else {
                                return (
                                    <div key={item._id}>
                                        <Li>
                                        <div className="flex items-center gap-x-2 flex-wrap">
                                                <div>({item?.first?.fullName} и {item?.second?.fullName})</div>
                                                <div>Совпадение по {item?.matchesType === "client" ? "Клиентам" : "Заказу"}</div>
                                                <div>{item?.firstObject?.fullName || item?.firstObject?.userName} и {item?.secondObject?.fullName || item?.secondObject?.userName}</div>
                                                
                                                {/* <LinkButton href={`/superAdminCoincidencePage/${item?._id}`}>Перейти</LinkButton>
                                                <MyButton click={() => {
                                                    setDeleteObject(item._id)
                                                    setDeleteModal(true)
                                                }}>Удалить</MyButton> */}
                                            </div>
                                        </Li>
                                    </div>
                                );
                            }
                        })}
                    {loading && <div>Загрузка...</div>}
                </div>

                <Div />
                <MySnackBar
                    open={open}
                    text={message}
                    status={status}
                    close={closeSnack}
                />
            </Container>
        </div>
    )
}