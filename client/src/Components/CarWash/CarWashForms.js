import { useState } from "react";
import MyButton from "../MyButton";
import MyInput from "../MyInput";

/** Поле формы в стиле страниц суперадмина */
function Field({ label, value, onChange, type = "text" }) {
    return (
        <div className="flex flex-wrap items-center gap-x-3">
            <span className="text-sm opacity-70 min-w-[110px]">{label}</span>
            <MyInput value={value} change={(e) => onChange(e.target.value)} color="white" type={type} />
        </div>
    );
}

/** Создание (carWash не передан) или изменение точки мойки */
export function CarWashForm({ carWash, onSave, onCancel }) {
    const [form, setForm] = useState({
        name: carWash?.name ?? "",
        address: carWash?.address ?? "",
        city: carWash?.city ?? "Алматы",
        phone: carWash?.phone ?? "",
        mapUrl: carWash?.mapUrl ?? "",
    });
    const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

    return (
        <div className="flex flex-col gap-y-2 border border-white/30 rounded-md p-3 my-2">
            <Field label="Название" value={form.name} onChange={update("name")} />
            <Field label="Адрес" value={form.address} onChange={update("address")} />
            <Field label="Город" value={form.city} onChange={update("city")} />
            <Field label="Телефон точки" value={form.phone} onChange={update("phone")} />
            <Field label="Ссылка 2ГИС" value={form.mapUrl} onChange={update("mapUrl")} />
            <span className="text-sm opacity-70">
                В 2ГИС откройте мойку → «Поделиться» → скопируйте ссылку. В приложении адрес станет этой ссылкой.
            </span>
            <div className="flex gap-x-4">
                <MyButton click={() => onSave({ ...(carWash && { carWashId: carWash.id }), ...form })}>Сохранить</MyButton>
                <MyButton click={onCancel}>Отмена</MyButton>
            </div>
        </div>
    );
}

/** Создание или изменение сотрудника. При изменении пустой пароль = оставить прежний */
export function CarWashUserForm({ carWashId, user, onSave, onCancel }) {
    const [form, setForm] = useState({ fullName: user?.fullName ?? "", phone: user?.phone ?? "", password: "" });
    const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

    return (
        <div className="flex flex-col gap-y-2 border border-white/30 rounded-md p-3 my-2">
            <Field label="Имя" value={form.fullName} onChange={update("fullName")} />
            <Field label="Телефон (логин)" value={form.phone} onChange={update("phone")} />
            <Field
                label={user ? "Новый пароль" : "Пароль"}
                value={form.password}
                onChange={update("password")}
                type="password"
            />
            {user && <div className="text-sm opacity-70">Оставьте пароль пустым, чтобы не менять его</div>}
            <div className="flex gap-x-4">
                <MyButton click={() => onSave({ ...(user && { userId: user.id }), carWashId, ...form })}>Сохранить</MyButton>
                <MyButton click={onCancel}>Отмена</MyButton>
            </div>
        </div>
    );
}
