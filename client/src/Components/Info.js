export default function Info(props) {
    const ml = props.ml || "ml-3"
    return (
        <span className={`text-red text-sm lg:text-base ${ml}`}>
            [ <span className="text-white">{props.children}</span> ]
        </span>
    );
}
