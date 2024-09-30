import Notification from "../Models/Notification.js"

export const getNotifications = async (req, res) => {
    try {
        const { page } = req.body;
        const limit = 3;
        const skip = (page - 1) * limit;

        const notifications = await Notification.find().sort({ createdAt: 1 })
        .populate("first")
        .populate("second")
        .populate("firstObject")
        .populate("secondObject")
        .skip(skip)
        .limit(limit)
        

        res.json({notifications})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getNotificationDataForId = async (req, res) => {
    try {
        const {id} = req.body

        const notification = await Notification.findById(id)
        .populate("first")
        .populate("second")
        .populate("firstObject")
        .populate("secondObject")

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Совпадение не найдено"
            })
        }

        res.json({
            notification
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const deleteNotification = async (req, res) => {
    try {
        const {id} = req.body

        const delRes = await Notification.findByIdAndDelete(id);

        if (!delRes) {
            return res.status(400).json({
                success: false,
                message: "Не удалось удалить совпадние",
            });
        }
        res.json({
            success: true,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}