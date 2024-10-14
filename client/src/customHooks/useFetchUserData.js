import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

const useFetchUserData = () => {
    const [userData, setUserData] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        api.get("/getMe", {
            headers: { "Content-Type": "application/json" },
        }).then(({ data }) => {
            setUserData(data);
        }).catch(() => {
            navigate("/login");
        });
    }, [navigate]);

    return userData;
};

export default useFetchUserData;
