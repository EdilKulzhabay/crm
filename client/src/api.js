import axios from "axios";

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
            window.location.href = "/login"; // Перенаправление на страницу логина
        }
        return Promise.reject(error);
    }
);

export default api;