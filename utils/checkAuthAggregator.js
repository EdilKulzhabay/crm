import jwt from "jsonwebtoken";

export default async (req, res, next) => {
    const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.SecretKey);

            req.userId = decoded?._id || null;
            req.role = decoded?.role || null; 
            next();
        } catch (e) {
            return res.status(403).json({
                success: false,
                message: "Нет доступа",
            });
        }
    } else {
        return res.status(403).json({
            success: false,
            message: "Нет доступа",
        });
    }
};
