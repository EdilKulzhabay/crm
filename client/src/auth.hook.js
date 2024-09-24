import { useCallback, useEffect, useState } from "react";

const storageName = "token";

export const useAuth = () => {
    const [token, setToken] = useState(null);

    const login = useCallback((jwtToken) => {
        setToken(jwtToken);
        localStorage.setItem(storageName, jwtToken);
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        localStorage.removeItem(storageName);
    }, []);

    useEffect(() => {
        const data = localStorage.getItem(storageName);
        if (data) {
            login(data);
        }
    }, [login]);

    return { login, logout, token };
};
