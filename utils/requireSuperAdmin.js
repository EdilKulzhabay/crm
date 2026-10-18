import User from "../Models/User.js";

/**
 * После checkAuth: пропускает только пользователя CRM с ролью superAdmin.
 * checkRole проверяет лишь тип (user/courier/client), а роль франчайзи тоже "user".
 */
export function createRequireSuperAdmin({ findUserRole = async (id) => (await User.findById(id).select("role").lean())?.role } = {}) {
    return async (req, res, next) => {
        try {
            if (req.userType !== "user" || (await findUserRole(req.userId)) !== "superAdmin") {
                return res.status(403).json({ success: false, message: "Доступно только суперадмину" });
            }
            return next();
        } catch (error) {
            console.error("[requireSuperAdmin]", error?.message || error);
            return res.status(500).json({ success: false, message: "Внутренняя ошибка сервера" });
        }
    };
}

export default createRequireSuperAdmin();
