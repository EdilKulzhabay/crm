import { useCallback, useEffect, useState } from "react";
import api from "../../api";
import CarWashHistory from "../../Components/CarWash/CarWashHistory";
import { CarWashForm, CarWashUserForm } from "../../Components/CarWash/CarWashForms";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import LinkButton from "../../Components/LinkButton";
import MyButton from "../../Components/MyButton";
import MySnackBar from "../../Components/MySnackBar";
import { formatDate } from "../../Components/Partners/partnerFormat";
import useFetchUserData from "../../customHooks/useFetchUserData";

const STATUS_LABELS = Object.freeze({ active: "Активна", blocked: "Заблокирована" });
const USER_STATUS_LABELS = Object.freeze({ active: "Активен", blocked: "Заблокирован" });
const toggledStatus = (status) => (status === "active" ? "blocked" : "active");

/**
 * Автомойки-партнёры (купон −20% после доставки): точки, сотрудники кабинета мойки и история купонов.
 * Только суперадмин. Мойки и сотрудники блокируются, а не удаляются.
 */
export default function SuperAdminCarWashes() {
    const userData = useFetchUserData();
    const [carWashes, setCarWashes] = useState([]);
    /** null | { type: "carWash", carWash? } | { type: "user", carWashId, user? } */
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const showError = useCallback((message) => setError(message), []);

    const load = useCallback(() => {
        api.post("/getCarWashesAdmin")
            .then(({ data }) => setCarWashes(data.carWashes))
            .catch((e) => setError(e?.response?.data?.message || "Не удалось загрузить мойки"));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async (url, body, successText) => {
        try {
            await api.post(url, body);
            setEditing(null);
            setNotice(successText);
            load();
        } catch (e) {
            setError(e?.response?.data?.message || "Не удалось сохранить");
        }
    };

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
            <Div>Автомойки (купон на мойку после доставки)</Div>
            <Div>
                <span className="text-sm opacity-70">
                    Купон выдаётся за каждый доставленный заказ, пока есть хотя бы одна активная мойка. Вход сотрудников —{" "}
                    {window.location.origin}/carWashLogin
                </span>
            </Div>
            <Div>
                <MyButton click={() => setEditing({ type: "carWash" })}>Добавить мойку</MyButton>
            </Div>
            {editing?.type === "carWash" && !editing.carWash && (
                <CarWashForm
                    onSave={(body) => submit("/saveCarWashAdmin", body, "Мойка добавлена")}
                    onCancel={() => setEditing(null)}
                />
            )}
            <Div />
            {carWashes.length === 0 && <Div>Моек пока нет</Div>}
            {carWashes.map((carWash) => (
                <CarWashCard
                    key={carWash.id}
                    carWash={carWash}
                    editing={editing}
                    onEdit={setEditing}
                    onSubmit={submit}
                />
            ))}
            <Div />
            <CarWashHistory carWashes={carWashes} onError={showError} />
            <MySnackBar open={Boolean(error)} status="error" text={error} close={() => setError("")} />
            <MySnackBar open={Boolean(notice)} status="success" text={notice} close={() => setNotice("")} />
        </Container>
    );
}

function CarWashCard({ carWash, editing, onEdit, onSubmit }) {
    const isEditingCarWash = editing?.type === "carWash" && editing.carWash?.id === carWash.id;
    const isAddingUser = editing?.type === "user" && editing.carWashId === carWash.id && !editing.user;
    const nextStatus = toggledStatus(carWash.status);

    return (
        <div className="border-t border-white/20 py-2">
            <Div>
                <span className={carWash.status === "active" ? "" : "text-red"}>
                    {carWash.name} — {carWash.city}, {carWash.address}
                    {carWash.phone && `, ${carWash.phone}`} ({STATUS_LABELS[carWash.status]})
                </span>
            </Div>
            <Div>
                <MyButton click={() => onEdit({ type: "carWash", carWash })}>Изменить</MyButton>
                <MyButton
                    click={() =>
                        onSubmit("/setCarWashStatusAdmin", { carWashId: carWash.id, status: nextStatus }, "Статус мойки изменён")
                    }
                >
                    {nextStatus === "blocked" ? "Заблокировать" : "Разблокировать"}
                </MyButton>
                <MyButton click={() => onEdit({ type: "user", carWashId: carWash.id })}>Добавить сотрудника</MyButton>
            </Div>
            {isEditingCarWash && (
                <CarWashForm
                    carWash={carWash}
                    onSave={(body) => onSubmit("/saveCarWashAdmin", body, "Мойка сохранена")}
                    onCancel={() => onEdit(null)}
                />
            )}
            {isAddingUser && (
                <CarWashUserForm
                    carWashId={carWash.id}
                    onSave={(body) => onSubmit("/saveCarWashUserAdmin", body, "Сотрудник добавлен")}
                    onCancel={() => onEdit(null)}
                />
            )}
            {carWash.users.length === 0 && <div className="pl-6 text-sm opacity-70">Сотрудников нет</div>}
            {carWash.users.map((user) => (
                <CarWashUserRow
                    key={user.id}
                    carWashId={carWash.id}
                    user={user}
                    isEditing={editing?.type === "user" && editing.user?.id === user.id}
                    onEdit={onEdit}
                    onSubmit={onSubmit}
                />
            ))}
        </div>
    );
}

function CarWashUserRow({ carWashId, user, isEditing, onEdit, onSubmit }) {
    const nextStatus = toggledStatus(user.status);

    return (
        <div className="pl-6">
            <div className="flex flex-wrap items-center gap-x-3 text-sm lg:text-base">
                <span className={user.status === "active" ? "" : "text-red"}>
                    {user.fullName}, {user.phone} ({USER_STATUS_LABELS[user.status]}, вход: {formatDate(user.lastLoginAt)})
                </span>
                <MyButton click={() => onEdit({ type: "user", carWashId, user })}>Изменить</MyButton>
                <MyButton
                    click={() => onSubmit("/setCarWashUserStatusAdmin", { userId: user.id, status: nextStatus }, "Статус сотрудника изменён")}
                >
                    {nextStatus === "blocked" ? "Заблокировать" : "Разблокировать"}
                </MyButton>
            </div>
            {isEditing && (
                <CarWashUserForm
                    carWashId={carWashId}
                    user={user}
                    onSave={(body) => onSubmit("/saveCarWashUserAdmin", body, "Сотрудник сохранён")}
                    onCancel={() => onEdit(null)}
                />
            )}
        </div>
    );
}
