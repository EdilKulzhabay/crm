import mongoose from "mongoose";

const PickupSchema = new mongoose.Schema(
    {
        price19: {
            type: Number,
            default: 600
        },
        price12: {
            type: Number,
            default: 400
        },
        kol19: {
            type: Number,
            default: 0
        },
        kol12: {
            type: Number,
            default: 0
        },
        opForm: {
            type: String,
        },
        sum: {
            type: Number
        }
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Pickup", PickupSchema);
