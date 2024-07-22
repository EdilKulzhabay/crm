import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        price: {
            type: String,
            required: true,
        },
        validity: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Subscription", SubscriptionSchema);
