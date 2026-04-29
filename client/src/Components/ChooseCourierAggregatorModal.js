import { useState, useEffect } from "react";
import api from "../api";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";

export default function ChooseCourierAggregatorModal(props) {
    const [couriers, setCouriers] = useState([]);
    
    useEffect(() => {
        api.post('/getActiveCourierAggregatorsForBussinessCenter', { franchisee: props.franchisee }, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setCouriers(data.couriers)
        }).catch((e) => {
            console.log(e);
        })
    }, [props.franchisee])

    return (
        <div
            onClick={() => {
                props.closeCourierAggregatorsModal();
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
                    <div className="text-center">Выбор курьера</div>
                    <Div>Список курьеров:</Div>
                    {couriers.map((item, index) => {
                        return (
                            <div key={item._id}>
                                <Li>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-x-2 flex-wrap">
                                            <div>{item.fullName}</div>
                                        </div>
                                        <div className="min-w-max ml-5 lg:ml-10 flex items-center">
                                            <MyButton
                                                click={() => {
                                                    props.chooseCourierAggregator(item);
                                                }}
                                            >
                                                <span className="text-green-400">
                                                    Выбрать
                                                </span>
                                            </MyButton>
                                        </div>
                                    </div>
                                </Li>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
