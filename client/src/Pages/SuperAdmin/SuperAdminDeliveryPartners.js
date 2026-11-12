import { useCallback, useEffect, useState } from "react";
import api from "../../api";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import LinkButton from "../../Components/LinkButton";
import MyButton from "../../Components/MyButton";
import MyInput from "../../Components/MyInput";
import MySnackBar from "../../Components/MySnackBar";
import { formatDate } from "../../Components/Partners/partnerFormat";
import useFetchUserData from "../../customHooks/useFetchUserData";

const STATUS_LABELS = Object.freeze({ active: "Активен", blocked: "Заблокирован" });
const toggledStatus = (status) => (status === "active" ? "blocked" : "active");
const SEARCH_MIN_LENGTH = 2;

/**
 * Партнёры по доставке: аккаунты кабинета /deliveryPartner и привязка к ним курьеров-агрегаторов.
 * Только суперадмин. Партнёры блокируются, а не удаляются; у курьера не больше одного партнёра.
 */
export default function SuperAdminDeliveryPartners() {
    const userData = useFetchUserData();
    const [partners, setPartners] = useState([]);
    /** null | { type: "partner", partner? } | { type: "courier", partnerId } */
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const load = useCallback(() => {
        api.post("/getDeliveryPartnersAdmin")
            .then(({ data }) => setPartners(data.deliveryPartners))
            .catch((e) => setError(e?.response?.data?.message || "Не удалось загрузить партнёров"));
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
            <Div>Партнёры по доставке</Div>
            <Div>
                <span className="text-sm opacity-70">
                    Партнёр видит заказы своих курьеров (без данных клиента) с дня привязки курьера. Вход —{" "}
                    {window.location.origin}/deliveryPartnerLogin
                </span>
            </Div>
            <Div>
                <MyButton click={() => setEditing({ type: "partner" })}>Добавить партнёра</MyButton>
            </Div>
            {editing?.type === "partner" && !editing.partner && (
                <PartnerForm
                    onSave={(body) => submit("/saveDeliveryPartnerAdmin", body, "Партнёр добавлен")}
                    onCancel={() => setEditing(null)}
                />
            )}
            <Div />
            {partners.length === 0 && <Div>Партнёров пока нет</Div>}
            {partners.map((partner) => (
                <PartnerCard
                    key={partner.id}
                    partner={partner}
                    editing={editing}
                    onEdit={setEditing}
                    onSubmit={submit}
                    onError={setError}
                />
            ))}
            <MySnackBar open={Boolean(error)} status="error" text={error} close={() => setError("")} />
            <MySnackBar open={Boolean(notice)} status="success" text={notice} close={() => setNotice("")} />
        </Container>
    );
}

function PartnerCard({ partner, editing, onEdit, onSubmit, onError }) {
    const isEditingPartner = editing?.type === "partner" && editing.partner?.id === partner.id;
    const isAddingCourier = editing?.type === "courier" && editing.partnerId === partner.id;
    const nextStatus = toggledStatus(partner.status);

    return (
        <div className="border-t border-white/20 py-2">
            <Div>
                <span className={partner.status === "active" ? "" : "text-red"}>
                    {partner.name}, {partner.phone} ({STATUS_LABELS[partner.status]}, вход: {formatDate(partner.lastLoginAt)})
                </span>
            </Div>
            <Div>
                <MyButton click={() => onEdit({ type: "partner", partner })}>Изменить</MyButton>
                <MyButton
                    click={() =>
                        onSubmit(
                            "/setDeliveryPartnerStatusAdmin",
                            { deliveryPartnerId: partner.id, status: nextStatus },
                            "Статус партнёра изменён"
                        )
                    }
                >
                    {nextStatus === "blocked" ? "Заблокировать" : "Разблокировать"}
                </MyButton>
                <MyButton click={() => onEdit({ type: "courier", partnerId: partner.id })}>Привязать курьера</MyButton>
            </Div>
            {isEditingPartner && (
                <PartnerForm
                    partner={partner}
                    onSave={(body) => onSubmit("/saveDeliveryPartnerAdmin", body, "Партнёр сохранён")}
                    onCancel={() => onEdit(null)}
                />
            )}
            {isAddingCourier && (
                <CourierPicker
                    partner={partner}
                    onPick={(courierId) =>
                        onSubmit("/setCourierDeliveryPartnerAdmin", { courierId, deliveryPartnerId: partner.id }, "Курьер привязан")
                    }
                    onCancel={() => onEdit(null)}
                    onError={onError}
                />
            )}
            {partner.couriers.length === 0 && <div className="pl-6 text-sm opacity-70">Курьеров нет</div>}
            {partner.couriers.map((courier) => (
                <div key={courier.id} className="pl-6 flex flex-wrap items-center gap-x-3 text-sm lg:text-base">
                    <span>
                        {courier.fullName}, {courier.phone}
                        {courier.carNumber && `, ${courier.carNumber}`} (с {formatDate(courier.linkedAt)})
                    </span>
                    <MyButton
                        click={() =>
                            onSubmit("/setCourierDeliveryPartnerAdmin", { courierId: courier.id, deliveryPartnerId: null }, "Курьер отвязан")
                        }
                    >
                        Отвязать
                    </MyButton>
                </div>
            ))}
        </div>
    );
}

function Field({ label, value, onChange, type = "text" }) {
    return (
        <div className="flex flex-wrap items-center gap-x-3">
            <span className="text-sm opacity-70 min-w-[110px]">{label}</span>
            <MyInput value={value} change={(e) => onChange(e.target.value)} color="white" type={type} />
        </div>
    );
}

/** Создание или изменение партнёра. При изменении пустой пароль = оставить прежний */
function PartnerForm({ partner, onSave, onCancel }) {
    const [form, setForm] = useState({ name: partner?.name ?? "", phone: partner?.phone ?? "", password: "" });
    const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

    return (
        <div className="flex flex-col gap-y-2 border border-white/30 rounded-md p-3 my-2">
            <Field label="Название" value={form.name} onChange={update("name")} />
            <Field label="Телефон (логин)" value={form.phone} onChange={update("phone")} />
            <Field label={partner ? "Новый пароль" : "Пароль"} value={form.password} onChange={update("password")} type="password" />
            {partner && <div className="text-sm opacity-70">Оставьте пароль пустым, чтобы не менять его</div>}
            <div className="flex gap-x-4">
                <MyButton click={() => onSave({ ...(partner && { deliveryPartnerId: partner.id }), ...form })}>Сохранить</MyButton>
                <MyButton click={onCancel}>Отмена</MyButton>
            </div>
        </div>
    );
}

/** Поиск курьера по ФИО или телефону; привязка к другому партнёру переносит курьера */
function CourierPicker({ partner, onPick, onCancel, onError }) {
    const [query, setQuery] = useState("");
    const [couriers, setCouriers] = useState(null);

    const search = async () => {
        if (query.trim().length < SEARCH_MIN_LENGTH) {
            onError(`Введите не меньше ${SEARCH_MIN_LENGTH} символов`);
            return;
        }
        try {
            const { data } = await api.post("/searchCouriersForDeliveryPartnerAdmin", { query: query.trim() });
            setCouriers(data.couriers);
        } catch (e) {
            onError(e?.response?.data?.message || "Не удалось найти курьеров");
        }
    };

    return (
        <div className="flex flex-col gap-y-2 border border-white/30 rounded-md p-3 my-2">
            <div className="flex flex-wrap items-center gap-x-3">
                <span className="text-sm opacity-70">ФИО или телефон курьера</span>
                <MyInput value={query} change={(e) => setQuery(e.target.value)} color="white" />
                <MyButton click={search}>Найти</MyButton>
                <MyButton click={onCancel}>Отмена</MyButton>
            </div>
            {couriers?.length === 0 && <div className="text-sm opacity-70">Никого не нашли</div>}
            {couriers?.map((courier) => {
                const isHere = courier.deliveryPartnerId === partner.id;
                const otherPartner = courier.deliveryPartnerId && !isHere ? courier.deliveryPartnerName || "другого партнёра" : null;
                return (
                    <div key={courier.id} className="flex flex-wrap items-center gap-x-3 text-sm">
                        <span>
                            {courier.fullName}, {courier.phone}
                            {courier.carNumber && `, ${courier.carNumber}`}
                            {otherPartner && <span className="text-red"> — сейчас у «{otherPartner}»</span>}
                        </span>
                        {isHere ? (
                            <span className="opacity-70">уже привязан</span>
                        ) : (
                            <MyButton click={() => onPick(courier.id)}>{otherPartner ? "Перенести сюда" : "Привязать"}</MyButton>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
