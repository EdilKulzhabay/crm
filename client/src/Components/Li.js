import Div from "./Div";

export default function Li(props) {
    return (
        <Div>
            <div className="flex items-center gap-x-3">
                <div className="h-px w-2 lg:w-3 bg-white"></div>
                {props.children}
            </div>
        </Div>
    );
}
