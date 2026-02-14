import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import LogoText from "../icons/LogoText";
import MyInput from "../Components/MyInput";
import MySnackBar from "../Components/MySnackBar";

const API_BASE = "https://api.tibetskayacrm.kz";

export default function PaymentPage() {
    const navigate = useNavigate();
    const [amount, setAmount] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [saveCard, setSaveCard] = useState(true);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => setOpen(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const sum = Number(amount);
        if (!sum || sum < 1) {
            setOpen(true);
            setStatus("error");
            setMessage("Введите корректную сумму");
            return;
        }

        const emailTrim = email?.trim();
        if (!emailTrim) {
            setOpen(true);
            setStatus("error");
            setMessage("Введите email");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
            setOpen(true);
            setStatus("error");
            setMessage("Введите корректный email");
            return;
        }

        setLoading(true);

        try {
            let clientId = null;

            try {
                const { data: clientRes } = await api.post("/api/payment/get-client-by-email", {
                    email: emailTrim.toLowerCase(),
                });
                if (!clientRes?.clientId) {
                    setOpen(true);
                    setStatus("error");
                    setMessage("Клиент с таким email не найден. Зарегистрируйтесь в приложении.");
                    setLoading(false);
                    return;
                }
                clientId = clientRes.clientId;
            } catch (clientErr) {
                const msg = clientErr?.response?.data?.message || "Клиент с таким email не найден. Зарегистрируйтесь в приложении.";
                setOpen(true);
                setStatus("error");
                setMessage(msg);
                setLoading(false);
                return;
            }

            const { data: configRes } = await api.post("/api/payment/widget-config", {
                userId: clientId,
                amount: sum,
                email: emailTrim.toLowerCase(),
                currency: "KZT",
                description: "Пополнение баланса",
                test: 0,
                options: {
                    callbacks: {
                        result_url: `${API_BASE}/api/payment/callback`,
                    },
                },
                phone: phone?.replace(/\D/g, "") || undefined,
            });

            if (!configRes?.success || !configRes?.widgetPageUrl) {
                setOpen(true);
                setStatus("error");
                setMessage(configRes?.message || "Ошибка при создании платежа");
                setLoading(false);
                return;
            }

            const widgetUrl = configRes.widgetPageUrl;
            const widgetWindow = window.open(widgetUrl, "payment", "width=600,height=700,scrollbars=yes");

            if (!widgetWindow || widgetWindow.closed) {
                setOpen(true);
                setStatus("error");
                setMessage("Разрешите всплывающие окна для этого сайта и попробуйте снова.");
                setLoading(false);
                return;
            }

            const allowedOrigin = (() => {
                try { return new URL(API_BASE).origin; } catch (_) { return null; }
            })();

            const handleMessage = (event) => {
                if (allowedOrigin && event.origin !== allowedOrigin) return;
                try {
                    const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                    if (data?.type === "payment-success") {
                        window.removeEventListener("message", handleMessage);
                        if (widgetWindow) widgetWindow.close();
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
                if (widgetWindow && widgetWindow.closed) {
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
                            color="red"
                            format="numeric"
                        />
                    </div>

                    <div>
                        <label className="block w-full text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            color="red"
                        />
                    </div>

                    <div>
                        <label className="block w-full text-sm font-medium text-gray-700 mb-1">Телефон</label>
                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            color="red"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="saveCard"
                            checked={saveCard}
                            onChange={(e) => setSaveCard(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300"
                        />
                        <label htmlFor="saveCard" className="text-sm text-gray-700">
                            Сохранить карту для быстрой оплаты
                        </label>
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
