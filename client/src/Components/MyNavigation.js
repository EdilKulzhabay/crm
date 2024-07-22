import Div from "./Div";
import Li from "./Li";
import LinkButton from "./LinkButton";

const SAButtons = [
    {
        href: "/superAdmin",
        title: "Главная страница",
    },
    {
        href: "/orders",
        title: "Заказы",
    },
    {
        href: "/clients",
        title: "Клиенты",
    },
    {
        href: "/promoCode",
        title: "Промокоды",
    },
    {
        href: "/couriers",
        title: "Курьеры",
    },
    {
        href: "/analytics",
        title: "Аналитика",
    },
    {
        href: "/settings",
        title: "Настройки",
    },
];

export default function MyNavigation(props) {
    if (props.role === "superAdmin") {
        return (
            <>
                <Div>
                    <div>Навигация:</div>
                </Div>
                <div className="lg:hidden">
                    {SAButtons.map((item) => (
                        <Li key={item.href}>
                            <LinkButton href={item.href}>
                                {item.title}
                            </LinkButton>
                        </Li>
                    ))}
                </div>
                <Div styles="hidden lg:flex">
                    {SAButtons.map((item) => (
                        <LinkButton key={item.href} href={item.href}>
                            {item.title}
                        </LinkButton>
                    ))}
                </Div>
            </>
        );
    }
}
