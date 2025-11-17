import mongoose from "mongoose";

const AquaMarketHistoryScheme = new mongoose.Schema(
    {
        aquaMarket: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AquaMarket"
        },
        actionType: {
            type: String,
            enum: ["giving", "receiving", "fill"]
        },
        bottles: {
            b12: {
                type: Number,
                default: 0
            },
            b19: {
                type: Number,
                default: 0
            }
        },
        courierAggregator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CourierAggregator"
        }
    },
    {
        timestamps: true
    }
)

export default mongoose.model("AquaMarketHistory", AquaMarketHistoryScheme)