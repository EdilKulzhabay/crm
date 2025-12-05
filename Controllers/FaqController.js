import Faq from "../Models/Faq.js";

export const addFaq = async (req, res) => {
    try {
        const { question, answer } = req.body;
        const faq = new Faq({ question, answer });
        await faq.save();
        res.json({
            success: true,
            message: "FAQ успешно добавлен",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Что-то пошло не так",
        });
    }
}

export const getFaq = async (req, res) => {
    try {
        const faq = await Faq.find();
        res.json({
            success: true,
            faq,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Что-то пошло не так",
        });
    }
}

export const updateFaq = async (req, res) => {
    try {
        const { id, question, answer } = req.body;
        const faq = await Faq.findByIdAndUpdate(id, { question, answer }, { new: true });
        res.json({
            success: true,
            message: "FAQ успешно обновлен",
            faq,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Что-то пошло не так",
        });
    }
}

export const deleteFaq = async (req, res) => {
    try {
        const { id } = req.body;
        await Faq.findByIdAndDelete(id);
        res.json({
            success: true,
            message: "FAQ успешно удален",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Что-то пошло не так",
        });
    }
}