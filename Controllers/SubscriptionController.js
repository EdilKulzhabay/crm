import Subscription from "../Models/Subscription.js";

export const addSubscription = async (req, res) => {
    try {
        const { title, description, price, validity } = req.body;

        const subscription = new Subscription({
            title,
            description,
            price,
            validity
        });

        await subscription.save();

        const subscriptions = await Subscription.find();

        if (!subscriptions) {
            return res.status(409).json({
                message: "Не удалось получить подписки",
            });
        }

        res.json({ subscriptions });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getAllSubscriptions = async (req, res) => {
    try {
        const subscriptions = await Subscription.find();

        if (!subscriptions) {
            return res.status(409).json({
                message: "Не удалось получить подписки",
            });
        }

        res.json({ subscriptions });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getSubscriptionById = async (req, res) => {
    try {
        const { id } = req.body;

        const subscription = await Subscription.findById(id);

        if (!subscription) {
            return res.status(409).json({
                message: "Не удалось получить подписку",
            });
        }

        res.json({ subscription });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const deleteSubscription = async (req, res) => {
    try {
        const { id } = req.body;
        const delRes = await Subscription.findByIdAndDelete(id);

        if (!delRes) {
            return res.status(400).json({
                message: "Не удалось удалить подписку",
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
};
