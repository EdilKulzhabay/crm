import { useEffect, useState } from "react";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import MyButton from "../../Components/MyButton";
import MyInput from "../../Components/MyInput";
import LinkButton from "../../Components/LinkButton";
import MySnackBar from "../../Components/MySnackBar";
import useFetchUserData from "../../customHooks/useFetchUserData";

export default function SuperAdminMobileOrderCutoff() {
    const userData = useFetchUserData();
    const [value, setValue] = useState("19");
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const load = () => {
        setLoading(true);
        api.get("/getMobileOrderCutoffSettings", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                if (data?.success && data.orderSameDayUntilHour != null) {
                    setValue(String(data.orderSameDayUntilHour));
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
        const n = Number(String(value).trim());
        if (!Number.isFinite(n) || n < 0 || n > 23) {
            setOpen(true);
            setStatus("error");
            setMessage("Укажите целое число от 0 до 23");
            return;
        }
        api.post(
            "/setMobileOrderCutoffSettings",
            { orderSameDayUntilHour: Math.floor(n) },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                setOpen(true);
                setStatus("success");
                setMessage("Сохранено");
                if (data?.orderSameDayUntilHour != null) {
                    setValue(String(data.orderSameDayUntilHour));
                }
            })
            .catch((e) => {
                setOpen(true);
                setStatus("error");
                setMessage(e?.response?.data?.message || "Ошибка сохранения");
            });
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
                    <div>Время приема заказов на сегодня</div>
                </div>
            </Div>
            <Div />
            <Div>
                <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-2">
                    <span>До</span>
                    <MyInput
                        value={value}
                        change={(e) => setValue(e.target.value)}
                        color="white"
                    />
                    <span>:00</span>
                    <MyButton click={save} disabled={loading}>
                        Сохранить
                    </MyButton>
                </div>
            </Div>
            <Div />
            <MySnackBar open={open} status={status} text={message} close={closeSnack} />
        </Container>
    );
}
