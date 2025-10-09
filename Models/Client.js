import mongoose from "mongoose";

const ClientSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
        },
        userName: {
            type: String,
        },
        phone: {
            type: String,
        },
        mail: {
            type: String,
        },
        password: {
            type: String,
        },
        region: {
            type: String,
        },
        addresses: [
            {
                // _id: {
                //     type: String,  // Позволяем строковые ID
                // },
                name: {
                    type: String,
                },
                city: {
                    type: String,
                },
                street: {
                    type: String,
                },
                floor: {
                    type: String,
                },
                apartment: {
                    type: String,
                },
                link: {
                    type: String,
                },
                house: {
                    type: String,
                },
                id2Gis: {
                    type: String
                },
                phone: {
                    type: String
                },
                point: {
                    lat: {
                        type: Number,
                    },
                    lon: {
                        type: Number,
                    }
                }
            },
        ],
        price19: {
            type: Number,
        },
        price12: {
            type: Number,
        },
        status: {
            type: String,
            default: "active",
        },
        franchisee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        bonus: {
            type: Number,
            default: 0,
        },
        balance: {
            type: Number,
            default: 0,
        },
        cart: {
            b12: {
                type: Number,
                default: 0,
            },
            b19: {
                type: Number,
                default: 0,
            },
        },
        subscription: {
            type: Boolean,
            default: false
        },
        chooseTime: {
            type: Boolean,
            default: false
        },
        refreshToken: {
            type: String,
        },
        opForm: {
            type: String
        },
        dailyWater: {
            type: Number
        },
        type: {
            type: Boolean,
            default: true
        },
        verify: {
            status: {
                type: String,
                default: "waitingVerification"
            },
            message: {
                type: String,
            }
        },
        haveCompletedOrder: {
            type: Boolean,
            default: false
        },
        expoPushToken: [],
        clientType: {
            type: Boolean,
            default: true
        },
        clientBottleType: {
            type: Number,
            default: 1,
        },
        clientBottleCount: {
            type: Number,
            default: 0,
        },
        clientBottleCredit: {
            type: Number,
            default: false
        },
        notificationPushToken: {
            type: String,
            default: "",
        },
        isStartedHydration: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Client", ClientSchema);
