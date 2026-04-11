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
        paidBootles: {
            type: Number,
            default: 0,
        },
        paidBootlesFor19: {
            type: Number,
            default: 0,
        },
        paidBootlesFor12: {
            type: Number,
            default: 0,
        },
        paymentMethod: {
            type: String,
            default: "balance",
            enum: ["balance", "coupon", "fakt"],
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
        notificationPushTokens: {
            type: [String],
            default: [],
        },
        isStartedHydration: {
            type: Boolean,
            default: false
        },
        supportMessages: [{
            text: {
                type: String
            },
            isUser: {
                type: Boolean
            },
            timestamp: {
                type: String
            },
            isRead: {
                type: Boolean
            }
        }],
        emptyBottles: {
            b12: {
                type: Number,
                default: 0
            },
            b19: {
                type: Number,
                default: 0
            }
        },
        doesItTake19Bottles: {
            type: Boolean,
            default: true
        },
        doesItTake12Bottles: {
            type: Boolean,
            default: false
        },
        platform: {
            type: String,
            default: null
        },
        appVersion: {
            type: String,
            default: null
        },
        /** Блок «Ремонт техники / Вызвать мастера» в мобильном приложении */
        showRepairMasterInApp: {
            type: Boolean,
            default: false,
        },
        savedCard: {
            cardToken: {
                type: String,
                default: null
            },
            cardId: {
                type: String,
                default: null
            },
            cardPan: {
                type: String,   // последние 4 цифры карты, например "1111"
                default: null
            }
        },
        /** Уникальный код вида XXXX-XXXX-XXXX для приглашения друзей */
        referralCode: {
            type: String,
            sparse: true,
            unique: true,
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            default: null,
        },
        /**
         * У ПРИГЛАШЁННОГО клиента: пригласившему уже начислили бонус за первую доставку этого человека.
         * Каждый приглашённый друг — отдельный документ Client со своим полем → число друзей не ограничено.
         */
        firstOrderReferrerBonusPaid: {
            type: Boolean,
            default: false,
        },
        /** @deprecated прежнее имя; читается в referralRewards.js, затем снимается через $unset */
        referralReferrerBonusPaid: {
            type: Boolean,
        },
        /** Счётчик успешно оформленных заказов через приложение (для показа реф. модалки каждые 3) */
        appOrdersPlacedCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Client", ClientSchema);
