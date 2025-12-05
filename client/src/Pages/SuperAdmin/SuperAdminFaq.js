import { useState, useEffect } from "react";
import api from "../../api";
import Div from "../../Components/Div";
import Li from "../../Components/Li";
import Li2 from "../../Components/Li2";
import MyButton from "../../Components/MyButton";
import LinkButton from "../../Components/LinkButton";
import Container from "../../Components/Container";
import clsx from "clsx";
import OrderInfo from "../../Components/OrderInfo";
import useFetchUserData from "../../customHooks/useFetchUserData";
import DataInput from "../../Components/DataInput";
import MySnackBar from "../../Components/MySnackBar";

export default function SuperAdminFaq() {
    const userData = useFetchUserData();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [faq, setFaq] = useState([]);
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const getFaq = () => {
        api.get("/getFaq", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setFaq(data.faq);
        });
    }

    useEffect(() => {
        getFaq();
    }, []);

    const addFaq = () => {
        api.post("/addFaq", { question, answer }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            if (data.success) {
                setOpen(true);
                setStatus("success");
                setMessage(data.message);
                getFaq();
            } else {
                setOpen(true);
                setStatus("error");
                setMessage(data.message);
            }
            setQuestion("");
            setAnswer("");
        });
    }

    const deleteFaq = (id) => {
        api.post("/deleteFaq", { id }, {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            if (data.success) {
                setOpen(true);
                setStatus("success");
                setMessage(data.message);
                getFaq();
            } else {
                setOpen(true);
                setStatus("error");
                setMessage(data.message);
            }
        });
    }

    return (
        <div className="relative">
            <Container role={userData?.role}>
                
                <Div>FAQ</Div>
                <Div />
                {faq.length > 0 && faq.map((item) => (
                    <div key={item._id}>
                        <Li>{item.question}</Li>
                        <Li2>{item.answer}</Li2>
                        <Li2><MyButton click={() => { deleteFaq(item._id); }}>Удалить</MyButton></Li2>
                    </div>
                ))}
                <Div />
                <Div>
                    <div>Добавить FAQ</div>
                </Div>
                <Div />
                <Li>Вопрос:</Li>
                <Li2>
                    <textarea size={13} style={{ fontSize: '16px' }} value={question} onChange={(e) => {setQuestion(e.target.value)}} className="bg-black text-white border border-white rounded-lg p-1 text-sm"></textarea>
                </Li2>
                <Li>Ответ:</Li>
                <Li2>
                    <textarea size={13} style={{ fontSize: '16px' }} value={answer} onChange={(e) => {setAnswer(e.target.value)}} className="bg-black text-white border border-white rounded-lg p-1 text-sm"></textarea>
                </Li2>
                <Li>
                    <MyButton click={addFaq}>Добавить</MyButton>
                </Li>

                <Div />
                <MySnackBar
                    open={open}
                    text={message}
                    status={status}
                    close={closeSnack}
                />
            </Container>
        </div>
    );
}
