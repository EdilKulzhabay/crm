import mongoose from "mongoose";

const AccessoriesModel = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    price: {
        type: String,
        required: true,
    },
    article: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    inStock: {
        type: Boolean,
        required: true
    }
});

export default mongoose.model("Accessories", AccessoriesModel);
