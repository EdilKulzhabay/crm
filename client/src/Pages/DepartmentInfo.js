import { useEffect, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import useFetchUserData from "../customHooks/useFetchUserData";
import api from "../api";
import Li from "../Components/Li";
import LinkButton from "../Components/LinkButton";
import Info from "../Components/Info";

export default function DepartmentInfo() {
    const userData = useFetchUserData()

    const [info, setInfo] = useState(null)

    const getDepartmentInfo = () => {
        api.post("/getDepartmentInfo", {startDate: "2024-10-01", endDate: "2024-10-10"}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setInfo(data.franchisees)
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        getDepartmentInfo()
    }, [])

    return <Container role={userData?.role}>
        <Div>Сводные данные цеха</Div>
        <Div />
        <Div>Список Франчайзи:</Div>
        <Div />
        {info && info.length > 0 && info.map((item) => {
            return <div key={item?._id}>
                <Div>
                    {item?.fullName} <LinkButton href={`/departmentInfoFranchisee/${item?._id}`}>Просмотр</LinkButton>
                </Div>
                {item?.b121kol !== 9999 && <Li>Кол 12,5: <Info>{item?.b121kol}</Info></Li>}
                <Li>Кол 18,9 (1): <Info>{item?.b191kol}</Info></Li>
                <Li>Кол 18,9 (7): <Info>{item?.b197kol}</Info></Li>
            </div>
        })}
        <Div />
    </Container>
}