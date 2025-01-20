import Div from "./Div";
import Pagada from "../icons/Pagada";

export default function Li(props) {
    const icon = props.icon || false
    const link = props?.link
    const status = props?.status || ""

    const elemnt = () => {
        if (status === "inActive") {
            return <div className="w-[10px] h-[10px] mx-px shrink-0 bg-white" />
        }
        if (icon) {
            return <Pagada className="w-[12px] h-[12px] shrink-0" />
        }
        if (link === "waitingVerification" || link === "denyVerification") {
            return <div className="text-xl -mt-1.5">{" "} x {" "}</div>
        }
        return <div className="w-[12px] h-px shrink-0 bg-white" />
    }
    return (
        <Div>
            <div className="flex items-center gap-x-3">
                {elemnt()}
                {props.children}
            </div>
        </Div>
    );
}
