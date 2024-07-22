export default function MyButton(props) {
    return (
        <button className="text-red hover:text-blue-900" onClick={props.click}>
            [ {props.children} ]
        </button>
    );
}
