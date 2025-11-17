import mongoose from "mongoose";

const AquaMarketScheme = new mongoose.Schema(
    {
        franchisee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        },
        empty: {
            b12: {
                type: Number,
                default: 0
            },
            b19: {
                type: Number,
                default: 0
            }
        },
        full: {
            b12: {
                type: Number,
                default: 0
            },
            b19: {
                type: Number,
                default: 0
            }
        },
        booked: {
            b12: {
                type: Number,
                default: 0
            },
            b19: {
                type: Number,
                default: 0
            }
        },
        point: {
            lat: {
                type: Number,
                required: true
            },
            lon: {
                type: Number,
                required: true
            }
        },
        dispensedBottlesKol: {
            type: Number,
            default: 0
        },
        address: {
            type: String,
            default: ""
        },
        link: {
            type: String,
            default: ""
        },
        userName: {
            type: String,
            default: ""
        },
        password: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
)

export default mongoose.model("AquaMarket", AquaMarketScheme)