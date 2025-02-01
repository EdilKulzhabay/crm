const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.userType || !allowedRoles.includes(req.userType)) {
            return res.status(403).json({ message: "У вас нет доступа к этому ресурсу" });
        }
        next();
    };
};

export default checkRole;