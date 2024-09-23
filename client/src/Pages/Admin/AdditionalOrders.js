import { useEffect, useState } from "react"
import Container from "../../Components/Container"
import Div from "../../Components/Div"
import api from "../../api"
import Li from "../../Components/Li"
import LinkButton from "../../Components/LinkButton"
import MyButton from "../../Components/MyButton"

export default function AdditionalOrders() {

    const [orders, setOrders] = useState([])

    useEffect(() => {
        api.get("/getAdditionalOrders", {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setOrders(data.orders)
        }).catch((e) => {
            console.log(e);
        })
    }, [])

    return <Container role="admin">
        <Div>Дополнительные заказы</Div>
        <Div />
        <div className="max-h-[100px] overflow-scroll">
                {orders.map((item, index) => {
                    return (
                        <div key={item._id}>
                            <Li>
                                <div className="flex items-center gap-x-3 flex-wrap">
                                    <div>
                                        Заказ: (
                                        {item.createdAt.slice(0, 10)})
                                    </div>
                                    <div>{item.client.fullName}</div>
                                    <a target="_blank" rel="noreferrer" href={item.address.link} className="text-blue-500 hover:text-green-500">{item.address.actual}</a>
                                    <div>{item.date.d} {item.date.time !== "" && item.date.time}</div>
                                    <div>{item.products.b12 !== 0 && `12.5л: ${item.products.b12}`}; {item.products.b19 !== 0 && `18.9л: ${item.products.b19}`}</div>
                                    
                                    <LinkButton
                                        href={`/orderPage/${item._id}`}
                                    >
                                        Просмотр
                                    </LinkButton>
                                </div>
                            </Li>
                        </div>
                    );
                    
                })}
            </div>
        <Div />
    </Container>
}