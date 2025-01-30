import axios from "axios";
import { useNavigate } from "react-router-dom";
const navigate = useNavigate();

const api = axios.create({
    baseURL: process.env.REACT_APP_PORT,
    timeout: 1000 * 30,
    headers: {
        "X-Requested-With": "XMLHttpRequest",
    },
});

api.interceptors.request.use((config) => {
    config.headers.Authorization = window.localStorage.getItem("token");
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 403) {
            localStorage.removeItem("token");
            navigate("/login"); // Перенаправление через useNavigate
        }
        return Promise.reject(error);
    }
);

export default api;
