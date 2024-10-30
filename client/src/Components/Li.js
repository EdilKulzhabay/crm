import Div from "./Div";
import Pagada from "../icons/Pagada";

export default function Li(props) {
    const icon = props.icon || false
    return (
        <Div>
            <div className="flex items-center gap-x-3">
                {icon ? <Pagada className="w-3 h-3 shrink-0" /> : <div className="h-px w-2 lg:w-3 bg-white" />}
                
                {props.children}
            </div>
        </Div>
    );
}
