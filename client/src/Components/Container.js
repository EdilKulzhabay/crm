import MyNavigation from "./MyNavigation";

export default function Container(props) {
    return (
        <div className="min-h-screen bg-black text-white py-4 px-5 text-[15px] lg:text-lg">
            {props.children}
            <MyNavigation role={props.role} />
        </div>
    );
}
