import { useEffect, useState } from "react"
import Container from "../Components/Container"
import Div from "../Components/Div"
import api from "../api"
import Li from "../Components/Li"
import LinkButton from "../Components/LinkButton"

export default function CompletedOrders() {

    const [completedOrders, setCompletedOrders] = useState([])
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const loadMoreCompletedOrders = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        
        api.post(
            "/getCompletedOrders",
            {
                page,
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.completedOrders.length === 0) {
                    setHasMore(false);
                } else {
                    setCompletedOrders((prevCompletedOrders) => [...prevCompletedOrders, ...data.completedOrders]);
                    setPage(page + 1);
                }
            })
            .catch((e) => {
                console.log(e);
            });
        setLoading(false);
    }, [page, loading, hasMore]);

    useEffect(() => {
        if (hasMore) {
            loadMoreCompletedOrders();
        }
    }, [hasMore]);

    const observer = useRef();
    const lastOrderElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreCompletedOrders();
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreCompletedOrders]
    );

    return <Container role="admin">
        <Div>Завершенные заказы</Div>
        <Div />
            <div className="max-h-[180px] overflow-scroll">
                {completedOrders.map((item, index) => {
                    if (completedOrders.length === index + 1) {
                        return (
                            <div key={item?._id} ref={lastOrderElementRef}>
                                <Li>
                                    <div className="flex items-center gap-x-3 flex-wrap">
                                    <div>
                                            Заказ: (
                                            {item?.order?.createdAt?.slice(0, 10)})
                                        </div>
                                        <div>{item?.order?.client?.userName}</div>
                                        <a target="_blank" rel="noreferrer" href={item?.order?.address?.link} className="text-blue-500 hover:text-green-500">{item?.order?.address?.actual}</a>
                                        <div>{item?.order?.date?.d} {item?.order?.date?.time !== "" && item?.order?.date?.time}</div>
                                        <div>{item?.order?.products?.b12 !== 0 && `12.5л: ${item?.order?.products?.b12}`}; {item?.order?.products?.b19 !== 0 && `18.9л: ${item?.order?.products?.b19}`}</div>
                                        <LinkButton
                                            href={`/orderPage/${item?.order?._id}`}
                                        >
                                            Просмотр
                                        </LinkButton>
                                    </div>
                                </Li>
                            </div>
                        );
                    } else {
                        return (
                            <div key={item?._id}>
                                <Li>
                                    <div className="flex items-center gap-x-3 flex-wrap">
                                        <div>
                                            Заказ: (
                                            {item?.order?.createdAt?.slice(0, 10)})
                                        </div>
                                        <div>{item?.order?.client?.userName}</div>
                                        <a target="_blank" rel="noreferrer" href={item?.order?.address?.link} className="text-blue-500 hover:text-green-500">{item?.order?.address?.actual}</a>
                                        <div>{item?.order?.date?.d} {item?.order?.date?.time !== "" && item?.order?.date?.time}</div>
                                        <div>{item?.order?.products?.b12 !== 0 && `12.5л: ${item?.order?.products?.b12}`}; {item?.order?.products?.b19 !== 0 && `18.9л: ${item?.order?.products?.b19}`}</div>
                                        
                                        <LinkButton
                                            href={`/orderPage/${item?.order?._id}`}
                                        >
                                            Просмотр
                                        </LinkButton>
                                    </div>
                                </Li>
                            </div>
                        );
                    }
                })}
            </div>
        <Div />
    </Container>
}