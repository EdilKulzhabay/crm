import mongoose from "mongoose";

const PromoCodeSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        price19: {
            type: String,
            required: true,
        },
        price12: {
            type: String,
            required: true,
        },
        addData: {
            type: Boolean,
            required: true,
        },
        status: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("PromoCode", PromoCodeSchema);
