import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
    {
        franchisee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
        },
        address: {
            actual: {
                type: String,
            },
            link: {
                type: String,
            },
        },
        products: {
            b12: {
                type: Number,
                default: 0,
            },
            b19: {
                type: Number,
                default: 0,
            },
        },
        date: {
            d: {
                type: String,
            },
            time: {
                type: String,
            },
        },
        status: {
            type: String,
            default: "awaitingOrder",
        },
        sum: {
            type: Number,
            default: 0,
        },
        courier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Courier",
        },
        history: [String],
        clientNotes: {
            type: String,
        },
        transferred: {
            type: Boolean,
            default: false
        },
        transferredFranchise: {
            type: String,
        },
        clientReview: {
            type: String,
        },
        opForm: {
            type: String
        }
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Order", OrderSchema);
