export default function MyInput(props) {
    const name = props.name || "";

    return (
        <input
            name={name}
            className={`bg-black outline-none border-b border-${props.color} border-dashed text-sm lg:text-base`}
            value={props.value}
            onChange={props.change}
        />
    );
}
