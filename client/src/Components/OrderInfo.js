export default function OrderInfo(props) {
    return (
        <span className="text-red">
            [ <span className="text-white">{props.children}</span> ]
        </span>
    );
}