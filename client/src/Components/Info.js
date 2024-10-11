export default function Info(props) {
    return (
        <span className="ml-3 text-red text-sm lg:text-base">
            [ <span className="text-white">{props.children}</span> ]
        </span>
    );
}
