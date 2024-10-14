import Container from "../Components/Container";
import Div from "../Components/Div";
import useFetchUserData from "../customHooks/useFetchUserData";

export default function Analytics() {
    const userData = useFetchUserData()
    return (
        <Container role={userData?.role}>
            <Div>Аналитика</Div>
            <Div />
        </Container>
    )
}