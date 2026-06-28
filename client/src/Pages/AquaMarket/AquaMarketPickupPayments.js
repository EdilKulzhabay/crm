import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import Info from "../../Components/Info";
import DataInput from "../../Components/DataInput";
import MyButton from "../../Components/MyButton";
import api from "../../api";
import useFetchUserData from "../../customHooks/useFetchUserData";

const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });
};

const formatAmount = (amount) => {
    return (amount || 0).toLocaleString('ru-RU') + ' ₸';
};

export default function AquaMarketPickupPayments() {
    const userData = useFetchUserData();
    const [payments, setPayments] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [cashAmount, setCashAmount] = useState(0);
    const [kaspiAmount, setKaspiAmount] = useState(0);
    const [startDate, setStartDate] = useState(getCurrentDate());
    const [endDate, setEndDate] = useState(getCurrentDate());

    const fetchPayments = () => {
        api.post("/getAquaMarketPickupPayments", { startDate, endDate }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            if (data.success) {
                setPayments(data.payments);
                setTotalAmount(data.totalAmount);
                setCashAmount(data.cashAmount);
                setKaspiAmount(data.kaspiAmount);
            }
        }).catch(console.error);
    };

    useEffect(() => {
        fetchPayments();
    }, []);

    const handleDateChange = (e) => {
        let input = e.target.value.replace(/\D/g, "");
        if (input.length > 8) input = input.substring(0, 8);
        const year = input.substring(0, 4);
        const month = input.substring(4, 6);
        const day = input.substring(6, 8);
        let formattedValue = year;
        if (input.length >= 5) formattedValue += "-" + month;
        if (input.length >= 7) formattedValue += "-" + day;
        if (e.target.name === "startDate") setStartDate(formattedValue);
        else setEndDate(formattedValue);
    };

    return (
        <Container role={userData?.role}>
            <Div>История платежей (самовывоз)</Div>
            <Div />
            <Div>
                <DataInput type="date" name="startDate" value={startDate} change={handleDateChange} />
                <DataInput type="date" name="endDate" value={endDate} change={handleDateChange} />
                <MyButton click={fetchPayments}>Применить</MyButton>
            </Div>
            <Div />
            {payments.length > 0 && (
                <>
                    <Div>Итого: <Info>{formatAmount(totalAmount)}</Info></Div>
                    <Li>Наличные: <Info>{formatAmount(cashAmount)}</Info></Li>
                    <Li>Каспи: <Info>{formatAmount(kaspiAmount)}</Info></Li>
                    <Li>Количество платежей: <Info>{payments.length}</Info></Li>
                    <Div />
                </>
            )}
            {payments.length === 0 && <Div>Платежей за выбранный период не найдено</Div>}
            {payments.map((payment) => (
                <Li key={payment._id}>
                    <div className="flex items-center flex-wrap gap-x-3">
                        <span>{payment.aquaMarket?.address || '—'}</span>
                        <Info>{formatAmount(payment.amount)}</Info>
                        <span className="text-gray-400 text-sm">
                            {payment.paymentType === "cash" ? "Наличные" : payment.paymentType === "kaspi" ? "Каспи" : "—"}
                        </span>
                        <span className="text-gray-400 text-sm">{formatDate(payment.createdAt)}</span>
                    </div>
                </Li>
            ))}
            <Div />
        </Container>
    );
}
