import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api";
import Container from "../Components/Container";
import Div from "../Components/Div";
import MyButton from "../Components/MyButton";
import Li from "../Components/Li";
import MyInput from "../Components/MyInput";
import MySnackBar from "../Components/MySnackBar";
import LinkButton from "../Components/LinkButton";
import useScrollPosition from "../customHooks/useScrollPosition";
import ConfirmDeleteModal from "../Components/ConfirmDeleteModal";

export default function PromoCodeList() {
    const scrollPosition = useScrollPosition();
    const [userData, setUserData] = useState({});
    const [promoCodes, setPromoCodes] = useState([]);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const [search, setSearch] = useState("");

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteObject, setDeleteObject] = useState(null)

    const confirmDelete = () => {
        deletePromoCode(deleteObject)
        setDeleteModal(false)
        setDeleteObject(null)
    }

    const closeConfirmModal = () => {
        setDeleteModal(false)
        setDeleteObject(null)
    }

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setPromoCodes([]);
            setPage(1);
            setHasMore(true);
        }
    };

    const searchPromoCode = () => {
        setHasMore(false);
        api.post(
            "/searchPromoCode",
            { search },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setPromoCodes(data.promoCodes);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setUserData(data);
        });
    }, []);

    const loadMorePromoCodes = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        api.post(
            "/getPromoCodes",
            { page },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                // console.log(data);
                if (data.promoCodes.length === 0) {
                    setHasMore(false);
                } else {
                    setPromoCodes((prevPromoCodes) => [
                        ...prevPromoCodes,
                        ...data.promoCodes,
                    ]);
                    setPage(page + 1);
                }
            })
            .catch((e) => {
                console.log(e);
            });
        setLoading(false);
    }, [page, loading, hasMore]);

    useEffect(() => {
        if (hasMore) {
            loadMorePromoCodes();
        }
    }, [hasMore]);

    const observer = useRef();
    const lastPromoCodeElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMorePromoCodes();
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMorePromoCodes]
    );

    const deletePromoCode = (id) => {
        api.post(
            "/deletePromoCode",
            { id },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setOpen(true);
                setStatus(data.success ? "success" : "error");
                setMessage(data.message);
                setPromoCodes([]);
                setPage(1);
                setHasMore(true);
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
            <Container role={userData.role}>
                <Div>Список промокодов</Div>
                <Div />
                <Div>
                    <div>Поиск промокода:</div>
                </Div>
                <Div>
                    <div className="flex items-center flex-wrap gap-x-4">
                        <MyInput
                            value={search}
                            change={handleSearch}
                            color="white"
                        />
                        <MyButton click={searchPromoCode}>Найти</MyButton>
                    </div>
                </Div>
                <Div />
                <Div>Список промокодов:</Div>
                <div className="max-h-[100px] overflow-scroll">
                    {promoCodes &&
                        promoCodes.length > 0 &&
                        promoCodes.map((item, index) => {
                            if (promoCodes.length === index + 1) {
                                return (
                                    <div
                                        key={item._id}
                                        ref={lastPromoCodeElementRef}
                                    >
                                        <Li>
                                            <div className="flex items-center gap-x-3 flex-wrap">
                                                <div>Код:</div>
                                                <div>{item.title}</div>
                                                <div>|</div>
                                                <div>Цена за 12л:</div>
                                                <div>{item.price12}</div>
                                                <div>Цена за 19л:</div>
                                                <div>{item.price19}</div>
                                                <div>|</div>
                                                <div>
                                                    Возможность указывать время:
                                                </div>
                                                <div>
                                                    {item.addData
                                                        ? "Включена"
                                                        : "Отключена"}
                                                </div>
                                                <MyButton
                                                    click={() => {
                                                        setDeleteObject(item._id);
                                                        setDeleteModal(true)
                                                    }}
                                                >
                                                    Удалить
                                                </MyButton>
                                            </div>
                                        </Li>
                                    </div>
                                );
                            } else {
                                return (
                                    <div key={item._id}>
                                        <Li>
                                            <div className="flex items-center gap-x-3 flex-wrap">
                                                <div>Код:</div>
                                                <div>{item.title}</div>
                                                <div>|</div>
                                                <div>Цена за 12л:</div>
                                                <div>{item.price12}</div>
                                                <div>Цена за 19л:</div>
                                                <div>{item.price19}</div>
                                                <div>|</div>
                                                <div>
                                                    Возможность указывать время:
                                                </div>
                                                <div>
                                                    {item.addData
                                                        ? "Включена"
                                                        : "Отключена"}
                                                </div>
                                                <MyButton
                                                    click={() => {
                                                        setDeleteObject(item._id);
                                                        setDeleteModal(true)
                                                    }}
                                                >
                                                    Удалить
                                                </MyButton>
                                            </div>
                                        </Li>
                                    </div>
                                );
                            }
                        })}
                    {loading && <div>Загрузка...</div>}
                </div>

                <Div />

                <Div>
                    <LinkButton color="green" href="/addPromoCode">Добавить промокод</LinkButton>
                </Div>

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
