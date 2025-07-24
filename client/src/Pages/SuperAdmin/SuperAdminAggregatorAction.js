import { useState } from "react";
import api from "../../api"
import Container from "../../Components/Container"
import Div from "../../Components/Div"
import useFetchUserData from "../../customHooks/useFetchUserData"
import MyButton from "../../Components/MyButton"

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

        {!loading && <Div><img src="https://api.tibetskayacrm.kz/static/vrp_routes_visualization.png" alt="Маршруты курьеров" className="w-full" />
            </Div>}

        <Div />
    </Container>
}