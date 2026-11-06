import { useEffect, useState } from "react";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import MyButton from "../../Components/MyButton";
import MyInput from "../../Components/MyInput";
import LinkButton from "../../Components/LinkButton";
import MySnackBar from "../../Components/MySnackBar";
import useFetchUserData from "../../customHooks/useFetchUserData";

export default function SuperAdminAppVersion() {
    const userData = useFetchUserData();
    const [value, setValue] = useState("");
    const [courierValue, setCourierValue] = useState("");
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState("");
    const [maintenanceSaving, setMaintenanceSaving] = useState(false);

    const load = () => {
        setLoading(true);
        api.get("/getAppVersionSettings", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                if (data?.success && data.latestAppVersion != null) {
                    setValue(String(data.latestAppVersion));
                }
                if (data?.success && data.latestCourierAppVersion != null) {
                    setCourierValue(String(data.latestCourierAppVersion));
                }
                if (data?.success) {
                    setMaintenanceEnabled(data.maintenanceEnabled === true);
                    setMaintenanceMessage(String(data.maintenanceMessage || ""));
                }
            })
            .catch((e) => {
                console.log(e);
                setOpen(true);
                setStatus("error");
                setMessage(e?.response?.data?.message || "Не удалось загрузить настройку");
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const save = () => {
        const trimmed = String(value).trim();
        if (!trimmed) {
            setOpen(true);
            setStatus("error");
            setMessage("Укажите версию приложения");
            return;
        }
        api.post(
            "/setAppVersionSettings",
            { latestAppVersion: trimmed },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                setOpen(true);
                setStatus("success");
                setMessage("Сохранено");
                if (data?.latestAppVersion != null) {
                    setValue(String(data.latestAppVersion));
                }
            })
            .catch((e) => {
                setOpen(true);
                setStatus("error");
                setMessage(e?.response?.data?.message || "Ошибка сохранения");
            });
    };

    const saveCourier = () => {
        const trimmed = String(courierValue).trim();
        if (!trimmed) {
            setOpen(true);
            setStatus("error");
            setMessage("Укажите версию приложения курьера");
            return;
        }
        api.post(
            "/setAppVersionSettings",
            { latestCourierAppVersion: trimmed },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                setOpen(true);
                setStatus("success");
                setMessage("Сохранено");
                if (data?.latestCourierAppVersion != null) {
                    setCourierValue(String(data.latestCourierAppVersion));
                }
            })
            .catch((e) => {
                setOpen(true);
                setStatus("error");
                setMessage(e?.response?.data?.message || "Ошибка сохранения");
            });
    };

    /** enabled — новое состояние; текст сохраняем вместе с ним */
    const saveMaintenance = (enabled) => {
        setMaintenanceSaving(true);
        api.post(
            "/setMaintenanceSettings",
            { enabled, message: maintenanceMessage },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                setMaintenanceEnabled(data?.maintenanceEnabled === true);
                setMaintenanceMessage(String(data?.maintenanceMessage || ""));
                setOpen(true);
                setStatus("success");
                setMessage(data?.maintenanceEnabled ? "Технические работы включены" : "Технические работы выключены");
            })
            .catch((e) => {
                setOpen(true);
                setStatus("error");
                setMessage(e?.response?.data?.message || "Ошибка сохранения");
            })
            .finally(() => setMaintenanceSaving(false));
    };

    const closeSnack = () => setOpen(false);

    if (userData?.role !== "superAdmin") {
        return (
            <Container role={userData?.role}>
                <Div>Нет доступа</Div>
                <LinkButton href="/superAdmin">Назад</LinkButton>
            </Container>
        );
    }

    return (
        <Container role={userData?.role}>
            <Div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div>Актуальная версия мобильного приложения (клиент)</div>
                </div>
            </Div>
            <Div />
            <Div>
                <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-2">
                    <span>Версия</span>
                    <MyInput
                        value={value}
                        change={(e) => setValue(e.target.value)}
                        color="white"
                    />
                    <MyButton click={save} disabled={loading}>
                        Сохранить
                    </MyButton>
                </div>
            </Div>
            <Div />
            <Div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div>Актуальная версия приложения курьера</div>
                </div>
            </Div>
            <Div />
            <Div>
                <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-2">
                    <span>Версия</span>
                    <MyInput
                        value={courierValue}
                        change={(e) => setCourierValue(e.target.value)}
                        color="white"
                    />
                    <MyButton click={saveCourier} disabled={loading}>
                        Сохранить
                    </MyButton>
                </div>
            </Div>
            <Div />
            <Div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div>Технические работы (клиентское приложение):</div>
                    <span className={maintenanceEnabled ? "text-red" : "text-green-400"}>
                        {maintenanceEnabled ? "включены — клиенты видят модалку" : "выключены"}
                    </span>
                </div>
            </Div>
            <Div />
            <Div>
                <div className="flex flex-col gap-y-2 w-full max-w-xl">
                    <span>Текст модалки (пусто — стандартный)</span>
                    <MyInput
                        value={maintenanceMessage}
                        change={(e) => setMaintenanceMessage(e.target.value)}
                        color="white"
                    />
                    <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-2">
                        {maintenanceEnabled ? (
                            <>
                                <MyButton click={() => saveMaintenance(false)} disabled={loading || maintenanceSaving}>
                                    Выключить
                                </MyButton>
                                <MyButton click={() => saveMaintenance(true)} disabled={loading || maintenanceSaving}>
                                    Сохранить текст
                                </MyButton>
                            </>
                        ) : (
                            <MyButton click={() => saveMaintenance(true)} disabled={loading || maintenanceSaving}>
                                Включить
                            </MyButton>
                        )}
                    </div>
                    <span className="text-gray-400 text-sm">
                        Приложение проверяет статус при запуске, при возврате в приложение и каждые 5 минут.
                    </span>
                </div>
            </Div>
            <Div />
            <MySnackBar open={open} status={status} text={message} close={closeSnack} />
        </Container>
    );
}
