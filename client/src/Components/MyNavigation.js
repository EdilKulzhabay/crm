import Div from "./Div";
import Li from "./Li";
import LinkButton from "./LinkButton";

const SAButtons = [
    {
        href: "/superAdmin",
        title: "Главная страница",
    },
    {
        href: "/orderList",
        title: "Заказы",
    },
    {
        href: "/clients",
        title: "Клиенты",
    },
    {
        href: "/promoCodeList",
        title: "Промокоды",
    },
    {
        href: "/couriers",
        title: "Курьеры",
    },
    {
        href: "/superAdminCoincidence",
        title: "Совпадение",
    },
    {
        href: "/sAAnalytics",
        title: "Аналитика",
    },
    {
        href: "/superAdminSettings",
        title: "Настройки",
    },
];

const AButtons = [
    {
        href: "/admin",
        title: "Главная страница",
    },
    {
        href: "/orderList",
        title: "Заказы",
    },
    {
        href: "/clients",
        title: "Клиенты",
    },
    {
        href: "/promoCodeList",
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
        href: "/adminCoincidence",
        title: "Совпадение",
    },
    {
        href: "/adminSettings",
        title: "Настройки",
    },
];

const CButtons = [
    {
        href: "/courier",
        title: "Главная страница",
    },
    {
        href: "/courierSettings",
        title: "Настройки",
    },
];

const DButtons = [
    {
        href: "/department",
        title: "Главная страница",
    },
    {
        href: "/departmentSettings",
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

    if (props.role === "admin") {
        return (
            <>
                <Div>
                    <div>Навигация:</div>
                </Div>
                <div className="lg:hidden">
                    {AButtons.map((item) => (
                        <Li key={item.href}>
                            <LinkButton href={item.href}>
                                {item.title}
                            </LinkButton>
                        </Li>
                    ))}
                </div>
                <Div styles="hidden lg:flex">
                    {AButtons.map((item) => (
                        <LinkButton key={item.href} href={item.href}>
                            {item.title}
                        </LinkButton>
                    ))}
                </Div>
            </>
        );
    }

    if (props.role === "courier") {
        return (
            <>
                <Div>
                    <div>Навигация:</div>
                </Div>
                <div className="lg:hidden">
                    {CButtons.map((item) => (
                        <Li key={item.href}>
                            <LinkButton href={item.href}>
                                {item.title}
                            </LinkButton>
                        </Li>
                    ))}
                </div>
                <Div styles="hidden lg:flex">
                    {CButtons.map((item) => (
                        <LinkButton key={item.href} href={item.href}>
                            {item.title}
                        </LinkButton>
                    ))}
                </Div>
            </>
        );
    }

    if (props.role === "department") {
        return (
            <>
                <Div>
                    <div>Навигация:</div>
                </Div>
                <div className="lg:hidden">
                    {DButtons.map((item) => (
                        <Li key={item.href}>
                            <LinkButton href={item.href}>
                                {item.title}
                            </LinkButton>
                        </Li>
                    ))}
                </div>
                <Div styles="hidden lg:flex">
                    {DButtons.map((item) => (
                        <LinkButton key={item.href} href={item.href}>
                            {item.title}
                        </LinkButton>
                    ))}
                </Div>
            </>
        );
    }
}
