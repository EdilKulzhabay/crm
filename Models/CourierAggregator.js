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
        },
        notificationPushTokens: {
            type: [String],
            default: []
        },
        point: {
            lat: {
                type: Number,
            },
            lon: {
                type: Number,
            },
            timestamp: {
                type: Date
            }
        },
        orders: {
            type: [{
                orderId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Order",
                    required: true
                },
                clientPoints: {
                    lat: {
                        type: Number,
                        required: true
                    },
                    lon: {
                        type: Number,
                        required: true
                    }
                },
                aquaMarketPoints: {
                    lat: {
                        type: Number,
                        required: true
                    },
                    lon: {
                        type: Number,
                        required: true
                    }
                },
                aquaMarketAddress: {
                    type: String,
                    required: true
                },
                step: {
                    type: String,
                    enum: ["toAquaMarket", "toClient"],
                    required: true,
                    default: "toAquaMarket"
                }
            }],
            default: []
        }
    },
    {
        timestamps: true,
    }
)

export default mongoose.model("CourierAggregator", CourierAggregatorSchema)