import mongoose from "mongoose";

const CourierAggregatorSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            default: ""
        },
        email: {
            type: String,
            default: ""
        },
        phone: {
            type: String,
            default: ""
        },
        income: {
            type: Number,
            default: 0
        },
        password: {
            type: String,
            default: ""
        },
        onTheLine: {
            type: Boolean,
            default: false
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
            enum: ["A", "B", "C"],
            default: "A"
        },
        wholeList: {
            type: Boolean,
            default: false
        },
        phoneVision: {
            type: Boolean,
            default: false
        },
        notificationPushToken: {
            type: String,
            default: ""
        },
        firstName: {
            type: String,
            default: ""
        },
        lastName: {
            type: String,
            default: ""
        },
        languages: {
            type: [String],
            default: []
        },
        birthDate: {
            type: Date,
            default: null
        },
        country: {
            type: String,
            default: ""
        },
        city: {
            type: String,
            default: ""
        },
        transport: {
            type: String,
            enum: ["A", "B", "C"],
            default: "A"
        },
        inviteCode: {
            type: String,
            default: ""
        },
        termsAccepted: {
            type: Boolean,
            default: false
        },
        privacyAccepted: {
            type: Boolean,
            default: false
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
        order: {
            orderId: {
                type: String
            },
            status: {
                type: String
            },
            products: {
                b12: {
                    type: Number
                },
                b19: {
                    type: Number
                }
            },
            sum: {
                type: Number
            },
            opForm: {
                type: String
            },
            comment: {
                type: String
            },
            clientReview: {
                type: String
            },
            date: {
                d: {
                    type: String
                },
                time: {
                    type: String
                }
            },
            clientTitle: {
                type: String
            },
            clientPhone: {
                type: String
            },
            clientPoints: {
                lat: {
                    type: Number
                },
                lon: {
                    type: Number
                }
            },
            clientAddress: {
                type: String
            },
            clientAddressLink: {
                type: String
            },
            aquaMarketPoints: {
                lat: {
                    type: Number
                },
                lon: {
                    type: Number
                }
            },
            aquaMarketAddress: {
                type: String
            },
            aquaMarketAddressLink: {
                type: String
            },
            step: {
                type: String
            },
            income: {
                type: Number
            }
        },
        orders: {
            type: [{
                orderId: {
                    type: String
                },
                status: {
                    type: String
                },
                products: {
                    b12: {
                        type: Number
                    },
                    b19: {
                        type: Number
                    }
                },
                sum: {
                    type: Number
                },
                opForm: {
                    type: String
                },
                comment: {
                    type: String
                },
                clientReview: {
                    type: String
                },
                date: {
                    d: {
                        type: String
                    },
                    time: {
                        type: String
                    }
                },
                clientTitle: {
                    type: String
                },
                clientPhone: {
                    type: String
                },
                clientPoints: {
                    lat: {
                        type: Number
                    },
                    lon: {
                        type: Number
                    }
                },
                clientAddress: {
                    type: String
                },
                clientAddressLink: {
                    type: String
                },
                aquaMarketPoints: {
                    lat: {
                        type: Number
                    },
                    lon: {
                        type: Number
                    }
                },
                aquaMarketAddress: {
                    type: String
                },
                aquaMarketAddressLink: {
                    type: String
                },
                step: {
                    type: String
                },
                income: {
                    type: Number
                }
            }],
            default: []
        },
        soldBootles: {
            kol: {
                type: Number,
                default: 0,
            },
            date: {
                type: Date,
            }
        },
        capacity12: {
            type: Number,
            default: 0,
        },
        capacity19: {
            type: Number,
            default: 0,
        },
        capacity: {
            type: Number,
            default: 0,
        },
        completeFirstOrder: {
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true,
    }
)

export default mongoose.model("CourierAggregator", CourierAggregatorSchema)