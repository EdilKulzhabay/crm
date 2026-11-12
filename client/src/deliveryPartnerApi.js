import axios from "axios";

/**
 * Отдельный клиент для кабинета партнёра по доставке: свой токен и свой экран входа.
 * Общий api.js при 403 стирает токен CRM и уводит на /login — партнёру туда не нужно.
 */
export const DELIVERY_PARTNER_TOKEN_KEY = "deliveryPartnerToken";
export const DELIVERY_PARTNER_LOGIN_PATH = "/deliveryPartnerLogin";

export const getDeliveryPartnerToken = () => window.localStorage.getItem(DELIVERY_PARTNER_TOKEN_KEY);
export const setDeliveryPartnerToken = (token) => window.localStorage.setItem(DELIVERY_PARTNER_TOKEN_KEY, token);
export const clearDeliveryPartnerToken = () => window.localStorage.removeItem(DELIVERY_PARTNER_TOKEN_KEY);

const deliveryPartnerApi = axios.create({
    baseURL: process.env.REACT_APP_PORT,
    timeout: 1000 * 30,
    headers: { "X-Requested-With": "XMLHttpRequest" },
});

deliveryPartnerApi.interceptors.request.use((config) => {
    const token = getDeliveryPartnerToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

deliveryPartnerApi.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const isLoginRequest = error.config?.url === "/deliveryPartnerLogin";
        if (!isLoginRequest && (status === 401 || status === 403)) {
            clearDeliveryPartnerToken();
            window.location.href = DELIVERY_PARTNER_LOGIN_PATH;
        }
        return Promise.reject(error);
    }
);

export default deliveryPartnerApi;
