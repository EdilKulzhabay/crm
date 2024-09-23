import { useState, useEffect, useCallback, useRef } from "react";
import Li from "./Li";
import LinkButton from "./LinkButton";
import api from "../api";

export default function CourierActiveOrders(props) {
    const id = props.id
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [activeOrders, setActiveOrders] = useState([])

    const loadMoreActiveOrders = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        
        api.post(
            "/getActiveOrdersCourier",
            {
                id,
                page,
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                console.log(data);
                if (data.activeOrders.length === 0) {
                    setHasMore(false);
                } else {
                    setActiveOrders((prevActiveOrders) => [...prevActiveOrders, ...data.activeOrders]);
                    setPage(page + 1);
                }
            })
            .catch((e) => {
                console.log(e);
            });
        setLoading(false);
    }, [page, loading, hasMore, id]);

    useEffect(() => {
        if (hasMore) {
            loadMoreActiveOrders();
        }
    }, [hasMore, id]);

    const observer = useRef();
    const lastOrderElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreActiveOrders();
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreActiveOrders]
    );

    return <div className="max-h-[100px] overflow-scroll">
    {activeOrders.map((item, index) => {
        if (activeOrders.length === index + 1) {
            return (
                <div key={item?.order?._id} ref={lastOrderElementRef}>
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                        <div>
                                Заказ: (
                                {item?.order?.createdAt?.slice(0, 10)})
                            </div>
                            <a target="_blank" rel="noreferrer" href={item?.order?.address?.link} className="text-blue-500 hover:text-green-500">{item?.order?.address?.actual}</a>
                            <div>{item?.order?.date?.d} {item?.order?.date?.time !== "" && item?.order?.date?.time}</div>
                            <div>{item?.order?.products?.b12 !== 0 && `12.5л: ${item?.order?.products?.b12}`}; {item?.order?.products?.b19 !== 0 && `18.9л: ${item?.order?.products?.b19}`}</div>
                            <LinkButton
                                href={`/orderPage/${item._id}`}
                            >
                                Просмотр
                            </LinkButton>
                        </div>
                    </Li>
                </div>
            );
        } else {
            return (
                <div key={item?.order?._id}>
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div>
                                Заказ: (
                                {item?.order?.createdAt?.slice(0, 10)})
                            </div>
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
    {loading && <div>Загрузка...</div>}
</div>
}