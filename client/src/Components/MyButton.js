export default function MyButton(props) {
    return (
        <button className="text-red hover:text-blue-500" onClick={props.click}>
            [ {props.children} ]
        </button>
    );
}
