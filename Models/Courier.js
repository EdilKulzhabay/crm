import mongoose from "mongoose";

const CourierSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        mail: {
            type: String,
            required: true,
        },
        password: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            default: "active",
        },
        completedOrders: {
            type: Number,
            default: 0,
        },
        franchisee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Courier", CourierSchema);
