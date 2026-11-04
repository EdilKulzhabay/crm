import BankTransactionsReview from "../../Components/Invoices/BankTransactionsReview";
import InvoiceList from "../../Components/Invoices/InvoiceList";
import Container from "../../Components/Container";
import Div from "../../Components/Div";
import LinkButton from "../../Components/LinkButton";
import useFetchUserData from "../../customHooks/useFetchUserData";

/** Счета юрлиц и поступления из выписки ForteBusiness. Только суперадмин */
export default function SuperAdminInvoices() {
    const userData = useFetchUserData();

    if (userData?.role !== "superAdmin") {
        return (
            <Container role={userData?.role}>
                <Div>Нет доступа</Div>
                <LinkButton href="/superAdmin">Назад</LinkButton>
            </Container>
        );
    }

    return (
        <Container role={userData?.role}>
            <Div>Счета юрлиц и поступления ForteBank</Div>
            <BankTransactionsReview />
            <InvoiceList />
            <Div />
            <LinkButton href="/superAdmin">Назад</LinkButton>
        </Container>
    );
}
