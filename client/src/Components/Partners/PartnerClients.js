import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import ChooseClientModal from "../ChooseClientModal";
import ConfirmChangeModal from "../ConfirmChangeModal";
import Div from "../Div";
import Li from "../Li";
import MyButton from "../MyButton";
import { formatDate, formatTenge } from "./partnerFormat";

const activityLabel = (client) => {
    if (client.hasActiveOrder) return ["Заказ в работе", "text-green-400"];
    if (client.isLapsed) return [`Пропал: обычно раз в ${client.intervalDays} дн.`, "text-red"];
    if (!client.hasOrdered) return ["Ещё не заказывал", "opacity-70"];
    return [client.intervalDays ? `Заказывает раз в ${client.intervalDays} дн.` : "Заказывал", ""];
};

const bonusText = ({ partnerBonus = 0, clientBonus = 0, isFailed = false } = {}) => {
    if (isFailed) return "бонусы не начислены — сообщите разработчику";
    if (!partnerBonus && !clientBonus) return "бонусы уже были начислены ранее";
    return [partnerBonus && `партнёру +${formatTenge(partnerBonus)}`, clientBonus && `клиенту +${formatTenge(clientBonus)}`]
        .filter(Boolean)
        .join(", ");
};

/** Клиенты партнёра: ритм заказов, привязка нового (как регистрация по коду) и отвязка */
export default function PartnerClients({ partnerId, clients, role, onChanged, onMessage }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    /** { clientId, targetPartnerId, title } — ждёт кода и «кто / зачем» */
    const [pendingChange, setPendingChange] = useState(null);

    const setPartner = async ({ changedBy, reason }) => {
        const { clientId, targetPartnerId } = pendingChange;
        setPendingChange(null);
        setIsSaving(true);
        try {
            const { data } = await api.post("/setClientPartner", { clientId, partnerId: targetPartnerId, changedBy, reason });
            onMessage(
                targetPartnerId ? `Клиент привязан: ${bonusText(data.bonuses)}` : "Клиент отвязан",
                data.bonuses?.isFailed ? "error" : "success"
            );
            onChanged();
        } catch (error) {
            onMessage(error?.response?.data?.message || "Не удалось изменить партнёра клиента", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const bind = (client) => {
        setIsModalOpen(false);
        setPendingChange({
            clientId: client._id,
            targetPartnerId: partnerId,
            title:
                `Привязать «${client.userName || client.fullName}» к партнёру? Начислится бонус как при регистрации по коду. ` +
                "Если клиент привязан к другому партнёру — он будет перепривязан.",
        });
    };

    const unbind = (client) =>
        setPendingChange({
            clientId: client.id,
            targetPartnerId: null,
            title: `Отвязать «${client.name}» от партнёра? Начисленные бонусы не списываются.`,
        });

    return (
        <>
            {pendingChange && (
                <ConfirmChangeModal title={pendingChange.title} onConfirm={setPartner} onCancel={() => setPendingChange(null)} />
            )}
            {isModalOpen && (
                <ChooseClientModal closeClientsModal={() => setIsModalOpen(false)} chooseClient={bind} role={role} />
            )}
            <Li>
                {!isSaving && <MyButton click={() => setIsModalOpen(true)}>Привязать клиента</MyButton>}
            </Li>
            {clients.length === 0 && <Li>Клиентов пока нет</Li>}
            {clients.map((client) => {
                const [label, className] = activityLabel(client);
                return (
                    <Div key={client.id}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Link to={`/ClientPage/${client.id}`} className="text-red hover:text-blue-500">
                                {client.name}
                            </Link>
                            <span className="text-sm opacity-70">{client.phone}</span>
                            <span className="text-sm opacity-70">с {formatDate(client.registeredAt)}</span>
                            <span className={`text-sm ${className}`}>{label}</span>
                            {client.rhythmDays?.length > 0 && (
                                <span className="text-sm opacity-70">доставки: {client.rhythmDays.join(", ")}</span>
                            )}
                            {!isSaving && (
                                <button className="text-sm text-red hover:text-blue-500" onClick={() => unbind(client)}>
                                    [ Отвязать ]
                                </button>
                            )}
                        </div>
                    </Div>
                );
            })}
        </>
    );
}
