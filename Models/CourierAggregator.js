import mongoose from "mongoose";

const CourierAggregatorSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            default: ""
        },
        mail: {
            type: String,
            default: ""
        },
        phone: {
            type: String,
            default: ""
        },
        password: {
            type: String,
            default: ""
        },
        onTheLine: {
            type: Boolean,
            default: false
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
        },
        notAccesptedKol: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ["awaitingVerfication", "active", "inActive", "deleted"],
            default: "awaitingVerfication"
        },
        carNumber: {
            type: String,
            default: "",
        },
        blockTime: {
            type: Date,
            default: null
        },
        IIN: {
            type: String,
            default: ""
        },
        idCardNumber: {
            type: String,
            default: ""
        },
        balance: {
            type: Number,
            default: 0
        },
        raiting: {
            type: Number,
            default: 0
        },
        carType: {
            type: String,
            enum: ["A", "B", "C"]
        },
        wholeList: {
            type: Boolean,
            default: false
        },
        phoneVision: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
    }
)

export default mongoose.model("CourierAggregator", CourierAggregatorSchema)