import { useEffect, useState } from "react";
import api from "../api";
import Div from "./Div";
import Li from "./Li";
import MyButton from "./MyButton";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_LENGTH = 2;

const partnerLabel = (partner) => `${partner.userName} · ${partner.phone} · ${partner.referralCode}`;

/**
 * Партнёр клиента (приложение «Тибетская Партнёр»): показать, привязать, отвязать.
 * Только для суперадмина — сервер проверяет роль сам (utils/requireSuperAdmin.js).
 * Ручная привязка бонусы не начисляет: 200 ₸ + 200 ₸ даются только при регистрации по коду.
 */
export default function ClientPartnerBinding({ clientId, onMessage }) {
    const [partner, setPartner] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.post("/getClientPartnerAdmin", { clientId })
            .then(({ data }) => {
                if (!cancelled) setPartner(data.partner);
            })
            .catch(() => {
                if (!cancelled) onMessage("Не удалось загрузить партнёра клиента", "error");
            })
            .finally(() => {
                if (!cancelled) setIsLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [clientId, onMessage]);

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

    const save = async (partnerId) => {
        if (partnerId === null && !window.confirm("Отвязать клиента от партнёра?")) return;
        setIsSaving(true);
        try {
            const { data } = await api.post("/setClientPartner", { clientId, partnerId });
            setPartner(data.partner);
            setQuery("");
            setResults([]);
            onMessage(partnerId ? "Клиент привязан к партнёру" : "Клиент отвязан от партнёра", "success");
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
            <Div>Партнёр (приложение «Тибетская Партнёр»):</Div>
            <Li>
                <div className="flex items-center gap-x-3 flex-wrap">
                    {partner ? (
                        <>
                            <div className="text-red">{partnerLabel(partner)}</div>
                            {!isSaving && <MyButton click={() => save(null)}>Отвязать</MyButton>}
                        </>
                    ) : (
                        <div>Не привязан</div>
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
                                <MyButton click={() => save(item.id)}>Привязать</MyButton>
                            )}
                        </div>
                    ))}
                    {query.trim().length >= SEARCH_MIN_LENGTH && results.length === 0 && <div>Партнёры не найдены</div>}
                    <div className="text-sm opacity-70">Ручная привязка бонусы не начисляет.</div>
                </div>
            </Li>
        </>
    );
}
