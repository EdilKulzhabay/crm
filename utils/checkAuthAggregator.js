import jwt from "jsonwebtoken";

export default async (req, res, next) => {
    console.log("we in checkAuthAggregator");
    
    const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");

    console.log("we in checkAuthAggregator2");
    
    if (token) {
        console.log("we in checkAuthAggregator3");
        try {
            console.log("we in checkAuthAggregator4");
            const decoded = jwt.verify(token, process.env.SecretKey);

            console.log("checkAuthAggregator deocded: ", decoded);
            
    
            req.userId = decoded?._id || null;
            req.role = decoded?.role || null; 
            next();
        } catch (e) {
            console.log("we in checkAuthAggregator5");
            return res.status(403).json({
                message: "Нет доступа",
            });
        }
    } else {
        console.log("we in checkAuthAggregator6");
        return res.status(403).json({
            success: false,
            message: "Нет доступа",
        });
    }
};
