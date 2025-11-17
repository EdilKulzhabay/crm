import { useNavigate } from "react-router-dom";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import MyButton from "../../Components/MyButton";

export default function AquaMarketSettings() {
    const navigate = useNavigate();
    
    return (
        <Container role="aquaMarket">
            <Div>Настройки</Div>
            <Div />
            <Div>Действия:</Div>
            <Div>
                <MyButton
                    click={() => {
                        localStorage.removeItem("aquaMarketData");
                        navigate("/aquaMarketlogin");
                    }}
                >
                    Выйти
                </MyButton>
            </Div>
            <Div />
        </Container>
    )
}