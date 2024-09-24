import { useState, useEffect, useCallback, useRef } from "react";
import Li from "./Li";
import LinkButton from "./LinkButton";
import api from "../api";
import MyButton from "./MyButton";

export default function CourierActiveOrders(props) {
    const id = props.id
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [activeOrders, setActiveOrders] = useState([])

    const [draggingOrderId, setDraggingOrderId] = useState(null);
    const [isUpdate, setIsUpdate] = useState(false)

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

    const touchStartHandler = (e, orderId) => {
        setDraggingOrderId(orderId);
    }
    
    const touchMoveHandler = (e) => {
        e.preventDefault(); // Это нужно, чтобы предотвратить дефолтное поведение прокрутки на мобильных устройствах
    }
    
    const touchEndHandler = (e, droppedOnOrderId) => {
        onDropHandler(e, droppedOnOrderId);
    }

    const dragStartHandler = (e, orderId) => {
        setDraggingOrderId(orderId);
    }

    const dragLeaveHandler = (e) => {
    }

    const dragEndHandler = (e) => {
    }

    const dragOverHandler = (e) => {
        e.preventDefault()
    }

    const onDropHandler = (e, droppedOnOrderId) => {
        e.preventDefault()
        if (draggingOrderId && draggingOrderId !== droppedOnOrderId) {
            const newOrderList = [...activeOrders];

            // Получаем индексы перетаскиваемого и целевого заказов
            const draggedOrderIndex = newOrderList.findIndex(order => order._id === draggingOrderId);
            const droppedOnOrderIndex = newOrderList.findIndex(order => order._id === droppedOnOrderId);

            // Вырезаем перетаскиваемый элемент
            const [draggedOrder] = newOrderList.splice(draggedOrderIndex, 1);

            // Вставляем перед или после целевого заказа (по вашему выбору)
            // Например, вставляем перед:
            newOrderList.splice(droppedOnOrderIndex, 0, draggedOrder);  // Перед droppedOnOrder

            // Если нужно вставлять после:
            // newOrderList.splice(droppedOnOrderIndex + 1, 0, draggedOrder);  // После droppedOnOrder

            setActiveOrders(newOrderList); // Обновляем состояние заказов
            setIsUpdate(true)
        }

        setDraggingOrderId(null); 
    }

    const updateOrderList = () => {
        const ordersToSend = activeOrders.map(item => ({
            order: item.order._id, // Сохраняем только ObjectId заказа
            orderStatus: item.orderStatus,
            _id: item._id,
        }));
        api.post("/updateOrderList", {id, orders: ordersToSend}, {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            if (data.success) {
                props.changeSnackBar("success", "Данные успешно изменены")
            } else {
                props.changeSnackBar("error", "Попробуйте еще раз")
            }
        }).catch((e) => {
            console.log(e);
            props.changeSnackBar("error", "Попробуйте еще раз")
        })
        setIsUpdate(false)
    }

    return <>
        <div className="max-h-[200px] overflow-scroll mb-1">
            {activeOrders.map((item, index) => {
                if (activeOrders.length === index + 1) {
                    return (
                        <div 
                            key={item?.order?._id} 
                            ref={lastOrderElementRef}
                            onDragStart={(e) => {dragStartHandler(e, item._id)}}
                            onDragLeave={(e) => {dragLeaveHandler(e)}}
                            onDragEnd={(e) => {dragEndHandler(e)}}
                            onDragOver={(e) => {dragOverHandler(e)}}
                            onDrop={(e) => {onDropHandler(e, item._id)}}
                            onTouchStart={(e) => touchStartHandler(e, item._id)}
                            onTouchMove={(e) => touchMoveHandler(e)}
                            onTouchEnd={(e) => touchEndHandler(e, item._id)}
                            draggable={true}
                        >
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
                        <div 
                            key={item?.order?._id} 
                            onDragStart={(e) => {dragStartHandler(e, item._id)}}
                            onDragLeave={(e) => {dragLeaveHandler(e)}}
                            onDragEnd={(e) => {dragEndHandler(e)}}
                            onDragOver={(e) => {dragOverHandler(e)}}
                            onDrop={(e) => {onDropHandler(e, item._id)}}
                            onTouchStart={(e) => touchStartHandler(e, item._id)}
                            onTouchMove={(e) => touchMoveHandler(e)}
                            onTouchEnd={(e) => touchEndHandler(e, item._id)}
                            draggable={true}    
                        >
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
        {isUpdate && <Li><MyButton click={updateOrderList}>Применить</MyButton></Li>}
    </>
}