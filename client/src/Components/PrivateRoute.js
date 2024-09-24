import { Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";

const PrivateRoute = ({ element }) => {
    const qwe = useContext(AuthContext)
    console.log(qwe);
    
    const { isAuthenticated } = useContext(AuthContext);

    // Если пользователь не аутентифицирован, перенаправляем на страницу логина
    if (!isAuthenticated) {
        console.log("private route");
        
        return <Navigate to="/login" replace />;
    }

    console.log("private");
    

    // Если аутентифицирован, отображаем запрашиваемую страницу
    return element;
};

export default PrivateRoute;
