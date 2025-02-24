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
            b191: {
                type: Number,
                default: 0
            },
            b197: {
                type: Number,
                default: 0
            }
        },
        full: {
            b12: {
                type: Number,
                default: 0
            },
            b191: {
                type: Number,
                default: 0
            },
            b197: {
                type: Number,
                default: 0
            }
        },
        booked: {
            b12: {
                type: Number,
                default: 0
            },
            b191: {
                type: Number,
                default: 0
            },
            b197: {
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
        }
    },
    {
        timestamps: true
    }
)

export default mongoose.Model("AquaMarket", AquaMarketScheme)