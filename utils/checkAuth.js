import jwt from "jsonwebtoken";

export default (req, res, next) => {
    const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.SecretKey);
            const userId = decoded._id;
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
