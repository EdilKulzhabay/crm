import { useEffect, useState } from "react";
import api from "../../api";

/**
 * Статистика купона на мойку за всё время (только суперадмин):
 * clickedClients — сколько клиентов нажали кнопку на главной приложения,
 * screenViews — сколько раз открывали экран с кодом.
 * null — ещё грузится или нет доступа: счётчик просто не показываем.
 */
export default function useCarWashCouponStats() {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        let isActive = true;
        api.post("/getCarWashCouponStatsAdmin")
            .then(({ data }) => isActive && setStats(data.stats))
            .catch((e) => console.error("Статистика купона на мойку:", e?.response?.data?.message || e.message));
        return () => {
            isActive = false;
        };
    }, []);

    return stats;
}
