import { useEffect, useState } from "react";
import api from "../api";
import Div from "./Div";
import Li from "./Li";
import MyButton from "./MyButton";
import ConfirmChangeModal from "./ConfirmChangeModal";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_LENGTH = 2;

const partnerLabel = (partner) => `${partner.userName} · ${partner.phone} · ${partner.referralCode}`;

const bindingMessage = ({ partnerBonus = 0, clientBonus = 0, isFailed = false } = {}) => {
    if (isFailed) return ["Клиент привязан, но бонусы не начислены — сообщите разработчику", "error"];
    const credited = [
        partnerBonus > 0 && `партнёру +${partnerBonus} ₸`,
        clientBonus > 0 && `клиенту +${clientBonus} ₸`,
    ].filter(Boolean);
    const suffix = credited.length ? `: ${credited.join(", ")}` : " (бонусы уже были начислены ранее)";
    return [`Клиент привязан к партнёру${suffix}`, "success"];
};

/**
 * Партнёр клиента (приложение «Тибетская Партнёр»): показать, привязать, отвязать.
 * Только для суперадмина — сервер проверяет роль сам (utils/requireSuperAdmin.js).
 * Привязка — как регистрация по коду: партнёру +200 ₸ (новому — и при смене), клиенту +200 ₸ один раз.
 */
export default function ClientPartnerBinding({ clientId, onMessage, onClientUpdated }) {
    const [partner, setPartner] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadFailed, setIsLoadFailed] = useState(false);
    /** Изменение, ждущее кода и «кто / зачем», как при изменении баланса: { partnerId: string | null, title } */
    const [pendingChange, setPendingChange] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api.post("/getClientPartnerAdmin", { clientId })
            .then(({ data }) => {
                if (!cancelled) setPartner(data.partner);
            })
            .catch(() => {
                // Без всплывающего уведомления — пометка прямо в блоке
                if (!cancelled) setIsLoadFailed(true);
            })
            .finally(() => {
                if (!cancelled) setIsLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [clientId]);

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < SEARCH_MIN_LENGTH) {
            setResults([]);
            return undefined;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            api.post("/searchPartnersAdmin", { query: trimmed })
                .then(({ data }) => {
                    if (!cancelled) setResults(data.partners || []);
                })
                .catch(() => {
                    if (!cancelled) onMessage("Не удалось найти партнёров", "error");
                });
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, onMessage]);

    const save = async ({ changedBy, reason }) => {
        const { partnerId } = pendingChange;
        setPendingChange(null);
        setIsSaving(true);
        try {
            const { data } = await api.post("/setClientPartner", { clientId, partnerId, changedBy, reason });
            setPartner(data.partner);
            setIsLoadFailed(false);
            setQuery("");
            setResults([]);
            onMessage(...(partnerId ? bindingMessage(data.bonuses) : ["Клиент отвязан от партнёра", "success"]));
            // Баланс (бонус) и журнал операций изменились
            onClientUpdated?.();
        } catch (error) {
            onMessage(error?.response?.data?.message || "Не удалось изменить партнёра", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isLoaded) return null;

    return (
        <>
            <Div />
            {pendingChange && (
                <ConfirmChangeModal title={pendingChange.title} onConfirm={save} onCancel={() => setPendingChange(null)} />
            )}
            <Div>Партнёр (приложение «Тибетская Партнёр»):</Div>
            <Li>
                <div className="flex items-center gap-x-3 flex-wrap">
                    {partner ? (
                        <>
                            <div className="text-red">{partnerLabel(partner)}</div>
                            {!isSaving && (
                                <MyButton click={() => setPendingChange({ partnerId: null, title: "Отвязать клиента от партнёра" })}>
                                    Отвязать
                                </MyButton>
                            )}
                        </>
                    ) : (
                        <div>{isLoadFailed ? "Не удалось загрузить партнёра — обновите страницу" : "Не привязан"}</div>
                    )}
                </div>
            </Li>
            <Li>
                <div className="flex flex-col gap-y-2">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={partner ? "Сменить партнёра: имя, телефон или код" : "Найти партнёра: имя, телефон или код"}
                        style={{ fontSize: "16px" }}
                        className="bg-black outline-none border-b border-white border-dashed text-sm lg:text-base"
                    />
                    {results.map((item) => (
                        <div key={item.id} className="flex items-center gap-x-3 flex-wrap">
                            <div>{partnerLabel(item)}</div>
                            {item.id !== partner?.id && !isSaving && (
                                <MyButton click={() => setPendingChange({ partnerId: item.id, title: `Привязать к партнёру ${item.userName}` })}>
                                    Привязать
                                </MyButton>
                            )}
                        </div>
                    ))}
                    {query.trim().length >= SEARCH_MIN_LENGTH && results.length === 0 && <div>Партнёры не найдены</div>}
                    <div className="text-sm opacity-70">
                        Как регистрация по коду: партнёру +200 ₸, клиенту +200 ₸ (один раз). Прошлые заказы не учитываются.
                    </div>
                </div>
            </Li>
        </>
    );
}
