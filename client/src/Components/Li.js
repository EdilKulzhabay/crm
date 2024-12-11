import Div from "./Div";
import Pagada from "../icons/Pagada";

export default function Li(props) {
    const icon = props.icon || false
    const link = props.link === "verified" ? true : false
    return (
        <Div>
            <div className="flex items-center gap-x-3">
                {icon ? <Pagada className="w-[12px] h-[12px] shrink-0" /> : link ? <div className="text-xl -mt-1.5">{" "} x {" "}</div> :<div className="w-[12px] h-px shrink-0 bg-white" />}
                {props.children}
            </div>
        </Div>
    );
}
