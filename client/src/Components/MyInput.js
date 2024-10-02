export default function MyInput(props) {
    const name = props.name || "";
    const format = props?.format || ""

    if (format === "numeric") {
        return (
            <input
                name={name}
                className={`bg-black outline-none border-b border-${props.color} border-dashed text-sm lg:text-base`}
                value={props.value}
                size={11}
                inputMode="numeric"
                pattern="\d*"
                onKeyPress={(event) => {
                    if (!/[0-9]/.test(event.key)) {
                        event.preventDefault(); // блокирует ввод символов, кроме цифр
                    }
                }}
                onChange={props.change}
            />
        );
    } else {
        return (
            <input
                name={name}
                size={11}
                className={`bg-black outline-none border-b border-${props.color} border-dashed text-sm lg:text-base`}
                value={props.value}
                onChange={props.change}
            />
        );
    }
    
}
