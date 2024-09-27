import { useCallback, useEffect, useRef, useState } from "react"
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
                                            {item?.createdAt.slice(0, 10)})
                                        </div>
                                        <div>{item?.client?.userName}</div>
                                        <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                        <div>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                        <div>{item?.products?.b12 !== 0 && `12.5л: ${item?.products?.b12}`}; {item?.products?.b19 !== 0 && `18.9л: ${item?.products?.b19}`}</div>
                                        <LinkButton
                                            href={`/orderPage/${item?._id}`}
                                        >
                                            Просмотр
                                        </LinkButton>
                                        {userData?.role === "superAdmin" && <>
                                            {item?.transferred && <div>{item?.transferredFranchise}</div>}
                                            {!item?.transferred && <MyButton click={() => {setOrder(item?._id); setFranchiseesModal(true)}}>Перенести</MyButton>}
                                            {item?.transferred &&  <MyButton click={() => {closeOrderTransfer(item?._id)}}>
                                                <span className="text-green-400">
                                                    Отменить
                                                </span></MyButton>}
                                            </>}
                                        <div>{item?.courier?.fullName}</div>
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
                                            {item?.createdAt.slice(0, 10)})
                                        </div>
                                        <div>{item?.client?.userName}</div>
                                        <a target="_blank" rel="noreferrer" href={item?.address?.link} className="text-blue-500 hover:text-green-500">{item?.address?.actual}</a>
                                        <div>{item?.date?.d} {item?.date?.time !== "" && item?.date?.time}</div>
                                        <div>{item?.products?.b12 !== 0 && `12.5л: ${item?.products?.b12}`}; {item?.products?.b19 !== 0 && `18.9л: ${item?.products?.b19}`}</div>
                                        <LinkButton
                                            href={`/orderPage/${item?._id}`}
                                        >
                                            Просмотр
                                        </LinkButton>
                                        {userData?.role === "superAdmin" && <>
                                            {item?.transferred && <div>{item?.transferredFranchise}</div>}
                                            {!item?.transferred && <MyButton click={() => {setOrder(item?._id); setFranchiseesModal(true)}}>Перенести</MyButton>}
                                            {item?.transferred &&  <MyButton click={() => {closeOrderTransfer(item?._id)}}>
                                                <span className="text-green-400">
                                                    Отменить
                                                </span></MyButton>}
                                            </>}
                                        <div>{item?.courier?.fullName}</div>
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