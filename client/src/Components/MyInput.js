export default function MyInput(props) {
    const name = props.name || "";
    const format = props?.format || ""

    if (props?.width === "qwe") {
        return (
            <input
                name={name}
                className={`w-[80px] lg:w-[160px] bg-black outline-none border-b border-${props.color} border-dashed text-sm lg:text-base`}
                value={props.value}
                size={13}
                style={{ fontSize: '16px' }}
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
    }

    if (format === "numeric") {
        return (
            <input
                name={name}
                className={`bg-black outline-none border-b border-${props.color} border-dashed text-sm lg:text-base`}
                value={props.value}
                size={13}
                style={{ fontSize: '16px' }}
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
                size={13}
                style={{ fontSize: '16px' }}
                className={`bg-black outline-none border-b border-${props.color} border-dashed text-sm lg:text-base`}
                value={props.value}
                onChange={props.change}
            />
        );
    }
    
}
