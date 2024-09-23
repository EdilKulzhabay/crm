import { Link } from "react-router-dom";

export default function LinkButton(props) {
    return (
        <Link to={props.href} className="text-red hover:text-blue-500">
            [ {props.children} ]
        </Link>
    );
}
