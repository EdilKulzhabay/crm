import PromoCode from "../Models/PromoCode.js";

export const addPromoCode = async (req, res) => {
    try {
        const { title, price12, price19, addData, status } = req.body;

        const promoCode = new PromoCode({
            title,
            price12,
            price19,
            addData,
            status
        });

        await promoCode.save();

        res.json({
            success: true,
            message: "Промокод успешно добавлен",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getPromoCodes = async (req, res) => {
    try {
        const { page } = req.body;
        const limit = 3;
        const skip = (page - 1) * limit;

        // Выполняем запрос с сортировкой, пропуском и лимитом
        const promoCodes = await PromoCode.find()
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit);

        res.json({ promoCodes });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const searchPromoCode = async (req, res) => {
    try {
        const { search } = req.body;

        const regex = new RegExp(search, "i"); // 'i' делает поиск регистронезависимым

        const promoCodes = await PromoCode.find({
            title: { $regex: regex },
        });

        res.json({ promoCodes });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const deletePromoCode = async (req, res) => {
    try {
        const { id } = req.body;

        const delRes = await PromoCode.findByIdAndDelete(id);

        if (!delRes) {
            res.json({
                success: false,
                message: "Не удалось удалить промокод",
            });
        }

        res.json({
            success: true,
            message: "Промокод успешно удален",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};
