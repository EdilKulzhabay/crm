import { useState, useEffect } from "react";
import api from "../api";
import Div from "../Components/Div";
import Li from "../Components/Li";
import MyButton from "../Components/MyButton";
import MyInput from "../Components/MyInput";

export default function ChooseFranchiseeModal(props) {
    const [search, setSearch] = useState("");
    const [franchisees, setFranchisees] = useState([]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        if (e.target.value === "") {
            setFranchisees([]);
        }
    };

    const searchFrinchisee = () => {
        api.post(
            "/searchFrinchisee",
            { str: search },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                setFranchisees(data);
            })
            .catch((e) => {
                console.log(e);
            });
    };


    useEffect(() => {
        api.get("/getAllFranchisee", {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setFranchisees(data.franchisees)
        }).catch((e) => {
            console.log(e);
        })
    }, []);

    const choose = (franchisee) => {
        props.chooseFranchisee(franchisee);
    };

    return (
        <div
            onClick={() => {
                props.closeFranchiseeModal();
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
                    <div className="text-center">Выбор франчайзи</div>
                    <Div>
                        <div>Поиск франчайзи:</div>
                    </Div>
                    <Div>
                        <div className="flex items-center flex-wrap gap-x-4">
                            <MyInput
                                value={search}
                                change={handleSearch}
                                color="white"
                            />
                            <MyButton click={searchFrinchisee}>Найти</MyButton>
                        </div>
                    </Div>
                    <Div />
                    <Div>Список франчайзи:</Div>
                    <div className="max-h-[200px] overflow-scroll">
                        {franchisees.map((item, index) => {
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
                                                        choose(item);
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
        </div>
    );
}
