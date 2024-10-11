import { Link } from "react-router-dom";

export default function LinkButton(props) {
    const color = props.color || ""

    if (color === "green") {
        return (
            <Link to={props.href} className="text-green-400 hover:text-blue-500">
                [ {props.children} ]
            </Link>
        );
    } else {
        return (
            <Link to={props.href} className="text-red hover:text-blue-500">
                [ {props.children} ]
            </Link>
        );
    }
}
