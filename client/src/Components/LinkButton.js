import { Link } from "react-router-dom";

export default function LinkButton(props) {
    const color = props.color || "";
    const isNewTab = props.children === "Просмотр"; // Проверка для новой вкладки

    const linkProps = isNewTab
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {};

    const linkClass =
        color === "green"
            ? "text-green-400 hover:text-blue-500"
            : "text-red hover:text-blue-500";

    return (
        <Link to={props.href} className={linkClass} {...linkProps}>
            [ {props.children} ]
        </Link>
    );
}