import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import carWashApi, { getCarWashToken, setCarWashToken } from "../../carWashApi";
import LogoText from "../../icons/LogoText";

/** Вход сотрудника мойки по телефону и паролю. Аккаунты создаёт суперадмин на странице «Автомойки» */
export default function CarWashLogin() {
    const navigate = useNavigate();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (getCarWashToken()) navigate("/carWash", { replace: true });
    }, [navigate]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);
        try {
            const { data } = await carWashApi.post("/carWashLogin", { phone, password });
            setCarWashToken(data.token);
            navigate("/carWash", { replace: true });
        } catch (e) {
            setError(e?.response?.data?.message || "Не удалось войти. Проверьте интернет.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F4F4F5] flex justify-center px-4 py-10">
            <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col gap-y-4">
                <LogoText className="w-[180px] h-[40px]" />
                <span className="self-start text-xs text-[#606B85] bg-white rounded-md px-2 py-1">Для сотрудников автомойки</span>
                <h1 className="text-2xl font-medium text-black">Вход в кабинет</h1>
                <p className="text-sm text-[#606B85]">
                    Войдите под своим аккаунтом. Каждое использование купона сохранится на ваше имя.
                </p>
                <label className="flex flex-col gap-y-1 text-sm text-black">
                    Телефон сотрудника
                    <input
                        type="tel"
                        autoComplete="username"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+7 (___) ___-__-__"
                        style={{ fontSize: "16px" }}
                        className="w-full p-3 rounded-lg bg-white outline-none"
                    />
                </label>
                <label className="flex flex-col gap-y-1 text-sm text-black">
                    Пароль
                    <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Введите пароль"
                        style={{ fontSize: "16px" }}
                        className="w-full p-3 rounded-lg bg-white outline-none"
                    />
                </label>
                {error && <div className="text-sm text-red">{error}</div>}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-lg bg-[#D12A2A] text-white font-medium disabled:opacity-60"
                >
                    {isSubmitting ? "Входим…" : "Войти"}
                </button>
                <p className="text-xs text-[#606B85]">
                    Доступ выдаёт администратор «Тибетской». У каждого сотрудника свой аккаунт.
                </p>
            </form>
        </div>
    );
}
