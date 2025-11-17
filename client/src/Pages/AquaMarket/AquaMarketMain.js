import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import api from "../../api";
import LinkButton from "../../Components/LinkButton";

export default function AquaMarketMain() {
    const [aquaMarket, setAquaMarket] = useState(null);

    useEffect(() => {
        const aquaMarketData = JSON.parse(localStorage.getItem("aquaMarketData"));
        console.log(aquaMarketData);
        if (aquaMarketData) {
            api.post(`/getAquaMarketData`, { aquaMarketId: aquaMarketData._id }, {
                headers: { "Content-Type": "application/json" },
            })
                .then(({ data }) => {
                    setAquaMarket(data.aquaMarket);
                })
                .catch((error) => {
                    console.log(error);
                });
        }
    }, []);

    return (
        <Container role="aquaMarket">
            <Div>Главная страница</Div>
            <Div />
            <Div>Количество полных бутылей:</Div>
            <Li>12,5 л: {aquaMarket?.full?.b12}</Li>
            <Li>18,9 л: {aquaMarket?.full?.b19}</Li>
            <Div />
            <Div>Количество пустых бутылей:</Div>
            <Li>12,5 л: {aquaMarket?.empty?.b12}</Li>
            <Li>18,9 л: {aquaMarket?.empty?.b19}</Li>
            <Div />
            <Div>Действия:</Div>
            <Li><LinkButton href="/aquaMarket/receiving">Принять бутыли</LinkButton></Li>
            <Li><LinkButton href="/aquaMarket/giving">Отпустить бутыли</LinkButton></Li>
            <Div />
        </Container>
    )
}