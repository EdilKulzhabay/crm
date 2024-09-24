import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { AuthContext } from "./AuthContext";
import { useAuth } from "./auth.hook";
import NotificationComponent from "./Components/NotificationComponent";
import { useEffect } from "react";

function App() {
    const { token, login, logout } = useAuth();
    const isAuthenticated = !!token;

    useEffect(() => {
        console.log("HERE", token);
        
    }, [token])

    return (
        <>
            <AuthContext.Provider
                value={{
                    token,
                    login,
                    logout,
                    isAuthenticated,
                }}
            >
                {token && <NotificationComponent />}
                <RouterProvider router={router} />
            </AuthContext.Provider>
        </>
    );
}

export default App;
