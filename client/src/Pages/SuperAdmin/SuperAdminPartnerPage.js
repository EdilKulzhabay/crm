import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api";
import ConfirmChangeModal from "../../Components/ConfirmChangeModal";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";
import MySnackBar from "../../Components/MySnackBar";
import PartnerClients from "../../Components/Partners/PartnerClients";
import { PartnerMonthly, PartnerTransactions } from "../../Components/Partners/PartnerHistory";
import PartnerPeriodFilter from "../../Components/Partners/PartnerPeriodFilter";
import PartnerStats from "../../Components/Partners/PartnerStats";
import PartnerVerification from "../../Components/Partners/PartnerVerification";
import PartnerWithdrawals from "../../Components/Partners/PartnerWithdrawals";
import { formatDate, formatDateTime, PARTNER_STATUS_LABELS } from "../../Components/Partners/partnerFormat";
import useFetchUserData from "../../customHooks/useFetchUserData";

/** Карточка партнёра: данные, блокировка, аналитика за период, заявки на вывод, клиенты, журнал */
export default function SuperAdminPartnerPage() {
    const { id } = useParams();
    const userData = useFetchUserData();
    const [period, setPeriod] = useState({ startDate: "", endDate: "" });
    const [details, setDetails] = useState(null);
    const [snack, setSnack] = useState({ text: "", status: "success" });
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

    const showMessage = useCallback((text, status) => setSnack({ text, status }), []);

    const load = useCallback(() => {
        api.post("/getPartnerDetailsAdmin", { partnerId: id, ...period })
            .then(({ data }) => setDetails(data))
            .catch((e) => showMessage(e?.response?.data?.message || "Не удалось загрузить партнёра", "error"));
    }, [id, period, showMessage]);

    useEffect(() => {
        load();
    }, [load]);

    const toggleStatus = async ({ changedBy, reason }) => {
        setIsStatusModalOpen(false);
        const isBlocking = details.partner.status === "active";
        try {
            await api.post("/setPartnerStatusAdmin", {
                partnerId: id,
                status: isBlocking ? "blocked" : "active",
                changedBy,
                reason,
            });
            showMessage(isBlocking ? "Партнёр заблокирован" : "Партнёр разблокирован", "success");
            load();
        } catch (e) {
            showMessage(e?.response?.data?.message || "Не удалось изменить статус", "error");
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

    if (!details) {
        return (
            <Container role={userData?.role}>
                <Div>Загрузка…</Div>
                <MySnackBar open={Boolean(snack.text)} status={snack.status} text={snack.text} close={() => setSnack({ text: "" })} />
            </Container>
        );
    }

    const { partner } = details;
    const isBlocked = partner.status === "blocked";

    return (
        <Container role={userData?.role}>
            {isStatusModalOpen && (
                <ConfirmChangeModal
                    title={
                        isBlocked
                            ? "Разблокировать партнёра?"
                            : "Заблокировать партнёра? Он не сможет войти и вывести деньги, его код перестанет работать. Клиенты и история сохранятся."
                    }
                    onConfirm={toggleStatus}
                    onCancel={() => setIsStatusModalOpen(false)}
                />
            )}
            <Div>
                <LinkButton href="/superAdminPartners">Все партнёры</LinkButton>
            </Div>
            <Div />
            <Div>Партнёр: {partner.userName}</Div>
            <Li>Телефон: {partner.phone}</Li>
            <Li>Код приглашения: {partner.referralCode}</Li>
            <Li>
                <div className="flex flex-wrap items-center gap-x-3">
                    <span className={isBlocked ? "text-red" : "text-green-400"}>
                        {PARTNER_STATUS_LABELS[partner.status] ?? partner.status}
                    </span>
                    <button className={isBlocked ? "text-green-400 hover:text-blue-500" : "text-red hover:text-blue-500"} onClick={() => setIsStatusModalOpen(true)}>
                        [ {isBlocked ? "Разблокировать" : "Заблокировать"} ]
                    </button>
                </div>
            </Li>
            <PartnerVerification
                partnerId={id}
                status={partner.verificationStatus}
                message={partner.verificationMessage}
                onChanged={load}
                onMessage={showMessage}
            />
            <Li>Зарегистрирован: {formatDate(partner.createdAt)}</Li>
            <Li>Последний вход: {formatDateTime(partner.lastLoginAt)} · устройств с уведомлениями: {partner.devices}</Li>
            <Li>
                Реквизиты: {partner.cardData?.accountNumber || "—"} · ИИН {partner.cardData?.IIN || "—"} ·{" "}
                {partner.cardData?.fullName || "—"}
            </Li>

            <Div />
            <Div>Заявки на вывод ({details.pendingWithdrawals.length}):</Div>
            <PartnerWithdrawals withdrawals={details.pendingWithdrawals} onResolved={load} onMessage={showMessage} />

            <Div />
            <Div>
                <PartnerPeriodFilter period={period} onChange={setPeriod} />
            </Div>
            <Div>Аналитика:</Div>
            <PartnerStats stats={partner} />

            <Div />
            <Div>По месяцам:</Div>
            <PartnerMonthly months={details.monthly} />

            <Div />
            <Div>Клиенты ({details.clients.length}):</Div>
            <PartnerClients
                partnerId={id}
                clients={details.clients}
                role={userData?.role}
                onChanged={load}
                onMessage={showMessage}
            />

            <Div />
            <Div>Операции за период:</Div>
            <PartnerTransactions transactions={details.transactions} />

            <MySnackBar open={Boolean(snack.text)} status={snack.status} text={snack.text} close={() => setSnack({ text: "" })} />
        </Container>
    );
}
