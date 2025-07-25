import { useState, useEffect } from "react";
import api from "../../api"
import Container from "../../Components/Container"
import Div from "../../Components/Div"
import useFetchUserData from "../../customHooks/useFetchUserData"
import MyButton from "../../Components/MyButton"
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Исправляем проблему с иконками Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Создаем кастомные иконки
const createCustomIcon = (color) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
};

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

export default function SuperAdminAggregatorAction() {
    const userData = useFetchUserData()
    const [loading, setLoading] = useState(false)

    const [orders, setOrders] = useState([])
    const [couriers, setCouriers] = useState([])

    useEffect(() => {
        setLoading(true)

        api.get("/getAllOrderForToday").then((res) => {
            setOrders(res.data.orders)
        }).catch((err) => {
            console.log(err)
        })

        api.get("/getActiveCourierAggregators").then((res) => {
            setCouriers(res.data.couriers)
        }).catch((err) => {
            console.log(err)
        })
        setLoading(false)
    }, [])

    // Функция для определения цвета заказа по статусу
    const getOrderColor = (status) => {
        switch (status) {
            case "awaitingOrder":
                return "green";
            case "onTheWay":
                return "blue";
            case "delivered":
                return "red";
            case "cancelled":
                return "black";
            default:
                return "gray";
        }
    };

    // Функция для вычисления границ карты
    const calculateMapBounds = () => {
        if (orders.length === 0 && couriers.length === 0) {
            return [[43.16856, 76.89645], [43.16856, 76.89645]]; // Центр по умолчанию
        }

        let minLat = Infinity, maxLat = -Infinity;
        let minLon = Infinity, maxLon = -Infinity;

        // Добавляем координаты заказов
        orders.forEach(order => {
            if (order.address?.point?.lat && order.address?.point?.lon) {
                minLat = Math.min(minLat, order.address.point.lat);
                maxLat = Math.max(maxLat, order.address.point.lat);
                minLon = Math.min(minLon, order.address.point.lon);
                maxLon = Math.max(maxLon, order.address.point.lon);
            }
        });

        // Добавляем координаты курьеров
        couriers.forEach(courier => {
            if (courier.point?.lat && courier.point?.lon) {
                minLat = Math.min(minLat, courier.point.lat);
                maxLat = Math.max(maxLat, courier.point.lat);
                minLon = Math.min(minLon, courier.point.lon);
                maxLon = Math.max(maxLon, courier.point.lon);
            }
        });

        // Добавляем запас в 1 км (примерно 0.01 градуса)
        const padding = 0.01;
        return [
            [minLat - padding, minLon - padding],
            [maxLat + padding, maxLon + padding]
        ];
    };

    const bounds = calculateMapBounds();

    // Статистика
    const orderStats = {
        awaitingOrder: orders.filter(o => o.status === "awaitingOrder").length,
        onTheWay: orders.filter(o => o.status === "onTheWay").length,
        delivered: orders.filter(o => o.status === "delivered").length,
        cancelled: orders.filter(o => o.status === "cancelled").length,
        total: orders.length
    };

    return <Container role={userData?.role}>
        <Div>Агрегатор курьеров</Div>
        <Div />
        
        {/* Статистика */}
        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-bold mb-2">Статистика заказов:</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                    <div className="text-green-400 font-bold">{orderStats.awaitingOrder}</div>
                    <div className="text-sm">Ожидают</div>
                </div>
                <div className="text-center">
                    <div className="text-blue-400 font-bold">{orderStats.onTheWay}</div>
                    <div className="text-sm">В пути</div>
                </div>
                <div className="text-center">
                    <div className="text-red-400 font-bold">{orderStats.delivered}</div>
                    <div className="text-sm">Доставлены</div>
                </div>
                <div className="text-center">
                    <div className="text-gray-400 font-bold">{orderStats.cancelled}</div>
                    <div className="text-sm">Отменены</div>
                </div>
                <div className="text-center">
                    <div className="text-white font-bold">{orderStats.total}</div>
                    <div className="text-sm">Всего</div>
                </div>
            </div>
        </div>
        
        {loading ? (
            <Div>Загрузка данных...</Div>
        ) : (
            <div style={{ height: '600px', width: '100%', position: 'relative' }}>
                <MapContainer 
                    bounds={bounds}
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

                    {/* Заказы */}
                    {orders.map((order, index) => {
                        if (order.address?.point?.lat && order.address?.point?.lon) {
                            const color = getOrderColor(order.status);
                            const bottles12 = order.products?.b12 || 0;
                            const bottles19 = order.products?.b19 || 0;
                            
                            return (
                                <Circle
                                    key={`order-${index}`}
                                    center={[order.address.point.lat, order.address.point.lon]}
                                    radius={50}
                                    pathOptions={{
                                        color: color,
                                        fillColor: color,
                                        fillOpacity: 0.7
                                    }}
                                >
                                    <Popup>
                                        <div>
                                            <strong>Заказ: {order.client?.fullName}</strong><br />
                                            Адрес: {order.address?.actual}<br />
                                            Статус: {order.status}<br />
                                            {bottles12 > 0 && `${bottles12} 12л бутылей, `}
                                            {bottles19 > 0 && `${bottles19} 19л бутылей`}
                                        </div>
                                    </Popup>
                                </Circle>
                            );
                        }
                        return null;
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
                                        <div>
                                            <strong>Курьер: {courier.fullName}</strong><br />
                                            Телефон: {courier.phone}<br />
                                            Статус: {courier.onTheLine ? "Активен" : "Неактивен"}
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        }
                        return null;
                    })}
                </MapContainer>

                {/* Легенда карты */}
                <div className="absolute top-4 right-4 bg-white bg-opacity-90 p-4 rounded-lg shadow-lg z-10">
                    <h4 className="font-bold mb-2">Легенда:</h4>
                    <div className="space-y-2">
                        <div className="flex items-center">
                            <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                            <span className="text-sm">Ожидают заказа</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
                            <span className="text-sm">В пути</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
                            <span className="text-sm">Доставлены</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-4 h-4 bg-black rounded-full mr-2"></div>
                            <span className="text-sm">Отменены</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-0 h-0 border-l-2 border-r-2 border-b-4 border-purple-500 mr-2"></div>
                            <span className="text-sm">Курьеры</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-yellow-500 mr-2">⭐</span>
                            <span className="text-sm">Центр</span>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </Container>
}