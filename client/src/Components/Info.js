import clsx from "clsx";

export default function Info(props) {
    const ml = props.ml || "ml-3"
    return (
        <span className={clsx("text-red text-sm lg:text-base", {
            "ml-1": ml === "ml-1",
            "ml-[-5px]": ml === "ml-0",
            "ml-3": ml === "ml-3"
        })}>
            [ <span className="text-white">{props.children}</span> ]
        </span>
    );
}
