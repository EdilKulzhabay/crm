import React, { useState, useEffect } from "react";
import api from "../../api"
import Container from "../../Components/Container"
import Div from "../../Components/Div"
import useFetchUserData from "../../customHooks/useFetchUserData"
import clsx from "clsx"
import MyButton from "../../Components/MyButton"
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import img1 from '../../images/aggregatorStatus/1.png'
import img2 from '../../images/aggregatorStatus/2.png'
import img3 from '../../images/aggregatorStatus/3.png'
import img4 from '../../images/aggregatorStatus/4.png'
import img5 from '../../images/aggregatorStatus/5.png'
import img1Legal from '../../images/aggregatorStatus/1legal.png'
import img2Legal from '../../images/aggregatorStatus/2legal.png'
import img3Legal from '../../images/aggregatorStatus/3legal.png'
import img4Legal from '../../images/aggregatorStatus/4legal.png'
import img5Legal from '../../images/aggregatorStatus/5legal.png'
import imgTime from '../../images/aggregatorStatus/time.png'
import imgDelivered from '../../images/aggregatorStatus/delivered.jpeg'

// Исправляем проблему с иконками Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const createTriangleIcon = (color) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 20px solid ${color};"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 20]
    });
};

const createStarIcon = () => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="color: gold; font-size: 24px;">⭐</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

const regularStatusImages = [img1, img2, img3, img4, img5];
const legalStatusImages = [img1Legal, img2Legal, img3Legal, img4Legal, img5Legal];

const getOrderAgeIndex = (order) => {
    if (!order.createdAt) return 0;
    const hours = (Date.now() - new Date(order.createdAt)) / (1000 * 60 * 60);
    if (hours < 1) return 0;
    if (hours < 3) return 1;
    if (hours < 5) return 2;
    if (hours < 7) return 3;
    return 4;
};

