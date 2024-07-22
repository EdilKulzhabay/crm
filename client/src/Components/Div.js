export default function Div(props) {
    return (
        <div
            className={`${props.styles} bg-black text-white flex items-center gap-x-3 mt-1 lg:gap-x-5`}
        >
            <div className="lg:text-xl">|</div>
            {props.children}
        </div>
    );
}
