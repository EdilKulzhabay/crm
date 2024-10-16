import Container from "../../Components/Container";
import Div from "../../Components/Div";
import LinkButton from "../../Components/LinkButton";
import useFetchUserData from "../../customHooks/useFetchUserData";

export default function DepartmentMain() {
    const userData = useFetchUserData()
    return <Container role={userData?.role}>
        <Div>
            Главная панель
        </Div>
        <Div />
        <Div>
            <LinkButton color="green" href={`/${userData?.receiving ? "departamentReceiving" : "departamentGiving"}`}>{userData?.receiving ? "Принять" : "Отпустить"}</LinkButton>
        </Div>
        <Div />
    </Container>
}