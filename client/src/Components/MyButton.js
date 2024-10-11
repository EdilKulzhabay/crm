export default function MyButton(props) {
    return (
        <button className="text-green-400 hover:text-blue-500" onClick={props.click}>
            [ {props.children} ]
        </button>
    );
}
