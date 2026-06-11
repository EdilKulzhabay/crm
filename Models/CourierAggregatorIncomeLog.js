import mongoose from "mongoose";

const CourierAggregatorIncomeLogSchema = new mongoose.Schema(
    {
        courier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CourierAggregator",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ["order_complete", "admin_adjustment", "withdrawal_request"],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        incomeBefore: {
            type: Number,
            required: true,
        },
        incomeAfter: {
            type: Number,
            required: true,
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null,
        },
        opForm: {
            type: String,
            default: null,
        },
        comment: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("CourierAggregatorIncomeLog", CourierAggregatorIncomeLogSchema);
