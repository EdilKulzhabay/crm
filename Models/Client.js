import mongoose from "mongoose";

const ClientSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
        },
        phone: {
            type: String,
            required: true,
        },
        mail: {
            type: String,
            required: true,
        },
        password: {
            type: String,
        },
        addresses: [
            {
                street: {
                    type: String,
                },
                link: {
                    type: String,
                },
                house: {
                    type: String,
                },
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
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Client", ClientSchema);
