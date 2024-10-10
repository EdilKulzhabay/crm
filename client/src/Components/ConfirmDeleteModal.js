import MyButton from "./MyButton";

export default function ConfirmDeleteModal(props) {
    return <>
        <div
            onClick={() => {
                props.closeConfirmModal();
            }}
            className="absolute inset-0 bg-black bg-opacity-80"
            style={{ minHeight: props.scrollPosition }} 
        >
            <div
                className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center bg-black bg-opacity-80"
                style={{ top: props.scrollPosition + 50 }} 
            >
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                    className="relative px-8 py-4 border border-red rounded-md"
                >
                    <div>
                        <MyButton click={() => {props.confirmDelete()}}>
                            <span className="text-green-400">Подтверить удаление</span>
                        </MyButton>
                    </div>
                </div>
            </div>
        </div>
    </>
}