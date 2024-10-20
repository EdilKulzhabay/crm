import { useState, useEffect, useCallback, useRef } from "react";
import Li from "./Li";
import LinkButton from "./LinkButton";
import api from "../api";
import OrderInfo from "./OrderInfo";

export default function CourierDeliveredOrders(props) {
    const id = props.id
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [userData, setUserData] = useState({})
    const [deliveredOrders, setDeliveredOrders] = useState([])

    const getMe = () => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        })
            .then(({ data }) => {
                setUserData(data)
            })
            .catch((e) => {
                console.log(e);
            });
    }

    useEffect(() => {
        getMe()
    }, [id]);

    const loadMoreDeliveredOrders = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        
        api.post(
            "/getDeliveredOrdersCourier",
            {
                id,
                page,
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        )
            .then(({ data }) => {
                if (data.deliveredOrders.length === 0) {
                    setHasMore(false);
                } else {
                    setDeliveredOrders((prevDeliveredOrders) => [...prevDeliveredOrders, ...data.deliveredOrders]);
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
            loadMoreDeliveredOrders();
        }
    }, [hasMore, id]);

    const observer = useRef();
    const lastOrderElementRef = useCallback(
        (node) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreDeliveredOrders();
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore, loadMoreDeliveredOrders]
    );

    return <div className="max-h-[100px] overflow-scroll">
    {deliveredOrders.map((item, index) => {
        if (deliveredOrders.length === index + 1) {
            return (
                <div key={item?._id} ref={lastOrderElementRef}>
                    <Li>
                        <div className="flex items-center gap-x-3 flex-wrap">
                            <div className="bg-red">
                                Заказ: 
                            </div>
                            <div>{item?.order?.client?.fullName}</div>
                            <a target="_blank" rel="noreferrer" href={item?.order?.address?.link} className="text-blue-500 hover:text-green-500">{item?.order?.address?.actual}</a>
                            <div>{item?.order?.date?.d} {item?.order?.date?.time !== "" && item?.order?.date?.time}</div>
                            <div>
                                {(item?.order?.products?.b12 !== 0 && item?.order?.products?.b12 !== null) && <>12.5л: <OrderInfo>{item?.order?.products?.b12}</OrderInfo> {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.order?.client?.price12}тг)</span>};</>}
                                {(item?.order?.products?.b19 !== 0 && item?.order?.products?.b19 !== null) && <>{" "}18.9л: <OrderInfo>{item?.order?.products?.b19}</OrderInfo> {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.order?.client?.price19}тг)</span>};</>}
                            </div>
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
                            <div className="bg-red">
                                Заказ: 
                            </div>
                            <div>{item?.order?.client?.fullName}</div>
                            <a target="_blank" rel="noreferrer" href={item?.order?.address?.link} className="text-blue-500 hover:text-green-500">{item?.order?.address?.actual}</a>
                            <div>{item?.order?.date?.d} {item?.order?.date?.time !== "" && item?.order?.date?.time}</div>
                            <div>
                                {(item?.order?.products?.b12 !== 0 && item?.order?.products?.b12 !== null) && <>12.5л: <OrderInfo>{item?.order?.products?.b12}</OrderInfo> {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.order?.client?.price12}тг)</span>};</>}
                                {(item?.order?.products?.b19 !== 0 && item?.order?.products?.b19 !== null) && <>{" "}18.9л: <OrderInfo>{item?.order?.products?.b19}</OrderInfo> {(userData.role === "admin" || userData.role === "superAdmin") && <span>({item?.order?.client?.price19}тг)</span>};</>}
                            </div>
                            
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