import { useCallback, useRef, useState, useEffect } from "react";
import api from "../api";
import DataInput from "../Components/DataInput";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";
import Info from "../Components/Info";
import LinkButton from "../Components/LinkButton";
import MySnackBar from "../Components/MySnackBar";
import Container from "../Components/Container";
import * as XLSX from "xlsx";
import ConfirmDeleteModal from "../Components/ConfirmDeleteModal";
import useScrollPosition from "../customHooks/useScrollPosition";
import useFetchUserData from "../customHooks/useFetchUserData";

export default function ClientList() {
    const scrollPosition = useScrollPosition();
    const userData = useFetchUserData();
    const [search, setSearch] = useState("");
    const [clients, setClients] = useState([]);
    const [filterClientStatus, setFilterClientStatus] = useState("all");

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteObject, setDeleteObject] = useState(null)

    const confirmDelete = () => {
        deleteClient(deleteObject)
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

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);

    const [dates, setDates] = useState({
        startDate: "",
        endData: "",
    });

    const [freeInfo, setFreeInfo] = useState({
        activeTotal: 0,
        inActiveTotal: 0,
        total: 0,
    });

    const handleDateChange = (e) => {
        let input = e.target.value.replace(/\D/g, ""); // Remove all non-digit characters
        if (input.length > 8) input = input.substring(0, 8); // Limit input to 8 digits

        const year = input.substring(0, 4);
        const month = input.substring(4, 6);
        const day = input.substring(6, 8);

        let formattedValue = year;
        if (input.length >= 5) {
            formattedValue += "-" + month;
        }
        if (input.length >= 7) {
            formattedValue += "-" + day;
        }

        setDates({ ...dates, [e.target.name]: formattedValue });
    };

    const handleFileChange = (event) => {
        setSelectedFile(event.target.files[0]);
    };

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setClients([]);
            setPage(1);
            setHasMore(true);
        }
    };

    const getFreeInfo = () => {
        api.get("/getFreeInfo", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setFreeInfo({
                    activeTotal: data.activeTotal,
                    inActiveTotal: data.inActiveTotal,
                    total: data.total,
                });
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        getFreeInfo();
    }, []);

    const searchClient = () => {
        setHasMore(false);
        api.post(
            "/searchClient",
            { search },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setClients(data);
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const loadMoreClients = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        api.post(
            "/getClients",
            { page, ...dates, status: filterClientStatus },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.clients.length === 0) {
                    setHasMore(false);
                } else {
                    setClients((prevClients) => [
                        ...prevClients,
                        ...data.clients,
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
            loadMoreClients();
        }
    }, [hasMore]);

    const observer = useRef();
    const lastClientElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreClients();
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreClients]
    );

    const deleteClient = (id) => {
        api.post(
            "/deleteClient",
            { id },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.success) {
                    setOpen(true);
                    setMessage("Клиент успешно удален");
                    setStatus("success");
                    const temporaryClients = clients.filter((item) => item._id !== id)
                    setClients(temporaryClients)
                    setDeleteModal(false)
                    setDeleteObject(null)
                }
            })
            .catch((e) => {
                console.log(e);
            });
    };

    useEffect(() => {
        if (!selectedFile) {
            return;
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        api.post("/api/upload-excel", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        })
            .then(({ data }) => {
                if (data.success) {
                    setOpen(true);
                    setMessage("Клиенты успешно добавлены");
                    setStatus("success");
                    setClients([]);
                    setPage(1);
                    setHasMore(true);
                    getFreeInfo();
                }
            })
            .catch((e) => {
                console.log(e);
            });
    }, [selectedFile]);

    const getClientsForExcel = () => {
        api.post(
            "/getClientsForExcel",
            { ...dates, status: filterClientStatus },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                const type = "clients";
                const clients = data.clients;

                const mappedData = clients.map((item) => {
                    let addresses = "";
                    item.addresses.map((item, index) => {
                        const address = `Адрес${index + 1} ${item.street} ${
                            item.house
                        }\n`;
                        addresses += address;
                    });
                    return {
                        "Имя Клиента": item.userName,
                        Адрес: addresses,
                        Номер: item.phone,
                        Почта: item.mail,
                        Цена19: item.price19,
                        Цена12: item.price12,
                        "Статус клиента":
                            item.status === "active" ? "Раб." : "Не раб.",
                        "Дата добавления": item.createdAt.slice(0, 10),
                        Бонусы: item.bonus,
                    };
                });

                const workbook = XLSX.utils.book_new();
                const worksheet = XLSX.utils.json_to_sheet(mappedData);
                XLSX.utils.book_append_sheet(
                    workbook,
                    worksheet,
                    type === "clients" ? "Clients" : "Orders"
                );
                const nowDate = new Date();
                const fileDate =
                    dates.startDate !== ""
                        ? `${dates.startDate} - ${dates.endData}`
                        : `${nowDate.getFullYear()}:${
                              nowDate.getMonth() + 1
                          }:${nowDate.getDate()}`;
                const fileName = `${fileDate}.xlsx`; // Убедитесь, что функция formatDate определена и возвращает строку

                XLSX.writeFile(workbook, fileName);
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
                <Div>
                    <div>Клиенты</div>
                </Div>
                <Div />

                <Div>
                    <div>Поиск клиента:</div>
                </Div>
                <Div>
                    <div className="flex items-center flex-wrap gap-x-4">
                        <MyInput
                            value={search}
                            change={handleSearch}
                            color="white"
                        />
                        <MyButton click={searchClient}>Найти</MyButton>
                    </div>
                </Div>
                <Div />
                <Div>Фильтры:</Div>
                <>
                    {/* <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>Статус клиента:</div>
                            <div className="flex items-center gap-x-2 flex-wrap text-red">
                                [
                                <button
                                    className="text-red hover:text-blue-500"
                                    onClick={() => {
                                        setFilterClientStatus("all");
                                    }}
                                >
                                    Все
                                </button>
                                <div>/</div>
                                <button
                                    className="text-red hover:text-blue-500"
                                    onClick={() => {
                                        setFilterClientStatus("active");
                                    }}
                                >
                                    Активные
                                </button>
                                <div>/</div>
                                <button
                                    className="text-red hover:text-blue-500"
                                    onClick={() => {
                                        setFilterClientStatus("inActive");
                                    }}
                                >
                                    Неактивные
                                </button>
                                ]
                            </div>
                            <MyButton
                                click={() => {
                                    setClients([]);
                                    setPage(1);
                                    setLoading(false);
                                    setHasMore(true);
                                    loadMoreClients();
                                }}
                            >
                                <span className="text-green-400">
                                Применить
                                </span>
                            </MyButton>
                        </div>
                    </Li> */}
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>Дата регистрации:</div>
                            <div className="text-red">
                                [
                                <DataInput
                                    color="red"
                                    value={dates.startDate}
                                    name="startDate"
                                    change={handleDateChange}
                                />
                                ]
                            </div>
                            <div> - </div>
                            <div className="text-red">
                                [
                                <DataInput
                                    color="red"
                                    value={dates.endData}
                                    name="endData"
                                    change={handleDateChange}
                                />
                                ]
                            </div>
                            <MyButton
                                click={() => {
                                    setClients([]);
                                    setPage(1);
                                    setLoading(false);
                                    setHasMore(true);
                                    loadMoreClients();
                                }}
                            >
                                <span className="text-green-400">
                                Применить
                                </span>
                            </MyButton>
                        </div>
                    </Li>
                </>

                <Div />

                <Div>Сводная информация:</Div>
                <>
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>Общее количество клиентов:</div>
                            <Info>{freeInfo.total}</Info>
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>Количество активных клиентов:</div>
                            <Info>{freeInfo.activeTotal}</Info>
                        </div>
                    </Li>
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>Количество неактивных клиентов:</div>
                            <Info>{freeInfo.inActiveTotal}</Info>
                        </div>
                    </Li>
                </>

                <Div />

                <Div>Список клиентов:</Div>
                <div className="max-h-[180px] overflow-scroll">
                    {clients.map((client, index) => {
                        if (clients.length === index + 1) {
                            return (
                                <div key={client._id} ref={lastClientElementRef}>
                                    <Li>
                                        <div className="flex items-center gap-x-2 flex-wrap">
                                            <div>{client.fullName}{client.fullName === "" && client.userName}</div>
                                            <div>|</div>
                                            <div>{client.phone}</div>
                                            <div>|</div>
                                            <div>
                                                {client.status === "active"
                                                    ? "Активен"
                                                    : "Неактивен"}
                                            </div>
                                            <LinkButton
                                                color="green"
                                                href={`/ClientPage/${client._id}`}
                                            >
                                                Редактировать
                                            </LinkButton>
                                            <MyButton
                                                click={() => {
                                                    setDeleteObject(client._id)
                                                    setDeleteModal(true)
                                                    // deleteClient(client._id);
                                                }}
                                            >
                                                Удалить
                                            </MyButton>
                                            {userData?.role === "superAdmin" && <span>{client?.franchisee?.fullName}</span>}
                                        </div>
                                    </Li>
                                </div>
                            );
                        } else {
                            return (
                                <div key={client._id}>
                                    <Li>
                                        <div className="flex items-center gap-x-2 flex-wrap">
                                            <div>{client.fullName}{client.fullName === "" && client.userName}</div>
                                            <div>|</div>
                                            <div>{client.phone}</div>
                                            <div>|</div>
                                            <div>
                                                {client.status === "active"
                                                    ? "Активен"
                                                    : "Неактивен"}
                                            </div>
                                            <LinkButton
                                                color="green"
                                                href={`/ClientPage/${client._id}`}
                                            >
                                                Редактировать
                                            </LinkButton>
                                            <MyButton
                                                click={() => {
                                                    setDeleteObject(client._id)
                                                    setDeleteModal(true)
                                                    // deleteClient(client._id);
                                                }}
                                            >
                                                Удалить
                                            </MyButton>
                                            {userData?.role === "superAdmin" && <span>{client?.franchisee?.fullName}</span>}
                                        </div>
                                    </Li>
                                </div>
                            );
                        }
                    })}
                    {loading && <div>Загрузка...</div>}
                </div>

                <Div />

                <Div>Действия:</Div>
                <Div>
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <LinkButton color="green" href="/addClinet">Добавить клиента</LinkButton>
                        <MyButton click={getClientsForExcel}>
                            Экспорт в excel
                        </MyButton>
                        <input
                            type="file"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            className="hidden"
                        />
                        <MyButton
                            click={() => {
                                fileInputRef.current.click();
                            }}
                        >
                            Импортировать с excel
                        </MyButton>
                        {selectedFile && (
                            <div className="text-red">{selectedFile.name}</div>
                        )}
                    </div>
                </Div>

                {/* {deleteModal && <div 
                    onClick={() => {
                        setDeleteModal(false)
                    }}
                    className="absolute inset-0 bg-black bg-opacity-80"
                >
                    <div
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center bg-black bg-opacity-80"
                        
                    >
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                            className="relative px-8 py-4 border border-red rounded-md"
                        >
                            <MyButton click={() => {deleteClient(deleteObject)}}>подтвердить удаление</MyButton>
                        </div>
                    </div>
                </div>} */}

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
