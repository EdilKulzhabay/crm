import { useState } from "react";
import api from "../api";
import Li from "./Li";
import MyButton from "./MyButton";
import MyInput from "./MyInput";

/**
 * Дополнительные номера клиента: по любому из них клиент входит в приложение,
 * код подтверждения приходит в WhatsApp на введённый номер.
 * @param {{
 *   clientId: string,
 *   phones: string[],
 *   onSaved: () => void,
 *   onMessage: (text: string, status: "success" | "error") => void,
 * }} props
 */
export default function ClientAdditionalPhones({ clientId, phones, onSaved, onMessage }) {
    const [newPhone, setNewPhone] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const savePhones = async (nextPhones) => {
        setIsSaving(true);
        try {
            const { data } = await api.post("/updateClientAdditionalPhones", { clientId, phones: nextPhones });
            onMessage(data.message, "success");
            setNewPhone("");
            onSaved();
        } catch (e) {
            onMessage(e?.response?.data?.message || "Не удалось сохранить номера", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdd = () => {
        if (!newPhone.trim() || isSaving) return;
        savePhones([...phones, newPhone.trim()]);
    };

    const handleRemove = (phone) => {
        if (isSaving) return;
        savePhones(phones.filter((p) => p !== phone));
    };

    return (
        <Li>
            <div className="flex flex-col gap-y-1">
                <div>Дополнительные номера (вход в приложение):</div>
                {phones.length === 0 && <div className="text-gray-400 text-sm">Нет</div>}
                {phones.map((phone) => (
                    <div key={phone} className="flex items-center gap-x-3 flex-wrap">
                        <div>+{phone}</div>
                        <MyButton click={() => handleRemove(phone)}>Удалить</MyButton>
                    </div>
                ))}
                <div className="flex items-center gap-x-3 flex-wrap">
                    <MyInput
                        color="white"
                        value={newPhone}
                        change={(e) => setNewPhone(e.target.value)}
                    />
                    <MyButton click={handleAdd}>{isSaving ? "Сохранение..." : "Добавить"}</MyButton>
                </div>
            </div>
        </Li>
    );
}
