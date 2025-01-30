import jwt from "jsonwebtoken";

export default (req, res, next) => {
    const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.SecretKey);
            console.log("decoded in chackAuth: ", decoded);
            
            let userId;
            if (decoded.client) {
                userId = decoded.client._id;
            } else {
                userId = decoded._id;
            }
            req.userId = userId;
            next();
        } catch (e) {
            return res.status(403).json({
                message: "Нет доступа",
            });
        }
    } else {
        return res.status(403).json({
            message: "Нет доступа",
        });
    }
};
