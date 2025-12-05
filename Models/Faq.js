import mongoose from "mongoose";

const FaqModel = new mongoose.Schema({
    question: {
        type: String,
        required: true,
    },
    answer: {
        type: String,
        required: true,
    },
});

export default mongoose.model("Faq", FaqModel);
