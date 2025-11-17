import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import useFetchUserData from "../../customHooks/useFetchUserData";
import api from "../../api";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";

export default function AquaMarketList() {
    const userData = useFetchUserData();
    const [aquaMarkets, setAquaMarkets] = useState([]);

    useEffect(() => {
        if (userData?._id) {
            api.post("/getAquaMarkets", {franchiseeId: userData?._id}, {
                headers: { "Content-Type": "application/json" },
            }).then(({ data }) => {
                setAquaMarkets(data.aquaMarkets);
            });
        }
    }, [userData?._id]);

    return (
        <Container role={userData?.role}>
            <Div>Список аквамаркетов</Div>
            <Div />
            {aquaMarkets.length > 0 && aquaMarkets.map((aquaMarket) => {
                return (
                    <Li key={aquaMarket._id}>
                        <div className="flex items-center gap-x-3">
                            <a href={`/aquaMarket/history/${aquaMarket._id}`} className="text-blue-500 hover:text-green-500">{aquaMarket.address}</a>
                            <LinkButton href={`/aquaMarket/history/${aquaMarket._id}`}>История</LinkButton>
                        </div>
                    </Li>
                )
            })}
            <Div />
        </Container>
    )
}