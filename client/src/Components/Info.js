export default function Info(props) {
    return (
        <span className="ml-3 text-red text-sm lg:text-base">
            [ {props.children} ]
        </span>
    );
}
