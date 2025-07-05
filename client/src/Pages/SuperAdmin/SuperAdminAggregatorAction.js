import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api"
import Container from "../../Components/Container"
import Div from "../../Components/Div"
import Li from "../../Components/Li"
import useFetchUserData from "../../customHooks/useFetchUserData"
import LinkButton from "../../Components/LinkButton"
import MyButton from "../../Components/MyButton"
import MyInput from "../../Components/MyInput"
import Info from "../../Components/Info"
import clsx from "clsx"

export default function SuperAdminAggregatorAction() {
    const userData = useFetchUserData()
    const [loading, setLoading] = useState(false)


    const startDistribution = async () => {
        setLoading(true)
        await api.get("/orTools")
        setLoading(false)
    }


    return <Container role={userData?.role}>
        <Div>Агрегатор курьеров </Div>
        <Div />
        <Div>
            <MyButton click={() => {startDistribution()}}>
                Начать распределение
            </MyButton>
        </Div>

        {loading && <Div>Распределение заказов...</Div>}

        {!loading && <Div><img src="/static/vrp_routes_visualization.png" alt="Маршруты курьеров" className="w-full" />
            </Div>}

        <Div />
    </Container>
}