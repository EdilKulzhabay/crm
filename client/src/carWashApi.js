import axios from "axios";

/**
 * Отдельный клиент для кабинета мойки: свой токен (carWashToken) и свой экран входа.
 * Общий api.js при 403 стирает токен CRM и уводит на /login — сотруднику мойки туда не нужно.
 */
export const CAR_WASH_TOKEN_KEY = "carWashToken";
export const CAR_WASH_LOGIN_PATH = "/carWashLogin";

export const getCarWashToken = () => window.localStorage.getItem(CAR_WASH_TOKEN_KEY);
export const setCarWashToken = (token) => window.localStorage.setItem(CAR_WASH_TOKEN_KEY, token);
export const clearCarWashToken = () => window.localStorage.removeItem(CAR_WASH_TOKEN_KEY);

const carWashApi = axios.create({
    baseURL: process.env.REACT_APP_PORT,
    timeout: 1000 * 30,
    headers: { "X-Requested-With": "XMLHttpRequest" },
});

carWashApi.interceptors.request.use((config) => {
    const token = getCarWashToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

carWashApi.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const isLoginRequest = error.config?.url === "/carWashLogin";
        if (!isLoginRequest && (status === 401 || status === 403)) {
            clearCarWashToken();
            window.location.href = CAR_WASH_LOGIN_PATH;
        }
        return Promise.reject(error);
    }
);

export default carWashApi;
