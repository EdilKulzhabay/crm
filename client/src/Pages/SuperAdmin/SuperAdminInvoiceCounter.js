import { useEffect, useState } from "react";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import MyButton from "../../Components/MyButton";
import MyInput from "../../Components/MyInput";
import LinkButton from "../../Components/LinkButton";
import MySnackBar from "../../Components/MySnackBar";
import useFetchUserData from "../../customHooks/useFetchUserData";

export default function SuperAdminInvoiceCounter() {
    const userData = useFetchUserData();
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const load = () => {
        setLoading(true);
        api.get("/getInvoiceGlobalCounter", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                if (data?.success && data.value != null) {
                    setValue(String(data.value));
                }
            })
            .catch((e) => {
                console.log(e);
                setOpen(true);
                setStatus("error");
                setMessage(e?.response?.data?.message || "Не удалось загрузить счётчик");
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const save = () => {
        api.post(
            "/setInvoiceGlobalCounter",
            { value: value.trim() },
            { headers: { "Content-Type": "application/json" } }
        )
            .then(({ data }) => {
                setOpen(true);
                setStatus("success");
                setMessage("Сохранено");
                if (data?.value != null) setValue(String(data.value));
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
                    <div>Глобальный номер следующего счёта</div>
                </div>
            </Div>
            <Div />
            <Div>
                <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-2">
                    <MyInput
                        value={value}
                        change={(e) => setValue(e.target.value)}
                        color="white"
                    />
                    <MyButton click={save}>Сохранить</MyButton>
                </div>
            </Div>
            <MySnackBar open={open} status={status} text={message} close={closeSnack} />
            <Div />
        </Container>
    );
}
