import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LogoText from "../icons/LogoText";
import MyButton from "../Components/MyButton";

export default function PaymentError() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get("orderId");
    const message = searchParams.get("message") || "Ошибка при обработке платежа";

    return (
        <div className="min-h-screen flex justify-center items-center bg-[url('./images/LoginBG.png')] bg-cover bg-no-repeat bg-center">
            <div className="lg:min-w-[450px] flex flex-col items-center px-6 pt-10 pb-14 bg-white rounded-xl">
                <div className="mt-1">
                    <LogoText className="w-[221px] h-[49px]" />
                </div>
                <div className="text-center mt-6">
                    <div className="text-4xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-red-600 mb-2">
                        Ошибка платежа
                    </h1>
                    <p className="text-sm text-[#606B85] mt-4">
                        {message}
                    </p>
                    {orderId && (
                        <p className="text-xs text-gray-500 mt-2">
                            Номер заказа: {orderId}
                        </p>
                    )}
                    <p className="text-xs text-gray-500 mt-4">
                        Пожалуйста, попробуйте еще раз или свяжитесь с поддержкой.
                    </p>
                </div>
                <div className="w-full mt-8 flex flex-col gap-3">
                    <MyButton
                        click={() => {
                            navigate("/");
                        }}
                    >
                        <span className="text-white">
                            Вернуться на главную
                        </span>
                    </MyButton>
                    <MyButton
                        click={() => {
                            navigate(-1);
                        }}
                    >
                        <span className="text-white">
                            Попробовать снова
                        </span>
                    </MyButton>
                </div>
            </div>
        </div>
    );
}