const createOrderIcon = (order) => {
    const isLegal = !order.client?.clientType;
    const isFakt = order.opForm === "fakt";
    const hasDeliveryTime = order.date?.time && order.date.time !== "";
    const isDelivered = order.status === "delivered";
    const isCancelled = order.status === "cancelled";
    const isAssigned = order.courierAggregator && (order.courierAggregator._id || order.courierAggregator);

    if (isCancelled) {
        const shape = isLegal
            ? `<div style="width:16px;height:16px;background:#111827;"></div>`
            : `<div style="width:16px;height:16px;background:#111827;border-radius:50%;"></div>`;
        return L.divIcon({
            className: 'custom-order-icon',
            html: shape,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
    }

    let imgSrc;
    if (isDelivered) {
        imgSrc = imgDelivered;
    } else if (hasDeliveryTime) {
        imgSrc = imgTime;
    } else {
        const idx = getOrderAgeIndex(order);
        imgSrc = isLegal ? legalStatusImages[idx] : regularStatusImages[idx];
    }

    const showLine = order.status !== 'delivered' && order.status !== 'cancelled';
    let lineColor = '';
    if (showLine) {
        if (!isAssigned) {
            lineColor = '#22c55e';
        } else if (order.status === 'onTheWay') {
            lineColor = '#3b82f6';
        } else {
            lineColor = '#eab308';
        }
    }

    const outline = isFakt ? 'outline: 2px solid #f59e0b; outline-offset: 1px;' : '';
    const lineHtml = showLine
        ? `<div style="height:4px;background-color:${lineColor};width:20px;border-radius:2px 2px 0 0;"></div>`
        : '';
    return L.divIcon({
        className: 'custom-order-icon',
        html: `<div style="display:inline-block;${outline}">
            ${lineHtml}
            <img src="${imgSrc}" style="width:20px;height:20px;display:block;" />
        </div>`,
        iconSize: [20, showLine ? 24 : 20],
        iconAnchor: [10, showLine ? 12 : 10]
    });
};



export default function SuperAdminAggregatorAction() {
    const userData = useFetchUserData()
    const [loading, setLoading] = useState(false)
    const [orders, setOrders] = useState([])
    const [couriers, setCouriers] = useState([])
    const [allCouriers, setAllCouriers] = useState([])
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [assignLoading, setAssignLoading] = useState(false)
    const [removeLoading, setRemoveLoading] = useState(false)
    const [resendNotificationLoading, setResendNotificationLoading] = useState(false)
    const [resetOrdersLoading, setResetOrdersLoading] = useState(false)
    const [secret, setSecret] = useState(false)
    const [showReorderModal, setShowReorderModal] = useState(false)
    const [selectedCourierForReorder, setSelectedCourierForReorder] = useState(null)
    const [reorderedCourierOrders, setReorderedCourierOrders] = useState([])
    const [reorderLoading, setReorderLoading] = useState(false)
    const [draggedOrderIndex, setDraggedOrderIndex] = useState(null)
    useEffect(() => {
        setLoading(true)

        api.get("/getAllOrderForToday").then((res) => {
            console.log("Заказы с сервера:", res.data.orders);
            setOrders(res.data.orders)
        }).catch((err) => {
            console.log(err)
        })

        api.get("/getActiveCourierAggregators").then((res) => {
            setCouriers(res.data.couriers)
        }).catch((err) => {
            console.log(err)
        })

        api.get("/getAllCouriersWithOrderCount").then((res) => {
            setAllCouriers(res.data.couriers)
        }).catch((err) => {
            console.log(err)
        })

        setLoading(false)
    }, [])

    const handleAssignOrder = async (courierId) => {
        if (!selectedOrder) return;

        setAssignLoading(true);
        try {
            const response = await api.post("/assignOrderToCourier", {
                orderId: selectedOrder._id,
                courierId: courierId
            });

            if (response.data.success) {
                const ordersRes = await api.get("/getAllOrderForToday");
                setOrders(ordersRes.data.orders);

                const couriersRes = await api.get("/getActiveCourierAggregators");
                setCouriers(couriersRes.data.couriers);

                const allCouriersRes = await api.get("/getAllCouriersWithOrderCount");
                setAllCouriers(allCouriersRes.data.couriers);

                setShowAssignModal(false);
                setSelectedOrder(null);

                alert("Заказ успешно назначен курьеру!");
            }
        } catch (error) {
            console.log("Ошибка назначения заказа:", error);
            const errorMessage = error.response?.data?.message || "Ошибка при назначении заказа";
            alert(`Ошибка: ${errorMessage}`);
        }
        setAssignLoading(false);
    };

    const handleRemoveOrder = async (orderId, courierId) => {
        setRemoveLoading(true);
        try {
            const response = await api.post("/removeOrderFromCourier", {
                orderId: orderId,
                courierId: courierId
            });

            if (response.data.success) {
                const ordersRes = await api.get("/getAllOrderForToday");
                setOrders(ordersRes.data.orders);

                const couriersRes = await api.get("/getActiveCourierAggregators");
                setCouriers(couriersRes.data.couriers);

                const allCouriersRes = await api.get("/getAllCouriersWithOrderCount");
                setAllCouriers(allCouriersRes.data.couriers);

                alert("Заказ успешно убран у курьера!");
            }
        } catch (error) {
            console.log("Ошибка удаления заказа:", error);
            const errorMessage = error.response?.data?.message || "Ошибка при удалении заказа";
            alert(`Ошибка: ${errorMessage}`);
        }
        setRemoveLoading(false);
    };

    const handleResendNotification = async (courierId) => {
        setResendNotificationLoading(true);
        try {
            const response = await api.post("/resendNotificationToCourier", {
                courierId: courierId
            });

            if (response.data.success) {
                alert("Уведомление успешно отправлено курьеру!");
            }
        } catch (error) {
            console.log("Ошибка отправки уведомления:", error);
            const errorMessage = error.response?.data?.message || "Ошибка при отправке уведомления";
            alert(`Ошибка: ${errorMessage}`);
        }
        setResendNotificationLoading(false);
    };

    const handleResetOrders = async (courierId) => {
        setResetOrdersLoading(true);
        try {
            const response = await api.post("/resetCourierOrders", {
                courierId: courierId
            });

            if (response.data.success) {
                alert("Заказы курьера успешно сброшены!");
            }
        } catch (error) {
            console.log("Ошибка сброса заказов:", error);
        }
        setResetOrdersLoading(false);
    };

    const openAssignModal = (order) => {
        setSelectedOrder(order);
        setShowAssignModal(true);
    };

    const openReorderModal = (courier) => {
        if (!courier.orders || courier.orders.length === 0) {
            alert("У курьера нет заказов для изменения очередности.");
            return;
        }

        const enrichedOrders = courier.orders.map((orderItem) => {
            const orderId = orderItem.orderId || orderItem._id;
            const matchedOrder = orders.find(o => o._id === orderId);

            return {
                ...orderItem,
                orderId,
                clientName: matchedOrder?.client?.fullName || orderItem.clientTitle || "Неизвестный клиент",
                address: matchedOrder?.address?.actual || orderItem.clientAddress || "Адрес не указан",
                deliveryTime: matchedOrder?.date?.time || orderItem.date?.time || "",
                status: matchedOrder?.status || orderItem.status || ""
            };
        });

        setSelectedCourierForReorder(courier);
        setReorderedCourierOrders(enrichedOrders);
        setShowReorderModal(true);
    };

    const closeReorderModal = () => {
        setShowReorderModal(false);
        setSelectedCourierForReorder(null);
        setReorderedCourierOrders([]);
        setDraggedOrderIndex(null);
        setReorderLoading(false);
    };

    const handleDragStart = (event, index) => {
        if (index === 0) {
            event.preventDefault();
            return;
        }
        setDraggedOrderIndex(index);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", index.toString());
    };

    const handleDragOver = (event, index) => {
        if (index === 0) return;
        event.preventDefault();
    };

    const handleDragEnter = (event, index) => {
        event.preventDefault();
        if (draggedOrderIndex === null || draggedOrderIndex === index || index === 0 || draggedOrderIndex === 0) {
            return;
        }

        setReorderedCourierOrders(prev => {
            const updated = [...prev];
            const [removed] = updated.splice(draggedOrderIndex, 1);
            updated.splice(index, 0, removed);
            return updated;
        });
        setDraggedOrderIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedOrderIndex(null);
    };

    const handleSaveReorderedOrders = async () => {
        if (!selectedCourierForReorder) return;

        const orderIds = reorderedCourierOrders
            .map(order => {
                if (order.orderId) {
                    return order.orderId.toString();
                }
                if (order._id) {
                    return order._id.toString();
                }
                return null;
            })
            .filter(Boolean);

        if (orderIds.length === 0) {
            alert("Список заказов пуст. Нечего сохранять.");
            return;
        }

        setReorderLoading(true);
        try {
            const response = await api.post("/updateCourierOrdersSequence", {
                courierId: selectedCourierForReorder._id,
                orderIds
            });

            if (response.data.success) {
                const ordersRes = await api.get("/getAllOrderForToday");
                setOrders(ordersRes.data.orders);

                const couriersRes = await api.get("/getActiveCourierAggregators");
                setCouriers(couriersRes.data.couriers);

                const allCouriersRes = await api.get("/getAllCouriersWithOrderCount");
                setAllCouriers(allCouriersRes.data.couriers);

                alert("Очередность заказов успешно обновлена!");
                closeReorderModal();
            }
        } catch (error) {
            console.log("Ошибка сохранения очередности заказов:", error);
            const errorMessage = error.response?.data?.message || "Не удалось сохранить очередность заказов.";
            alert(`Ошибка: ${errorMessage}`);
            setReorderLoading(false);
        }
    };

    const getCourierOrders = (courierId) => {
        return orders.filter(order => {
            if (!order.courierAggregator) return false;
            if (typeof order.courierAggregator === 'string') {
                return order.courierAggregator === courierId;
            } else if (order.courierAggregator._id) {
                return order.courierAggregator._id === courierId;
            }
            return false;
        });
    };

    const getOpForm = (opForm) => {
        if (opForm === "fakt") return "Нал_QR";
        if (opForm === "postpay") return "Постоплата";
        if (opForm === "credit") return "Карта";
        if (opForm === "coupon") return "Талоны";
        if (opForm === "mixed") return "Смешанно";
        return "Неизвестно";
    };

    // Статистика
    const orderStats = {
        awaitingOrder: orders.filter(o => o.status === "awaitingOrder").length,
        awaitingOrdersBottles12: orders.filter(o => o.status === "awaitingOrder").reduce((acc, order) => {
            return acc + (order.products?.b12 || 0);
        }, 0),
        awaitingOrdersBottles19: orders.filter(o => o.status === "awaitingOrder").reduce((acc, order) => {
            return acc + (order.products?.b19 || 0);
        }, 0),
        onTheWay: orders.filter(o => o.status === "onTheWay").length,
        onTheWayBottles12: orders.filter(o => o.status === "onTheWay").reduce((acc, order) => {
            return acc + (order.products?.b12 || 0);
        }, 0),
        onTheWayBottles19: orders.filter(o => o.status === "onTheWay").reduce((acc, order) => {
            return acc + (order.products?.b19 || 0);
        }, 0),
        delivered: orders.filter(o => o.status === "delivered").length,
        deliveredBottles12: orders.filter(o => o.status === "delivered").reduce((acc, order) => {
            return acc + (order.products?.b12 || 0);
        }, 0),
        deliveredBottles19: orders.filter(o => o.status === "delivered").reduce((acc, order) => {
            return acc + (order.products?.b19 || 0);
        }, 0),
        cancelled: orders.filter(o => o.status === "cancelled").length,
        cancelledBottles12: orders.filter(o => o.status === "cancelled").reduce((acc, order) => {
            return acc + (order.products?.b12 || 0);
        }, 0),
        cancelledBottles19: orders.filter(o => o.status === "cancelled").reduce((acc, order) => {
            return acc + (order.products?.b19 || 0);
        }, 0),
        total: orders.length,
        totalBottles12: orders.reduce((acc, order) => {
            return acc + (order.products?.b12 || 0);
        }, 0),
        totalBottles19: orders.reduce((acc, order) => {
            return acc + (order.products?.b19 || 0);
        }, 0),
    };

    const processOrdersWithOffset = (orders) => {
        const coordinateGroups = new Map();

        orders.forEach((order, index) => {
            if (order.address?.point?.lat && order.address?.point?.lon) {
                const lat = parseFloat(order.address.point.lat);
                const lon = parseFloat(order.address.point.lon);
                const key = `${lat.toFixed(6)}_${lon.toFixed(6)}`;

                if (!coordinateGroups.has(key)) {
                    coordinateGroups.set(key, []);
                }
                coordinateGroups.get(key).push({ order, originalIndex: index });
            }
        });

        const processedOrders = [];

        coordinateGroups.forEach((group) => {
            if (group.length === 1) {
                processedOrders.push({
                    ...group[0].order,
                    originalIndex: group[0].originalIndex,
                    offsetLat: parseFloat(group[0].order.address.point.lat),
                    offsetLon: parseFloat(group[0].order.address.point.lon)
                });
            } else {
                group.forEach((item, groupIndex) => {
                    const baseLat = parseFloat(item.order.address.point.lat);
                    const baseLon = parseFloat(item.order.address.point.lon);
                    const offsetRadius = 0.0008;
                    const angle = (groupIndex * 2 * Math.PI) / group.length;

                    processedOrders.push({
                        ...item.order,
                        originalIndex: item.originalIndex,
                        offsetLat: baseLat + offsetRadius * Math.cos(angle),
                        offsetLon: baseLon + offsetRadius * Math.sin(angle)
                    });
                });
            }
        });

        return processedOrders;
    };

    const processedOrders = processOrdersWithOffset(orders);

    return <Container role={userData?.role}>
        <Div>Агрегатор курьеров</Div>
        <Div />

        {/* Статистика */}
        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-bold mb-2">Статистика заказов:</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                    <div className="text-green-400 font-bold">{orderStats.awaitingOrder}
                        ({orderStats.awaitingOrdersBottles19};{orderStats.awaitingOrdersBottles12})</div>
                    <div className="text-sm">Ожидают</div>
                </div>
                <div className="text-center">
                    <div className="text-blue-400 font-bold">{orderStats.onTheWay}
                        ({orderStats.onTheWayBottles19};{orderStats.onTheWayBottles12})</div>
                    <div className="text-sm">В пути</div>
                </div>
                <div className="text-center">
                    <div className="text-red-400 font-bold">{orderStats.delivered}
                        ({orderStats.deliveredBottles19};{orderStats.deliveredBottles12})</div>
                    <div className="text-sm">Доставлены</div>
                </div>
                <div className="text-center">
                    <div className="text-gray-400 font-bold">{orderStats.cancelled}
                        ({orderStats.cancelledBottles19};{orderStats.cancelledBottles12})</div>
                    <div className="text-sm">Отменены</div>
                </div>
                <div className="text-center">
                    <div className="text-white font-bold">
                        {orderStats.total} ({orderStats.totalBottles19};{orderStats.totalBottles12})
                    </div>
                    <button
                        onClick={() => setSecret((prev) => !prev)}
                        className={clsx("-mt-5 cursor-pointer text-sm ", {
                            "text-white": secret,
                            "text-gray-400": !secret
                        })}
                    >
                        Всего
                    </button>
                </div>
            </div>
        </div>

        {/* Статистика курьеров */}
        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-bold mb-2">Активные курьеры:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allCouriers.map((courier) => (
                    <div key={courier._id} className="bg-gray-700 p-4 rounded-lg">
                        <div className="font-bold text-lg mb-2">{courier.fullName}</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="text-sm text-gray-400">Остаток бутылей:</div>
                                <div className="text-blue-400">
                                    12л: {courier.capacity12 || 0}
                                </div>
                                <div className="text-green-400">
                                    19л: {courier.capacity19 || 0}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-400">Доставлено сегодня:</div>
                                <div className="text-yellow-400">
                                    Заказов: {orders.filter(o => {
                                        return o.courierAggregator?.fullName === courier.fullName && o.status === 'delivered'}).length || 0}
                                </div>
                                <div className="text-orange-400">
                                    19л бутылей: {orders.filter(o => o.courierAggregator?.fullName === courier.fullName && o.status === 'delivered').reduce((acc, order) => {
                                        if (order.status === 'delivered') {
                                            return acc + (order.products?.b19 || 0);
                                        }
                                        return acc;
                                    }, 0)}
                                </div>
                                <div className="text-orange-400">
                                    12л бутылей: {orders.filter(o => o.courierAggregator?.fullName === courier.fullName && o.status === 'delivered').reduce((acc, order) => {
                                        if (order.status === 'delivered') {
                                            return acc + (order.products?.b12 || 0);
                                        }
                                        return acc;
                                    }, 0)}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="lg:hidden mt-5 bg-white bg-opacity-90 p-4 rounded-lg shadow-lg z-10 text-black">
                <h4 className="font-bold mb-2">Легенда:</h4>
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-600 mt-2 mb-1">Полоска сверху иконки:</div>
                    <div className="flex items-center gap-2">
                        <div style={{width:20,height:4,background:'#22c55e',borderRadius:'2px 2px 0 0'}}></div>
                        <span className="text-sm">Курьер не назначен</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div style={{width:20,height:4,background:'#eab308',borderRadius:'2px 2px 0 0'}}></div>
                        <span className="text-sm">В очереди у курьера</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div style={{width:20,height:4,background:'#3b82f6',borderRadius:'2px 2px 0 0'}}></div>
                        <span className="text-sm">В пути</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div style={{width:20,height:4,background:'#e5e7eb'}}></div>
                        <span className="text-sm">Нет полоски — доставлен / отменён</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-600 mt-3 mb-1">Иконки — возраст заказа (физ лица):</div>
                    <div className="flex items-center gap-2">
                        <img src={img1} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">Менее 1 часа</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <img src={img2} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">1–3 часа</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <img src={img3} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">3–5 часов</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <img src={img4} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">5–7 часов</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <img src={img5} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">7+ часов</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-600 mt-3 mb-1">Иконки — возраст заказа (юр лица):</div>
                    <div className="flex items-center gap-2">
                        <img src={img1Legal} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">Менее 1 часа</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <img src={img2Legal} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">1–3 часа</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <img src={img3Legal} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">3–5 часов</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <img src={img4Legal} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">5–7 часов</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <img src={img5Legal} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">7+ часов</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-600 mt-3 mb-1">Особые статусы:</div>
                    <div className="flex items-center gap-2">
                        <img src={imgTime} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">С назначенным временем доставки</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <img src={imgDelivered} style={{width:20,height:20}} alt="" />
                        <span className="text-sm">Доставлен</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div style={{width:20,height:20,outline:'2px solid #f59e0b',background:'#e5e7eb'}}></div>
                        <span className="text-sm">Форма оплаты Нал_QR (золотая обводка)</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-600 mt-3 mb-1">Другие элементы:</div>
                    <div className="flex items-center">
                        <div className="w-0 h-0 border-l-2 border-r-2 border-b-4 border-purple-500 mr-2"></div>
                        <span className="text-sm">Курьеры</span>
                    </div>
                    <div className="flex items-center">
                        <span className="text-yellow-500 mr-2">⭐</span>
                        <span className="text-sm">Центр / Аквамаркет</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-8 h-0.5 bg-purple-500 mr-2" style={{borderTop: '2px dashed purple'}}></div>
                        <span className="text-sm">Маршрут курьера</span>
                    </div>
                </div>
            </div>
        </div>

        {loading ? (
            <Div>Загрузка данных...</Div>
        ) : (
            <div style={{ height: '80vh', width: '100%', position: 'relative' }}>
                <MapContainer
                    center={[43.16856, 76.89645]}
                    style={{ height: '100%', width: '100%' }}
                    zoom={12}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    {/* Звезда в центре */}
                    <Marker
                        position={[43.16856, 76.89645]}
                        icon={createStarIcon()}
                    >
                        <Popup>
                            <div>
                                <strong>Центр</strong><br />
                                Координаты: 43.16856°N, 76.89645°E
                            </div>
                        </Popup>
                    </Marker>

                    <Marker
                        position={[43.260627, 76.924226]}
                        icon={createStarIcon()}
                    >
                        <Popup>
                            <div>
                                <strong>Аквамаркет</strong><br />
                                Координаты: 43.260627°N, 76.924226°E
                            </div>
                        </Popup>
                    </Marker>

                    <Marker
                        position={[43.299359, 77.001365]}
                        icon={createStarIcon()}
                    >
                        <Popup>
                            <div>
                                <strong>Аквамаркет</strong><br />
                                Координаты: 43.299359°N, 77.001365°E
                            </div>
                        </Popup>
                    </Marker>

                    {/* Заказы */}
                    {processedOrders.map((order, index) => {
                        const isAssigned = order.courierAggregator && (order.courierAggregator._id || order.courierAggregator);
                        const bottles12 = order.products?.b12 || 0;
                        const bottles19 = order.products?.b19 || 0;
                        const opForm = getOpForm(order.opForm);
                        const clientType = order.client?.clientType;

                        return (
                            <Marker
                                key={`order-${order.originalIndex}`}
                                position={[order.offsetLat, order.offsetLon]}
                                icon={createOrderIcon(order)}
                            >
                                <Popup>
                                    <div className="min-w-[300px]">
                                        <strong>Заказ: {order.client?.fullName}</strong><br />
                                        Адрес: {order.address?.actual}<br />
                                        Статус: {order.status}<br />
                                        Форма оплаты: {opForm}<br />
                                        Тип клиента: {clientType ? 'Физ лицо' : 'Юр лицо'}<br />
                                        {order.date?.time && order.date.time !== "" && (
                                            <><strong>Время доставки: {order.date.time}</strong><br /></>
                                        )}
                                        {bottles12 > 0 && `${bottles12} 12л бутылей, `}
                                        {bottles19 > 0 && `${bottles19} 19л бутылей`}
                                        {isAssigned && (
                                            <><br /><strong>Курьер: {order.courierAggregator?.fullName || 'Назначен'}</strong></>
                                        )}
                                        <br /><br />
                                        <button
                                            onClick={() => {
                                                window.open(`/clientPage/${order.client._id}`, '_blank');
                                            }}
                                            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-full mb-2"
                                        >
                                            Профиль клиента
                                        </button>
                                        {order.status === "awaitingOrder" && !secret && !isAssigned && (
                                            <button
                                                onClick={() => openAssignModal(order)}
                                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full mb-2"
                                            >
                                                Назначить курьеру
                                            </button>
                                        )}
                                        {isAssigned && !secret && (
                                            <button
                                                onClick={() => handleRemoveOrder(order._id, order.courierAggregator._id || order.courierAggregator)}
                                                disabled={removeLoading}
                                                className="bg-red text-white font-bold py-2 px-4 rounded w-full"
                                            >
                                                {removeLoading ? "Убирается..." : "Убрать у курьера"}
                                            </button>
                                        )}
                                        {!isAssigned && order.status !== "awaitingOrder" && (
                                            <div className="text-gray-500 text-sm">Заказ не может быть назначен</div>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}

                    {/* Курьеры */}
                    {couriers.map((courier, index) => {
                        if (courier.point?.lat && courier.point?.lon) {
                            return (
                                <Marker
                                    key={`courier-${index}`}
                                    position={[courier.point.lat, courier.point.lon]}
                                    icon={createTriangleIcon("purple")}
                                >
                                    <Popup>
                                        <div className="min-w-[250px]">
                                            <strong>Курьер: {courier.fullName}</strong><br />
                                            Телефон: {courier.phone}<br />
                                            Статус: {courier.onTheLine ? "Активен" : "Неактивен"}
                                            <br />Заказов: {courier.orders?.length || 0}
                                            {(courier.orders && courier.orders.length > 0) && (
                                                <>
                                                    <br /><strong>Первый заказ: {courier.orders[0]?.clientTitle || 'Заказ'}</strong>
                                                    <br /><br />
                                                    <button
                                                        onClick={() => openReorderModal(courier)}
                                                        disabled={courier.orders.length < 2}
                                                        className={clsx("bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-full mb-2", {
                                                            "opacity-50 cursor-not-allowed hover:bg-purple-500": courier.orders.length < 2
                                                        })}
                                                    >
                                                        Изменить очередность заказов
                                                    </button>
                                                    {courier.orders.length < 2 && (
                                                        <div className="text-xs text-gray-500 mb-2">
                                                            Нужно минимум два заказа для изменения очередности.
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleResendNotification(courier._id)}
                                                        disabled={resendNotificationLoading}
                                                        className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded w-full"
                                                    >
                                                        {resendNotificationLoading ? "Отправляется..." : "Отправить уведомление"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleResetOrders(courier._id)}
                                                        disabled={resetOrdersLoading}
                                                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
                                                    >
                                                        {resetOrdersLoading ? "Сбрасывается..." : "Сбросить заказы"}
                                                    </button>
                                                </>
                                            )}
                                            {(!courier.orders || courier.orders.length === 0) && (
                                                <><br /><span className="text-gray-500">Нет заказов</span></>
                                            )}
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        }
                        return null;
                    })}

                    {/* Линии от курьеров к назначенным заказам */}
                    {couriers.map((courier, courierIndex) => {
                        if (courier.point?.lat && courier.point?.lon && courier.orders && courier.orders.length > 0) {
                            const lines = [];
                            const courierOrderIds = courier.orders.map(order => order.orderId);

                            const orderedCourierOrders = [];
                            courierOrderIds.forEach(orderId => {
                                const order = orders.find(o => o._id === orderId);
                                if (order) {
                                    orderedCourierOrders.push(order);
                                }
                            });

                            const firstOrder = orderedCourierOrders[0];
                            if (firstOrder && firstOrder.address?.point?.lat && firstOrder.address?.point?.lon) {
                                lines.push(
                                    <Polyline
                                        key={`line-courier-${courierIndex}`}
                                        positions={[
                                            [courier.point.lat, courier.point.lon],
                                            [firstOrder.address.point.lat, firstOrder.address.point.lon]
                                        ]}
                                        pathOptions={{
                                            color: "purple",
                                            weight: 3,
                                            opacity: 0.7,
                                            dashArray: "10, 5"
                                        }}
                                    />
                                );
                            }

                            for (let i = 0; i < orderedCourierOrders.length - 1; i++) {
                                const currentOrder = orderedCourierOrders[i];
                                const nextOrder = orderedCourierOrders[i + 1];

                                if (currentOrder.address?.point?.lat && currentOrder.address?.point?.lon &&
                                    nextOrder.address?.point?.lat && nextOrder.address?.point?.lon) {
                                    lines.push(
                                        <Polyline
                                            key={`line-order-${courierIndex}-${i}`}
                                            positions={[
                                                [currentOrder.address.point.lat, currentOrder.address.point.lon],
                                                [nextOrder.address.point.lat, nextOrder.address.point.lon]
                                            ]}
                                            pathOptions={{
                                                color: "purple",
                                                weight: 3,
                                                opacity: 0.7,
                                                dashArray: "10, 5"
                                            }}
                                        />
                                    );
                                }
                            }

                            return lines;
                        }
                        return null;
                    })}
                </MapContainer>

                {/* Легенда карты */}
                <div className="hidden lg:block absolute top-4 right-4 bg-white bg-opacity-90 p-4 rounded-lg shadow-lg z-10 text-black max-h-[90vh] overflow-y-auto">
                    <h4 className="font-bold mb-2">Легенда:</h4>
                    <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-gray-600 mt-2 mb-1">Полоска сверху иконки:</div>
                        <div className="flex items-center gap-2">
                            <div style={{width:20,height:4,background:'#22c55e',borderRadius:'2px 2px 0 0'}}></div>
                            <span className="text-sm">Курьер не назначен</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div style={{width:20,height:4,background:'#eab308',borderRadius:'2px 2px 0 0'}}></div>
                            <span className="text-sm">В очереди у курьера</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div style={{width:20,height:4,background:'#3b82f6',borderRadius:'2px 2px 0 0'}}></div>
                            <span className="text-sm">В пути</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div style={{width:20,height:4,background:'transparent',border:'1px dashed #9ca3af'}}></div>
                            <span className="text-sm">Нет полоски — доставлен</span>
                        </div>
                        <div className="text-xs font-semibold text-gray-600 mt-3 mb-1">Отменённые заказы:</div>
                        <div className="flex items-center gap-2">
                            <div style={{width:16,height:16,background:'#111827',borderRadius:'50%'}}></div>
                            <span className="text-sm">Физ лицо (чёрный круг)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div style={{width:16,height:16,background:'#111827'}}></div>
                            <span className="text-sm">Юр лицо (чёрный квадрат)</span>
                        </div>
                        <div className="text-xs font-semibold text-gray-600 mt-3 mb-1">Иконки — физ лица:</div>
                        <div className="flex items-center gap-2">
                            <img src={img1} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">Менее 1 часа</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <img src={img2} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">1–3 часа</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <img src={img3} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">3–5 часов</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <img src={img4} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">5–7 часов</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <img src={img5} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">7+ часов</span>
                        </div>
                        <div className="text-xs font-semibold text-gray-600 mt-3 mb-1">Иконки — юр лица:</div>
                        <div className="flex items-center gap-2">
                            <img src={img1Legal} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">Менее 1 часа</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <img src={img2Legal} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">1–3 часа</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <img src={img3Legal} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">3–5 часов</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <img src={img4Legal} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">5–7 часов</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <img src={img5Legal} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">7+ часов</span>
                        </div>
                        <div className="text-xs font-semibold text-gray-600 mt-3 mb-1">Особые статусы:</div>
                        <div className="flex items-center gap-2">
                            <img src={imgTime} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">С назначенным временем доставки</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <img src={imgDelivered} style={{width:20,height:20}} alt="" />
                            <span className="text-sm">Доставлен</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div style={{width:20,height:20,outline:'2px solid #f59e0b',background:'#e5e7eb'}}></div>
                            <span className="text-sm">Нал_QR (золотая обводка)</span>
                        </div>
                        <div className="text-xs font-semibold text-gray-600 mt-3 mb-1">Другие элементы:</div>
                        <div className="flex items-center gap-2">
                            <div className="w-0 h-0 border-l-2 border-r-2 border-b-4 border-purple-500"></div>
                            <span className="text-sm">Курьеры</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-yellow-500">⭐</span>
                            <span className="text-sm">Центр / Аквамаркет</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-0.5" style={{borderTop: '2px dashed purple'}}></div>
                            <span className="text-sm">Маршрут курьера</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Модальное окно изменения очередности заказов */}
        {showReorderModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white text-black p-6 rounded-lg max-w-xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                    <h3 className="text-lg font-bold mb-4">
                        Изменить очередность заказов
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Первый заказ зафиксирован и не может быть перенесён. Перетащите остальные заказы, чтобы задать нужный порядок.
                    </p>

                    {reorderedCourierOrders.length === 0 ? (
                        <div className="text-gray-500 text-center py-4">
                            У курьера нет заказов для изменения очередности.
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {reorderedCourierOrders.map((order, index) => (
                                <li
                                    key={order.orderId || index}
                                    draggable={index !== 0}
                                    onDragStart={(event) => handleDragStart(event, index)}
                                    onDragEnter={(event) => handleDragEnter(event, index)}
                                    onDragOver={(event) => handleDragOver(event, index)}
                                    onDragEnd={handleDragEnd}
                                    onDrop={handleDragEnd}
                                    className={clsx(
                                        "border border-gray-300 rounded-md p-3 bg-white shadow-sm transition",
                                        {
                                            "opacity-60 cursor-not-allowed": index === 0,
                                            "cursor-move": index !== 0,
                                            "ring-2 ring-purple-500": draggedOrderIndex === index && index !== 0
                                        }
                                    )}
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div>
                                            <p className="font-semibold">
                                                {index + 1}. {order.clientName}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                {order.address}
                                            </p>
                                            {order.deliveryTime && (
                                                <p className="text-xs text-blue-500 mt-1">
                                                    Время доставки: {order.deliveryTime}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-xs uppercase text-gray-500">
                                            {index === 0 ? "Зафиксирован" : "Перетащите"}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="mt-6 flex justify-end space-x-3">
                        <button
                            onClick={closeReorderModal}
                            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Отмена
                        </button>
                        <button
                            onClick={handleSaveReorderedOrders}
                            disabled={reorderLoading || reorderedCourierOrders.length <= 1}
                            className={clsx(
                                "bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded",
                                {
                                    "opacity-50 cursor-not-allowed hover:bg-green-600": reorderLoading || reorderedCourierOrders.length <= 1
                                }
                            )}
                        >
                            {reorderLoading ? "Сохранение..." : "Сохранить"}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Модальное окно назначения заказа */}
        {showAssignModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white text-black p-6 rounded-lg max-w-md w-full mx-4">
                    <h3 className="text-lg font-bold mb-4">
                        Назначить заказ курьеру
                    </h3>

                    {selectedOrder && (
                        <div className="mb-4 p-3 bg-gray-100 rounded">
                            <p><strong>Клиент:</strong> {selectedOrder.client?.fullName}</p>
                            <p><strong>Адрес:</strong> {selectedOrder.address?.actual}</p>
                            <p><strong>Бутыли:</strong>
                                {selectedOrder.products?.b12 > 0 && ` ${selectedOrder.products.b12} 12л`}
                                {selectedOrder.products?.b19 > 0 && ` ${selectedOrder.products.b19} 19л`}
                            </p>
                        </div>
                    )}

                    <div className="max-h-60 overflow-y-auto">
                        {allCouriers.length === 0 ? (
                            <p className="text-gray-500">Нет доступных курьеров</p>
                        ) : (
                            allCouriers.map((courier) => (
                                <div
                                    key={courier._id}
                                    className="border-b border-gray-200 py-3 cursor-pointer hover:bg-gray-50"
                                    onClick={() => handleAssignOrder(courier._id)}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{courier.fullName}</p>
                                            <p className="text-sm text-gray-600">
                                                Заказов: {courier.orderCount} |
                                                Вместимость: {courier.capacity12} 12л, {courier.capacity19} 19л
                                            </p>
                                        </div>
                                        {assignLoading && (
                                            <div className="text-blue-500">Назначается...</div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={() => {
                                setShowAssignModal(false);
                                setSelectedOrder(null);
                            }}
                            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            </div>
        )}
    </Container>
}
