import { useState } from "react";

export default function DataInput(props) {
    const name = props.name || "";
    // const [value, setValue] = useState("");

    // const handleInputChange = (e) => {
    //     let input = e.target.value.replace(/\D/g, ""); // Remove all non-digit characters
    //     if (input.length > 8) input = input.substring(0, 8); // Limit input to 8 digits

    //     const day = input.substring(0, 2);
    //     const month = input.substring(2, 4);
    //     const year = input.substring(4, 8);

    //     let formattedValue = day;
    //     if (input.length >= 3) {
    //         formattedValue += " / " + month;
    //     }
    //     if (input.length >= 5) {
    //         formattedValue += " / " + year;
    //     }

    //     setValue(formattedValue);
    // };
    return (
        <input
            name={name}
            className={`bg-black outline-none border-b border-${props.color} border-dashed text-sm lg:text-base placeholder:text-xs placeholder:lg:text-sm`}
            value={props.value}
            size={11}
            onChange={props.change}
            placeholder=" YYYY-MM-DD"
        />
    );
}
