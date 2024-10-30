import Div from "./Div";
import Pagada from "../icons/Pagada";

export default function Li(props) {
    const icon = props.icon || false
    return (
        <Div>
            <div className="flex items-center gap-x-3">
                {icon ? <Pagada className="w-[20px] h-[20px] shrink-0" /> : <div className="w-[20px] h-[20px] shrink-0 bg-white" />}
                
                {props.children}
            </div>
        </Div>
    );
}
