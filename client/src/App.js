import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { AuthContext } from "./AuthContext";
import { useAuth } from "./auth.hook";

function App() {
    const { token, login, logout } = useAuth();
    const isAuthenticated = !!token;

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
                <RouterProvider router={router} />
            </AuthContext.Provider>
        </>
    );
}

export default App;
