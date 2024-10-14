import User from "../Models/User.js";

export const getAnalyticsData = async (req, res) => {
    try {
        const id = req.userId
        const {startDate, endDate} = req.body

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
        const day = String(today.getDate()).padStart(2, '0');
        const todayDate = `${year}-${month}-${day}`;
        const tomorrow = new Date(today); // Копируем сегодняшнюю дату
        tomorrow.setDate(today.getDate() + 1);  
        const tYear = tomorrow.getFullYear();
        const tMonth = String(tomorrow.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
        const tDay = String(tomorrow.getDate()).padStart(2, '0');
        const tomorrowDate = `${tYear}-${tMonth}-${tDay}`;

        const user = await User.findById(id)

        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            })
        }
        const filter = {
            status: { $in: ["delivered", "cancelled"] },
            "date.d": { $gte: startDate !== "" ? startDate : todayDate, $lte: endDate !== "" ? endDate : tomorrowDate },
        }

        if (user.role === "admin") {
            filter.$or = [
                {franchisee: new mongoose.Types.ObjectId(id)},
                {transferredFranchise: user.fullName}
            ]
        }

        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}