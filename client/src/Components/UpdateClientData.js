import Li from "./Li";
import MyButton from "./MyButton";
import MyInput from "./MyInput";

export default function UpdateClientData(props) {
    const { title, open, str, name, handleChange, client, updateClientData } =
        props;

    const handleSave = () => {
        handleChange(name + "Open", !open);
        updateClientData(name, str);
    };

    return (
        <Li>
            <div className="flex items-center gap-x-3 flex-wrap">
                <div>{title}:</div>
                {open ? (
                    <MyInput
                        color="red"
                        value={str}
                        change={(e) => {
                            handleChange(name + "Str", e.target.value);
                        }}
                    />
                ) : (
                    <div>
                        {name === "fullName" && client.fullName}
                        {name === "userName" && client.userName}
                        {name === "phone" && client.phone}
                        {name === "mail" && client.mail}
                        {name === "price12" && (
                            <span className="text-red">{client.price12}</span>
                        )}
                        {name === "price19" && (
                            <span className="text-red">{client.price19}</span>
                        )}
                        {(name === "price12" || name === "price19") && " тенге"}
                    </div>
                )}

                {open ? (
                    <div className="flex items-center gap-x-2 flex-wrap text-red">
                        [
                        <button
                            className="hover:text-blue-500"
                            onClick={handleSave}
                        >
                            <span className="text-green-400">
                                    Сохранить
                                </span>
                        </button>
                        <div>/</div>
                        <button
                            className="hover:text-blue-500"
                            onClick={() => {
                                handleChange(name + "Open", !open);
                            }}
                        >
                            <span className="text-green-400">
                                    Отменить
                                </span>
                        </button>
                        ]
                    </div>
                ) : (
                    <MyButton
                        click={() => {
                            handleChange(name + "Open", !open);
                        }}
                    >
                        Изменить
                    </MyButton>
                )}
            </div>
        </Li>
    );
}
