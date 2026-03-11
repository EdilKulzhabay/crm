import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import LogoText from "../icons/LogoText";
import MySnackBar from "../Components/MySnackBar";

export default function PaymentPage() {
    const navigate = useNavigate();
    const [amount, setAmount] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => setOpen(false);

    const validateForm = () => {
        const sum = Number(amount);
        if (!sum || sum < 1) {
            setOpen(true);
            setStatus("error");
            setMessage("Введите корректную сумму");
            return false;
        }
        const emailTrim = email?.trim();
        if (!emailTrim) {
            setOpen(true);
            setStatus("error");
            setMessage("Введите email");
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
            setOpen(true);
            setStatus("error");
            setMessage("Введите корректный email");
            return false;
        }
        const phoneClean = phone?.replace(/\D/g, "") || "";
        if (phoneClean.length < 10) {
            setOpen(true);
            setStatus("error");
            setMessage("Введите корректный номер телефона (минимум 10 цифр)");
            return false;
        }
        return { sum, emailTrim, phoneClean };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const validated = validateForm();
        if (!validated) return;

        const { sum, emailTrim, phoneClean } = validated;
        setLoading(true);

        try {
            const { data } = await api.post("/api/payment/create", {
                sum,
                email: emailTrim.toLowerCase(),
                phone: phoneClean,
            });

            if (!data?.success || !data?.paymentUrl) {
                setOpen(true);
                setStatus("error");
                setMessage(data?.message || "Ошибка при создании платежа");
                setLoading(false);
                return;
            }

            const paymentUrl = data.paymentUrl;
            const paymentWindow = window.open(paymentUrl, "payment", "width=600,height=700,scrollbars=yes");

            if (!paymentWindow || paymentWindow.closed) {
                window.location.href = paymentUrl;
                setLoading(false);
                return;
            }

            const handleMessage = (event) => {
                try {
                    const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                    if (data?.type === "payment-success") {
                        window.removeEventListener("message", handleMessage);
                        if (paymentWindow) paymentWindow.close();
                        navigate("/payment/success");
                    } else if (data?.type === "payment-error") {
                        setOpen(true);
                        setStatus("error");
                        setMessage(data?.message || "Ошибка оплаты");
                    }
                } catch (_) {}
            };

            window.addEventListener("message", handleMessage);

            const checkClosed = setInterval(() => {
                if (paymentWindow && paymentWindow.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener("message", handleMessage);
                }
            }, 500);

            setOpen(true);
            setStatus("success");
            setMessage("Открыто окно оплаты. Завершите платёж в открывшемся окне.");
        } catch (err) {
            console.error(err);
            setOpen(true);
            setStatus("error");
            setMessage(err?.response?.data?.message || "Ошибка при создании платежа");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex justify-center items-center bg-[url('./images/LoginBG.png')] bg-cover bg-no-repeat bg-center">
            <div className="lg:min-w-[450px] flex flex-col items-center px-6 pt-10 pb-14 bg-white rounded-xl shadow-xl">
                <div className="mt-1">
                    <LogoText className="w-[221px] h-[49px]" />
                </div>
                <h1 className="text-xl font-bold text-gray-800 mt-6 mb-2">Пополнение баланса</h1>
                <p className="text-sm text-gray-500 mb-6">Пополните баланс для оплаты заказов</p>

                <form onSubmit={handleSubmit} className="w-full space-y-4">
                    <div>
                        <label className="block w-full text-sm font-medium text-gray-700 mb-1">Сумма (тенге)</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block w-full text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block w-full text-sm font-medium text-gray-700 mb-1">Телефон *</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div className="w-full mt-6">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-[#DC1818] hover:bg-[#b81414] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                        >
                            {loading ? "Загрузка..." : "Оплатить"}
                        </button>
                    </div>
                </form>

                <div className="mt-4">
                    <button
                        type="button"
                        onClick={() => navigate("/")}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        Вернуться на главную
                    </button>
                </div>

                <MySnackBar open={open} text={message} status={status} close={closeSnack} />
            </div>
        </div>
    );
}
