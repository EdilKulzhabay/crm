import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:4444",
    timeout: 1000 * 30,
    headers: {
        "X-Requested-With": "XMLHttpRequest",
    },
});

api.interceptors.request.use((config) => {
    config.headers.Authorization = window.localStorage.getItem("token");
    return config;
});

export default api;
