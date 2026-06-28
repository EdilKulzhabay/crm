import { useEffect, useState } from "react";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import useFetchUserData from "../../customHooks/useFetchUserData";
import api from "../../api";
import Li from "../../Components/Li";
import LinkButton from "../../Components/LinkButton";
import MyButton from "../../Components/MyButton";
import ChooseFranchiseeModal from "../../Components/ChooseFranchiseeModal";
import ConfirmDeleteModal from "../../Components/ConfirmDeleteModal";
import useScrollPosition from "../../customHooks/useScrollPosition";

export default function AquaMarketList() {
    const userData = useFetchUserData();
    const scrollPosition = useScrollPosition();
    const [aquaMarkets, setAquaMarkets] = useState([]);
    const [franchiseeModal, setFranchiseeModal] = useState(false);
    const [assigningId, setAssigningId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const fetchAquaMarkets = () => {
        if (userData?._id) {
            api.post("/getAquaMarkets", { franchiseeId: userData?._id }, {
                headers: { "Content-Type": "application/json" },
            }).then(({ data }) => {
                setAquaMarkets(data.aquaMarkets);
            });
        }
    };

    useEffect(() => {
        fetchAquaMarkets();
    }, [userData?._id]);

    const openAssign = (aquaMarketId) => {
        setAssigningId(aquaMarketId);
        setFranchiseeModal(true);
    };

    const chooseFranchisee = (franchisee) => {
        setFranchiseeModal(false);
        api.post("/updateAquaMarketData", {
            aquaMarketId: assigningId,
            changeField: "franchisee",
            changeData: franchisee._id,
        }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            if (data.success) {
                fetchAquaMarkets();
            }
        });
        setAssigningId(null);
    };

    const confirmDelete = () => {
        api.post("/deleteAquaMarket", { aquaMarketId: deletingId }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            if (data.success) {
                fetchAquaMarkets();
            }
        });
        setDeletingId(null);
    };

    return (
        <Container role={userData?.role}>
            <Div>Список аквамаркетов</Div>
            <Div />
            {aquaMarkets.length > 0 && aquaMarkets.map((aquaMarket) => {
                return (
                    <Li key={aquaMarket._id}>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <a href={`/aquaMarket/history/${aquaMarket._id}`} className="text-blue-500 hover:text-green-500">{aquaMarket.address}</a>
                            {aquaMarket.franchisee && (
                                <span className="text-gray-500 text-sm">
                                    Франчайзи: {aquaMarket.franchisee?.fullName || aquaMarket.franchisee}
                                </span>
                            )}
                            <LinkButton href={`/aquaMarket/history/${aquaMarket._id}`}>История</LinkButton>
                            {userData?.role === "superAdmin" && (
                                <MyButton click={() => openAssign(aquaMarket._id)}>
                                    Назначить франчайзи
                                </MyButton>
                            )}
                            {userData?.role === "superAdmin" && (
                                <MyButton click={() => setDeletingId(aquaMarket._id)}>
                                    <span className="text-red-400">Удалить</span>
                                </MyButton>
                            )}
                        </div>
                    </Li>
                );
            })}
            <Div />
            {franchiseeModal && (
                <ChooseFranchiseeModal
                    closeFranchiseeModal={() => { setFranchiseeModal(false); setAssigningId(null); }}
                    chooseFranchisee={chooseFranchisee}
                    scrollPosition={scrollPosition}
                />
            )}
            {deletingId && (
                <ConfirmDeleteModal
                    closeConfirmModal={() => setDeletingId(null)}
                    confirmDelete={confirmDelete}
                    scrollPosition={scrollPosition}
                />
            )}
        </Container>
    );
}
