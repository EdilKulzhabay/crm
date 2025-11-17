import { useState } from "react";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import useFetchUserData from "../../customHooks/useFetchUserData";
import MyInput from "../../Components/MyInput";
import Li from "../../Components/Li";
import MyButton from "../../Components/MyButton";
import ChooseFranchiseeModal from "../../Components/ChooseFranchiseeModal";
import useScrollPosition from "../../customHooks/useScrollPosition";
import { useNavigate } from "react-router-dom";
import api from "../../api";

export default function AddAquaMarket() {
    const userData = useFetchUserData();
    const navigate = useNavigate();
    const scrollPosition = useScrollPosition();
    const [franchisee, setFranchisee] = useState(null);
    const [form, setForm] = useState({
        franchisee: "",
        point: {
            lat: "",
            lon: "",
        },
        address: "",
        link: "",
        userName: "",
        password: "",
    });

    const [franchiseeModal, setFranchiseeModal] = useState(false);

    const closeFranchiseeModal = () => {
        setFranchiseeModal(false);
    };

    const chooseFranchisee = (chFranchisee) => {
        setFranchisee(chFranchisee);
        setForm({ ...form, franchisee: chFranchisee._id });
        setFranchiseeModal(false);
    };

    const changeHandler = (event) => {
        const { name, value } = event.target;

        if (name === "point.lat") {
            setForm({ ...form, point: { ...form.point, lat: value } });
            return;
        }

        if (name === "point.lon") {
            setForm({ ...form, point: { ...form.point, lon: value } });
            return;
        }

        setForm({ ...form, [name]: value });
    };

    const cancel = () => {
        navigate(-1);
    };

    const addAquaMarket = () => {
        api.post("/addAquaMarket", { ...form }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            if (data.success) {
                navigate(-1);
            }
        });
    };

    return (
        <Container role={userData?.role}>
            <Div>Создать аквамаркет</Div>
            <Div />
            <Div>Данные аквамаркета:</Div>
            <Li>
                <div className="flex items-center gap-x-3">
                    <div>Франчайзи: {franchisee?.fullName}</div>
                    <MyButton
                        click={() => {
                            setFranchiseeModal(true);
                        }}
                    >
                        Выбрать франчайзи
                    </MyButton>
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-3">
                    <div>Координаты:</div>
                    <MyInput
                        name="point.lat"
                        type="text"
                        placeholder="Широта"
                        value={form.point.lat}
                        change={(e) => {changeHandler(e)}}
                    />
                    <MyInput
                        name="point.lon"
                        type="text"
                        placeholder="Долгота"
                        value={form.point.lon}
                        change={(e) => {changeHandler(e)}}
                    />
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-3">
                    <div>Адрес:</div>
                    <MyInput
                        name="address"
                        type="text"
                        placeholder="Адрес"
                        value={form.address}
                        change={(e) => {changeHandler(e)}}
                    />
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-3">
                    <div>Ссылка:</div>
                    <MyInput
                        name="link"
                        type="text"
                        placeholder="Ссылка"
                        value={form.link}
                        change={(e) => {changeHandler(e)}}
                    />
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-3">
                    <div>Логин:</div>
                    <MyInput
                        name="userName"
                        type="text"
                        placeholder="Логин"
                        value={form.userName}
                        change={(e) => {changeHandler(e)}}
                    />
                </div>
            </Li>
            <Li>
                <div className="flex items-center gap-x-3">
                    <div>Пароль:</div>
                    <MyInput
                        name="password"
                        type="text"
                        placeholder="Пароль"
                        value={form.password}
                        change={(e) => {changeHandler(e)}}
                    />
                </div>
            </Li>
            <Div />
            <Li>
                <div className="flex items-center gap-x-3">
                    <MyButton click={addAquaMarket}>Создать аквамаркет</MyButton>
                    <MyButton click={cancel}>Отменить</MyButton>
                </div>
            </Li>
            {franchiseeModal && (
                <ChooseFranchiseeModal
                    closeFranchiseeModal={closeFranchiseeModal}
                    chooseFranchisee={chooseFranchisee}
                    scrollPosition={scrollPosition}
                />
            )}
        </Container>
    )
}